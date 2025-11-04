/**
 * eSocial Sender - Envio de Eventos do eSocial
 * 
 * Gera e envia eventos S-1200, S-1210, S-1299 e outros para o eSocial.
 */

const { retryBrowserOperation } = require("../../lib/retry.cjs");
const { getPool } = require("../../lib/browser-pool.cjs");
const { CalimaDatabase } = require("../../lib/database.cjs");

class ESocialSender {
    constructor(options = {}) {
        this.db = new CalimaDatabase();
        this.db.initialize();
        this.verbose = options.verbose || false;
    }

    /**
     * Gera evento S-1200 (Remuneração do trabalhador)
     */
    async generateS1200(params, credentials) {
        return await this.generateEvent('S-1200', params, credentials);
    }

    /**
     * Gera evento S-1210 (Pagamentos de rendimentos do trabalho)
     */
    async generateS1210(params, credentials) {
        return await this.generateEvent('S-1210', params, credentials);
    }

    /**
     * Gera evento S-1299 (Fechamento dos eventos periódicos)
     */
    async generateS1299(params, credentials) {
        return await this.generateEvent('S-1299', params, credentials);
    }

    /**
     * Função genérica para gerar eventos
     */
    async generateEvent(eventType, params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                await this.login(page, credentials);

                // Navegar para eSocial
                await page.click('text=eSocial');
                await page.waitForTimeout(1000);

                // Selecionar tipo de evento
                await page.click(`text=${eventType}`);
                await page.waitForTimeout(500);

                // Preencher parâmetros
                await page.fill('input[name="periodo"]', params.periodo);
                
                if (params.empresaId) {
                    await page.selectOption('select[name="empresa"]', params.empresaId);
                }

                // Gerar evento
                await page.click('button:has-text("Gerar Evento")');
                await page.waitForSelector('.evento-gerado', { timeout: 60000 });

                // Extrair informações do evento
                const eventoInfo = await page.evaluate(() => {
                    return {
                        protocolo: document.querySelector('#protocolo_evento')?.textContent || '',
                        status: document.querySelector('#status_evento')?.textContent || '',
                        dataGeracao: document.querySelector('#data_geracao')?.textContent || '',
                        trabalhadores: document.querySelectorAll('.trabalhador-item').length
                    };
                });

                if (this.verbose) {
                    console.log(`[eSocial] ✅ Evento ${eventType} gerado: ${eventoInfo.protocolo}`);
                }

                return {
                    success: true,
                    eventType,
                    periodo: params.periodo,
                    ...eventoInfo
                };
            });

            const duration = Date.now() - startTime;
            this.db.logExecucao(`esocial_${eventType.toLowerCase()}`, 'sucesso', duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[eSocial] ❌ Erro ao gerar ${eventType}: ${error.message}`);
            this.db.logExecucao(`esocial_${eventType.toLowerCase()}`, 'erro', duration, error.message);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Envia eventos gerados para o eSocial
     */
    async sendEvents(params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                await this.login(page, credentials);

                // Navegar para envio de eventos
                await page.click('text=eSocial');
                await page.click('text=Enviar Eventos');
                await page.waitForTimeout(1000);

                // Selecionar período
                await page.fill('input[name="periodo"]', params.periodo);

                // Selecionar eventos para envio
                if (params.eventos && params.eventos.length > 0) {
                    for (const evento of params.eventos) {
                        await page.check(`input[value="${evento}"]`);
                    }
                } else {
                    // Selecionar todos
                    await page.check('input[name="selecionar_todos"]');
                }

                // Enviar
                await page.click('button:has-text("Enviar ao eSocial")');
                await page.waitForSelector('.envio-concluido', { timeout: 120000 });

                // Extrair resultados do envio
                const resultadoEnvio = await page.evaluate(() => {
                    const sucessos = document.querySelectorAll('.evento-sucesso').length;
                    const erros = document.querySelectorAll('.evento-erro').length;
                    const avisos = document.querySelectorAll('.evento-aviso').length;
                    
                    return {
                        total: sucessos + erros + avisos,
                        sucessos,
                        erros,
                        avisos,
                        protocoloEnvio: document.querySelector('#protocolo_envio')?.textContent || ''
                    };
                });

                if (this.verbose) {
                    console.log(`[eSocial] ✅ Envio concluído: ${resultadoEnvio.sucessos} sucesso(s), ${resultadoEnvio.erros} erro(s)`);
                }

                return {
                    success: resultadoEnvio.erros === 0,
                    periodo: params.periodo,
                    ...resultadoEnvio
                };
            });

            const duration = Date.now() - startTime;
            const status = result.success ? 'sucesso' : 'erro';
            this.db.logExecucao('esocial_envio', status, duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[eSocial] ❌ Erro ao enviar eventos: ${error.message}`);
            this.db.logExecucao('esocial_envio', 'erro', duration, error.message);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Consulta status de eventos enviados
     */
    async checkEventStatus(params, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();
        const startTime = Date.now();

        try {
            const result = await retryBrowserOperation(async () => {
                await this.login(page, credentials);

                // Navegar para consulta
                await page.click('text=eSocial');
                await page.click('text=Consultar Status');
                await page.waitForTimeout(1000);

                // Buscar por protocolo
                if (params.protocolo) {
                    await page.fill('input[name="protocolo"]', params.protocolo);
                    await page.click('button:has-text("Consultar")');
                    await page.waitForSelector('.resultado-consulta', { timeout: 30000 });
                }

                // Extrair status
                const statusInfo = await page.evaluate(() => {
                    return {
                        protocolo: document.querySelector('#protocolo_consulta')?.textContent || '',
                        status: document.querySelector('#status_consulta')?.textContent || '',
                        dataProcessamento: document.querySelector('#data_processamento')?.textContent || '',
                        mensagens: Array.from(document.querySelectorAll('.mensagem-item')).map(el => el.textContent)
                    };
                });

                if (this.verbose) {
                    console.log(`[eSocial] ✅ Status: ${statusInfo.status}`);
                }

                return {
                    success: true,
                    ...statusInfo
                };
            });

            const duration = Date.now() - startTime;
            this.db.logExecucao('esocial_consulta', 'sucesso', duration);

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[eSocial] ❌ Erro ao consultar status: ${error.message}`);
            this.db.logExecucao('esocial_consulta', 'erro', duration, error.message);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Fluxo completo: gerar e enviar eventos do mês
     */
    async processMonthlyEvents(params, credentials) {
        const results = {
            periodo: params.periodo,
            eventos: []
        };

        try {
            // 1. Gerar S-1200
            console.log('[eSocial] 📝 Gerando S-1200...');
            const s1200 = await this.generateS1200(params, credentials);
            results.eventos.push({ tipo: 'S-1200', ...s1200 });

            // 2. Gerar S-1210
            console.log('[eSocial] 📝 Gerando S-1210...');
            const s1210 = await this.generateS1210(params, credentials);
            results.eventos.push({ tipo: 'S-1210', ...s1210 });

            // 3. Gerar S-1299
            console.log('[eSocial] 📝 Gerando S-1299...');
            const s1299 = await this.generateS1299(params, credentials);
            results.eventos.push({ tipo: 'S-1299', ...s1299 });

            // 4. Enviar todos os eventos
            console.log('[eSocial] 📤 Enviando eventos ao eSocial...');
            const envio = await this.sendEvents({
                periodo: params.periodo,
                eventos: ['S-1200', 'S-1210', 'S-1299']
            }, credentials);
            results.envio = envio;

            results.success = envio.success;
            
            if (this.verbose) {
                console.log(`[eSocial] ✅ Processamento mensal concluído`);
            }

            return results;

        } catch (error) {
            console.error(`[eSocial] ❌ Erro no processamento mensal: ${error.message}`);
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
    ESocialSender
};
