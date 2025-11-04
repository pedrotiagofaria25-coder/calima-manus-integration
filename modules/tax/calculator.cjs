/**
 * Tax Calculator - Apuração de Tributos
 * 
 * Calcula e apura PIS, COFINS, IRPJ, CSLL e ISS.
 */

const { retryBrowserOperation } = require("../../lib/retry.cjs");
const { getPool } = require("../../lib/browser-pool.cjs");
const { CalimaDatabase } = require("../../lib/database.cjs");

class TaxCalculator {
    constructor(options = {}) {
        this.db = new CalimaDatabase();
        this.db.initialize();
        this.verbose = options.verbose || false;
    }

    /**
     * Apura PIS mensal
     */
    async calculatePIS(params, credentials) {
        return await this.calculateTax('PIS', 'mensal', params, credentials);
    }

    /**
     * Apura COFINS mensal
     */
    async calculateCOFINS(params, credentials) {
        return await this.calculateTax('COFINS', 'mensal', params, credentials);
    }

    /**
     * Apura IRPJ trimestral
     */
    async calculateIRPJ(params, credentials) {
        return await this.calculateTax('IRPJ', 'trimestral', params, credentials);
    }

    /**
     * Apura CSLL trimestral
     */
    async calculateCSLL(params, credentials) {
        return await this.calculateTax('CSLL', 'trimestral', params, credentials);
    }

    /**
     * Apura ISS mensal
     */
    async calculateISS(params, credentials) {
        return await this.calculateTax('ISS', 'mensal', params, credentials);
    }

    /**
     * Função genérica para cálculo de tributos
     */
    async calculateTax(taxType, periodType, params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                await this.login(page, credentials);

                // Navegar para apuração de tributos
                await page.click('text=Tributos');
                await page.click(`text=Apuração de ${taxType}`);
                await page.waitForTimeout(1000);

                // Preencher período
                await page.fill('input[name="periodo"]', params.periodo);
                
                if (params.empresaId) {
                    await page.selectOption('select[name="empresa"]', params.empresaId);
                }

                // Calcular
                await page.click('button:has-text("Calcular")');
                await page.waitForSelector('.apuracao-concluida', { timeout: 60000 });

                // Extrair resultados
                const apuracao = await page.evaluate(() => {
                    return {
                        baseCalculo: document.querySelector('#base_calculo')?.textContent || '0',
                        aliquota: document.querySelector('#aliquota')?.textContent || '0',
                        valorDevido: document.querySelector('#valor_devido')?.textContent || '0',
                        creditos: document.querySelector('#creditos')?.textContent || '0',
                        valorPagar: document.querySelector('#valor_pagar')?.textContent || '0',
                        vencimento: document.querySelector('#data_vencimento')?.textContent || ''
                    };
                });

                if (this.verbose) {
                    console.log(`[Tax] ✅ ${taxType} apurado: R$ ${apuracao.valorPagar}`);
                }

                return {
                    success: true,
                    tributo: taxType,
                    periodo: params.periodo,
                    periodType,
                    ...apuracao
                };
            });

            const duration = Date.now() - startTime;
            this.db.logExecucao(`apuracao_${taxType.toLowerCase()}`, 'sucesso', duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[Tax] ❌ Erro ao apurar ${taxType}: ${error.message}`);
            this.db.logExecucao(`apuracao_${taxType.toLowerCase()}`, 'erro', duration, error.message);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Apuração completa mensal (PIS + COFINS + ISS)
     */
    async calculateMonthlyTaxes(params, credentials) {
        const results = {
            periodo: params.periodo,
            tributos: []
        };

        try {
            console.log('[Tax] 📊 Apurando PIS...');
            const pis = await this.calculatePIS(params, credentials);
            results.tributos.push(pis);

            console.log('[Tax] 📊 Apurando COFINS...');
            const cofins = await this.calculateCOFINS(params, credentials);
            results.tributos.push(cofins);

            console.log('[Tax] 📊 Apurando ISS...');
            const iss = await this.calculateISS(params, credentials);
            results.tributos.push(iss);

            results.success = true;
            results.totalDevido = results.tributos.reduce((sum, t) => {
                return sum + parseFloat(t.valorPagar.replace(/[^\d,]/g, '').replace(',', '.') || 0);
            }, 0);

            if (this.verbose) {
                console.log(`[Tax] ✅ Apuração mensal concluída: R$ ${results.totalDevido.toFixed(2)}`);
            }

            return results;

        } catch (error) {
            console.error(`[Tax] ❌ Erro na apuração mensal: ${error.message}`);
            results.success = false;
            results.error = error.message;
            return results;
        }
    }

    /**
     * Apuração completa trimestral (IRPJ + CSLL)
     */
    async calculateQuarterlyTaxes(params, credentials) {
        const results = {
            periodo: params.periodo,
            tributos: []
        };

        try {
            console.log('[Tax] 📊 Apurando IRPJ...');
            const irpj = await this.calculateIRPJ(params, credentials);
            results.tributos.push(irpj);

            console.log('[Tax] 📊 Apurando CSLL...');
            const csll = await this.calculateCSLL(params, credentials);
            results.tributos.push(csll);

            results.success = true;
            results.totalDevido = results.tributos.reduce((sum, t) => {
                return sum + parseFloat(t.valorPagar.replace(/[^\d,]/g, '').replace(',', '.') || 0);
            }, 0);

            if (this.verbose) {
                console.log(`[Tax] ✅ Apuração trimestral concluída: R$ ${results.totalDevido.toFixed(2)}`);
            }

            return results;

        } catch (error) {
            console.error(`[Tax] ❌ Erro na apuração trimestral: ${error.message}`);
            results.success = false;
            results.error = error.message;
            return results;
        }
    }

    /**
     * Gera relatório de tributos apurados
     */
    async generateTaxReport(params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                await this.login(page, credentials);

                // Navegar para relatórios
                await page.click('text=Relatórios');
                await page.click('text=Tributos Pagos');
                await page.waitForTimeout(1000);

                // Configurar período
                await page.fill('input[name="periodo_inicio"]', params.periodoInicio);
                await page.fill('input[name="periodo_fim"]', params.periodoFim);

                // Gerar relatório
                await page.click('button:has-text("Gerar Relatório")');
                await page.waitForSelector('.relatorio-gerado', { timeout: 30000 });

                // Download se solicitado
                if (params.download) {
                    const downloadPromise = page.waitForEvent('download');
                    await page.click('button:has-text("Download PDF")');
                    const download = await downloadPromise;
                    await download.saveAs(`./downloads/Relatorio_Tributos_${params.periodoInicio}_${params.periodoFim}.pdf`);
                }

                if (this.verbose) {
                    console.log(`[Tax] ✅ Relatório de tributos gerado`);
                }

                return {
                    success: true,
                    periodoInicio: params.periodoInicio,
                    periodoFim: params.periodoFim
                };
            });

            const duration = Date.now() - startTime;
            this.db.logExecucao('relatorio_tributos', 'sucesso', duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[Tax] ❌ Erro ao gerar relatório: ${error.message}`);
            this.db.logExecucao('relatorio_tributos', 'erro', duration, error.message);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Função de login reutilizável
     */
    async login(page, credentials) {
        await page.goto("https://www.calima.app/");
        await page.fill("input[name='username']", credentials.username);
        await page.fill("input[name='password']", credentials.password);
        await page.click("button[type='submit']");
        await page.waitForURL("**/dashboard", { timeout: 30000 });
    }

    /**
     * Fecha a conexão com o banco
     */
    close() {
        this.db.close();
    }
}

module.exports = {
    TaxCalculator
};
