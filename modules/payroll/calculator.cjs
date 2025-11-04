/**
 * Payroll Calculator - Cálculo de Folha de Pagamento
 * 
 * Calcula folhas de pagamento, gera GPS e recibos de pró-labore.
 */

const { retryBrowserOperation } = require("../../lib/retry.cjs");
const { getPool } = require("../../lib/browser-pool.cjs");
const { CalimaDatabase } = require("../../lib/database.cjs");

class PayrollCalculator {
    constructor(options = {}) {
        this.db = new CalimaDatabase();
        this.db.initialize();
        this.verbose = options.verbose || false;
    }

    /**
     * Calcula a folha de pagamento de um mês
     */
    async calculateMonthly(params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                // Login no Calima
                await this.login(page, credentials);

                // Navegar para Folha de Pagamento
                await page.click('text=Folha de Pagamento');
                await page.waitForTimeout(1000);

                // Selecionar mês de referência
                await page.fill('input[name="mes_referencia"]', params.mes);
                
                // Selecionar empresa se especificada
                if (params.empresaId) {
                    await page.selectOption('select[name="empresa"]', params.empresaId);
                }

                // Clicar em Calcular Folha
                await page.click('button:has-text("Calcular Folha")');
                await page.waitForSelector('.resultado-calculo', { timeout: 60000 });

                // Extrair resultados
                const resultado = await page.evaluate(() => {
                    const elementos = {
                        totalProventos: document.querySelector('#total_proventos')?.textContent || '0',
                        totalDescontos: document.querySelector('#total_descontos')?.textContent || '0',
                        totalLiquido: document.querySelector('#total_liquido')?.textContent || '0',
                        inss: document.querySelector('#valor_inss')?.textContent || '0',
                        fgts: document.querySelector('#valor_fgts')?.textContent || '0',
                        irrf: document.querySelector('#valor_irrf')?.textContent || '0',
                        funcionarios: document.querySelectorAll('.linha-funcionario').length
                    };
                    return elementos;
                });

                if (this.verbose) {
                    console.log(`[Payroll] ✅ Folha calculada: ${resultado.funcionarios} funcionários`);
                }

                return {
                    success: true,
                    mes: params.mes,
                    ...resultado
                };
            });

            // Salvar no banco de dados
            const duration = Date.now() - startTime;
            this.db.logExecucao('calculo_folha', 'sucesso', duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[Payroll] ❌ Erro ao calcular folha: ${error.message}`);
            this.db.logExecucao('calculo_folha', 'erro', duration, error.message);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Gera GPS (Guia da Previdência Social)
     */
    async generateGPS(params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                await this.login(page, credentials);

                // Navegar para geração de GPS
                await page.click('text=Folha de Pagamento');
                await page.click('text=Gerar GPS');
                await page.waitForTimeout(1000);

                // Preencher parâmetros
                await page.fill('input[name="mes_referencia"]', params.mes);
                
                if (params.empresaId) {
                    await page.selectOption('select[name="empresa"]', params.empresaId);
                }

                // Gerar GPS
                await page.click('button:has-text("Gerar GPS")');
                await page.waitForSelector('.gps-gerada', { timeout: 30000 });

                // Extrair dados da GPS
                const gpsData = await page.evaluate(() => {
                    return {
                        codigoGPS: document.querySelector('#codigo_gps')?.textContent || '',
                        valorINSS: document.querySelector('#valor_inss_gps')?.textContent || '0',
                        vencimento: document.querySelector('#data_vencimento')?.textContent || '',
                        competencia: document.querySelector('#competencia')?.textContent || ''
                    };
                });

                // Fazer download do PDF se solicitado
                if (params.downloadPDF) {
                    const downloadPromise = page.waitForEvent('download');
                    await page.click('button:has-text("Download PDF")');
                    const download = await downloadPromise;
                    await download.saveAs(`./downloads/GPS_${params.mes}.pdf`);
                }

                if (this.verbose) {
                    console.log(`[Payroll] ✅ GPS gerada: ${gpsData.codigoGPS}`);
                }

                return {
                    success: true,
                    mes: params.mes,
                    ...gpsData
                };
            });

            const duration = Date.now() - startTime;
            this.db.logExecucao('gerar_gps', 'sucesso', duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[Payroll] ❌ Erro ao gerar GPS: ${error.message}`);
            this.db.logExecucao('gerar_gps', 'erro', duration, error.message);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Gera recibos de pró-labore
     */
    async generateProlabore(params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                await this.login(page, credentials);

                // Navegar para pró-labore
                await page.click('text=Folha de Pagamento');
                await page.click('text=Pró-labore');
                await page.waitForTimeout(1000);

                // Preencher dados
                await page.fill('input[name="mes_referencia"]', params.mes);
                
                if (params.socioId) {
                    await page.selectOption('select[name="socio"]', params.socioId);
                }

                // Gerar recibos
                await page.click('button:has-text("Gerar Recibos")');
                await page.waitForSelector('.recibos-gerados', { timeout: 30000 });

                // Contar recibos gerados
                const recibosGerados = await page.evaluate(() => {
                    return document.querySelectorAll('.recibo-item').length;
                });

                if (this.verbose) {
                    console.log(`[Payroll] ✅ ${recibosGerados} recibo(s) de pró-labore gerado(s)`);
                }

                return {
                    success: true,
                    mes: params.mes,
                    recibosGerados
                };
            });

            const duration = Date.now() - startTime;
            this.db.logExecucao('gerar_prolabore', 'sucesso', duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[Payroll] ❌ Erro ao gerar pró-labore: ${error.message}`);
            this.db.logExecucao('gerar_prolabore', 'erro', duration, error.message);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Gera relatório analítico de folha
     */
    async generateAnalyticalReport(params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                await this.login(page, credentials);

                // Navegar para relatórios
                await page.click('text=Relatórios');
                await page.click('text=Folha Analítica');
                await page.waitForTimeout(1000);

                // Configurar parâmetros do relatório
                await page.fill('input[name="mes_referencia"]', params.mes);
                
                if (params.formato) {
                    await page.selectOption('select[name="formato"]', params.formato);
                }

                // Gerar relatório
                await page.click('button:has-text("Gerar Relatório")');
                await page.waitForSelector('.relatorio-gerado', { timeout: 30000 });

                // Download se solicitado
                if (params.download) {
                    const downloadPromise = page.waitForEvent('download');
                    await page.click('button:has-text("Download")');
                    const download = await downloadPromise;
                    const filename = `Folha_Analitica_${params.mes}.${params.formato || 'pdf'}`;
                    await download.saveAs(`./downloads/${filename}`);
                }

                if (this.verbose) {
                    console.log(`[Payroll] ✅ Relatório analítico gerado`);
                }

                return {
                    success: true,
                    mes: params.mes,
                    formato: params.formato || 'pdf'
                };
            });

            const duration = Date.now() - startTime;
            this.db.logExecucao('relatorio_folha', 'sucesso', duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[Payroll] ❌ Erro ao gerar relatório: ${error.message}`);
            this.db.logExecucao('relatorio_folha', 'erro', duration, error.message);
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
    PayrollCalculator
};
