/**
 * Declarations Generator - Geração de Declarações Fiscais
 * 
 * Gera DCTF, ECF, EFD-Contribuições e DCTFWeb.
 */

const { retryBrowserOperation } = require("../../lib/retry.cjs");
const { getPool } = require("../../lib/browser-pool.cjs");
const { CalimaDatabase } = require("../../lib/database.cjs");

class DeclarationsGenerator {
    constructor(options = {}) {
        this.db = new CalimaDatabase();
        this.db.initialize();
        this.verbose = options.verbose || false;
    }

    /**
     * Gera DCTF (Declaração de Débitos e Créditos Tributários Federais)
     */
    async generateDCTF(params, credentials) {
        return await this.generateDeclaration('DCTF', params, credentials);
    }

    /**
     * Gera ECF (Escrituração Contábil Fiscal)
     */
    async generateECF(params, credentials) {
        return await this.generateDeclaration('ECF', params, credentials);
    }

    /**
     * Gera EFD-Contribuições
     */
    async generateEFDContribuicoes(params, credentials) {
        return await this.generateDeclaration('EFD-Contribuições', params, credentials);
    }

    /**
     * Gera DCTFWeb
     */
    async generateDCTFWeb(params, credentials) {
        return await this.generateDeclaration('DCTFWeb', params, credentials);
    }

    /**
     * Função genérica para geração de declarações
     */
    async generateDeclaration(declarationType, params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                await this.login(page, credentials);

                // Navegar para declarações
                await page.click('text=Declarações');
                await page.click(`text=${declarationType}`);
                await page.waitForTimeout(1000);

                // Preencher período
                await page.fill('input[name="periodo"]', params.periodo);
                
                if (params.empresaId) {
                    await page.selectOption('select[name="empresa"]', params.empresaId);
                }

                // Gerar declaração
                await page.click('button:has-text("Gerar Declaração")');
                await page.waitForSelector('.declaracao-gerada', { timeout: 120000 });

                // Extrair informações
                const declaracaoInfo = await page.evaluate(() => {
                    return {
                        protocolo: document.querySelector('#protocolo_declaracao')?.textContent || '',
                        status: document.querySelector('#status_declaracao')?.textContent || '',
                        dataGeracao: document.querySelector('#data_geracao')?.textContent || '',
                        tamanhoArquivo: document.querySelector('#tamanho_arquivo')?.textContent || ''
                    };
                });

                // Download do arquivo se solicitado
                if (params.download) {
                    const downloadPromise = page.waitForEvent('download');
                    await page.click('button:has-text("Download")');
                    const download = await downloadPromise;
                    const filename = `${declarationType.replace(/\s/g, '_')}_${params.periodo}.txt`;
                    await download.saveAs(`./downloads/${filename}`);
                }

                if (this.verbose) {
                    console.log(`[Declarations] ✅ ${declarationType} gerada: ${declaracaoInfo.protocolo}`);
                }

                return {
                    success: true,
                    tipo: declarationType,
                    periodo: params.periodo,
                    ...declaracaoInfo
                };
            });

            const duration = Date.now() - startTime;
            this.db.logExecucao(`declaracao_${declarationType.toLowerCase().replace(/\s/g, '_')}`, 'sucesso', duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[Declarations] ❌ Erro ao gerar ${declarationType}: ${error.message}`);
            this.db.logExecucao(`declaracao_${declarationType.toLowerCase().replace(/\s/g, '_')}`, 'erro', duration, error.message);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Transmite DCTFWeb para a Receita Federal
     */
    async transmitDCTFWeb(params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                await this.login(page, credentials);

                // Navegar para transmissão
                await page.click('text=Declarações');
                await page.click('text=DCTFWeb');
                await page.click('text=Transmitir');
                await page.waitForTimeout(1000);

                // Selecionar declaração
                await page.fill('input[name="periodo"]', params.periodo);

                // Transmitir
                await page.click('button:has-text("Transmitir à Receita Federal")');
                await page.waitForSelector('.transmissao-concluida', { timeout: 120000 });

                // Extrair resultado
                const transmissaoInfo = await page.evaluate(() => {
                    return {
                        protocolo: document.querySelector('#protocolo_transmissao')?.textContent || '',
                        status: document.querySelector('#status_transmissao')?.textContent || '',
                        dataTransmissao: document.querySelector('#data_transmissao')?.textContent || '',
                        recibo: document.querySelector('#numero_recibo')?.textContent || ''
                    };
                });

                if (this.verbose) {
                    console.log(`[Declarations] ✅ DCTFWeb transmitida: ${transmissaoInfo.recibo}`);
                }

                return {
                    success: true,
                    periodo: params.periodo,
                    ...transmissaoInfo
                };
            });

            const duration = Date.now() - startTime;
            this.db.logExecucao('transmissao_dctfweb', 'sucesso', duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[Declarations] ❌ Erro ao transmitir DCTFWeb: ${error.message}`);
            this.db.logExecucao('transmissao_dctfweb', 'erro', duration, error.message);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Valida declaração antes de transmitir
     */
    async validateDeclaration(declarationType, params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                await this.login(page, credentials);

                // Navegar para validação
                await page.click('text=Declarações');
                await page.click(`text=${declarationType}`);
                await page.click('text=Validar');
                await page.waitForTimeout(1000);

                // Selecionar declaração
                await page.fill('input[name="periodo"]', params.periodo);

                // Validar
                await page.click('button:has-text("Validar")');
                await page.waitForSelector('.validacao-concluida', { timeout: 60000 });

                // Extrair resultado
                const validacaoInfo = await page.evaluate(() => {
                    const erros = Array.from(document.querySelectorAll('.erro-item')).map(el => el.textContent);
                    const avisos = Array.from(document.querySelectorAll('.aviso-item')).map(el => el.textContent);
                    
                    return {
                        valida: erros.length === 0,
                        erros,
                        avisos,
                        totalErros: erros.length,
                        totalAvisos: avisos.length
                    };
                });

                if (this.verbose) {
                    const status = validacaoInfo.valida ? '✅ Válida' : '❌ Inválida';
                    console.log(`[Declarations] ${status}: ${validacaoInfo.totalErros} erro(s), ${validacaoInfo.totalAvisos} aviso(s)`);
                }

                return {
                    success: true,
                    tipo: declarationType,
                    periodo: params.periodo,
                    ...validacaoInfo
                };
            });

            const duration = Date.now() - startTime;
            this.db.logExecucao('validacao_declaracao', 'sucesso', duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[Declarations] ❌ Erro ao validar declaração: ${error.message}`);
            this.db.logExecucao('validacao_declaracao', 'erro', duration, error.message);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Fluxo completo: gerar, validar e transmitir DCTFWeb
     */
    async processDCTFWebComplete(params, credentials) {
        const results = {
            periodo: params.periodo,
            etapas: []
        };

        try {
            // 1. Gerar DCTFWeb
            console.log('[Declarations] 📝 Gerando DCTFWeb...');
            const geracao = await this.generateDCTFWeb(params, credentials);
            results.etapas.push({ etapa: 'geracao', ...geracao });

            // 2. Validar
            console.log('[Declarations] ✅ Validando DCTFWeb...');
            const validacao = await this.validateDeclaration('DCTFWeb', params, credentials);
            results.etapas.push({ etapa: 'validacao', ...validacao });

            if (!validacao.valida) {
                console.error('[Declarations] ❌ DCTFWeb contém erros. Transmissão cancelada.');
                results.success = false;
                results.error = 'Declaração contém erros de validação';
                return results;
            }

            // 3. Transmitir
            console.log('[Declarations] 📤 Transmitindo DCTFWeb...');
            const transmissao = await this.transmitDCTFWeb(params, credentials);
            results.etapas.push({ etapa: 'transmissao', ...transmissao });

            results.success = true;
            
            if (this.verbose) {
                console.log(`[Declarations] ✅ Processamento completo da DCTFWeb concluído`);
            }

            return results;

        } catch (error) {
            console.error(`[Declarations] ❌ Erro no processamento: ${error.message}`);
            results.success = false;
            results.error = error.message;
            return results;
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
    DeclarationsGenerator
};
