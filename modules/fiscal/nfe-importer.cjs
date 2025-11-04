/**
 * NF-e Importer - Importação de Notas Fiscais Eletrônicas
 * 
 * Processa e importa NF-e (XML) para o sistema Calima.
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { retryBrowserOperation } = require('../../lib/retry.cjs');
const { getPool } = require('../../lib/browser-pool.cjs');

class NFeImporter {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
    }

    /**
     * Parseia arquivo XML de NF-e
     */
    async parseXML(xmlPath) {
        const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
        const parser = new xml2js.Parser();
        
        try {
            const result = await parser.parseStringPromise(xmlContent);
            return this.extractNFeData(result);
        } catch (error) {
            throw new Error(`Erro ao parsear XML: ${error.message}`);
        }
    }

    /**
     * Extrai dados relevantes da NF-e
     */
    extractNFeData(xmlData) {
        try {
            const nfe = xmlData.nfeProc?.NFe?.[0]?.infNFe?.[0] || xmlData.NFe?.infNFe?.[0];
            
            if (!nfe) {
                throw new Error('Estrutura de NF-e inválida');
            }

            const ide = nfe.ide?.[0];
            const emit = nfe.emit?.[0];
            const dest = nfe.dest?.[0];
            const total = nfe.total?.[0]?.ICMSTot?.[0];
            const items = nfe.det || [];

            return {
                chaveAcesso: nfe.$.Id?.replace('NFe', ''),
                numero: ide?.nNF?.[0],
                serie: ide?.serie?.[0],
                dataEmissao: ide?.dhEmi?.[0] || ide?.dEmi?.[0],
                emitente: {
                    cnpj: emit?.CNPJ?.[0],
                    razaoSocial: emit?.xNome?.[0],
                    ie: emit?.IE?.[0]
                },
                destinatario: {
                    cnpj: dest?.CNPJ?.[0] || dest?.CPF?.[0],
                    razaoSocial: dest?.xNome?.[0],
                    ie: dest?.IE?.[0]
                },
                valores: {
                    total: parseFloat(total?.vNF?.[0] || 0),
                    baseICMS: parseFloat(total?.vBC?.[0] || 0),
                    icms: parseFloat(total?.vICMS?.[0] || 0),
                    ipi: parseFloat(total?.vIPI?.[0] || 0),
                    pis: parseFloat(total?.vPIS?.[0] || 0),
                    cofins: parseFloat(total?.vCOFINS?.[0] || 0)
                },
                itens: items.map((item, index) => {
                    const prod = item.prod?.[0];
                    const imposto = item.imposto?.[0];
                    
                    return {
                        numero: index + 1,
                        codigo: prod?.cProd?.[0],
                        descricao: prod?.xProd?.[0],
                        ncm: prod?.NCM?.[0],
                        cfop: prod?.CFOP?.[0],
                        unidade: prod?.uCom?.[0],
                        quantidade: parseFloat(prod?.qCom?.[0] || 0),
                        valorUnitario: parseFloat(prod?.vUnCom?.[0] || 0),
                        valorTotal: parseFloat(prod?.vProd?.[0] || 0)
                    };
                })
            };
        } catch (error) {
            throw new Error(`Erro ao extrair dados da NF-e: ${error.message}`);
        }
    }

    /**
     * Importa NF-e para o Calima
     */
    async importToCalima(nfeData, credentials) {
        const { browser, sessionId } = await getPool().acquire();
        const page = await browser.newPage();

        try {
            await retryBrowserOperation(async () => {
                // Login no Calima
                await page.goto('https://www.calima.app/');
                await page.fill('input[name="username"]', credentials.username);
                await page.fill('input[name="password"]', credentials.password);
                await page.click('button[type="submit"]');
                await page.waitForURL('**/dashboard', { timeout: 30000 });

                // Navegar para importação de NF-e
                await page.click('text=Processos');
                await page.click('text=Importação');
                await page.click('text=Nota Fiscal de Entrada');

                // Preencher formulário
                await page.fill('input[name="chave_acesso"]', nfeData.chaveAcesso);
                await page.fill('input[name="numero"]', nfeData.numero);
                await page.fill('input[name="serie"]', nfeData.serie);
                await page.fill('input[name="data_emissao"]', nfeData.dataEmissao.split('T')[0]);

                // Emitente
                await page.fill('input[name="emitente_cnpj"]', nfeData.emitente.cnpj);
                await page.fill('input[name="emitente_razao"]', nfeData.emitente.razaoSocial);

                // Valores
                await page.fill('input[name="valor_total"]', nfeData.valores.total.toFixed(2));
                await page.fill('input[name="valor_icms"]', nfeData.valores.icms.toFixed(2));
                await page.fill('input[name="valor_ipi"]', nfeData.valores.ipi.toFixed(2));
                await page.fill('input[name="valor_pis"]', nfeData.valores.pis.toFixed(2));
                await page.fill('input[name="valor_cofins"]', nfeData.valores.cofins.toFixed(2));

                // Confirmar importação
                await page.click('button[type="submit"]');
                await page.waitForSelector('text=Importação realizada com sucesso', { timeout: 10000 });

                if (this.verbose) {
                    console.log(`[NFe] ✅ NF-e ${nfeData.numero} importada com sucesso`);
                }
            });

            return {
                success: true,
                nfeNumero: nfeData.numero,
                chaveAcesso: nfeData.chaveAcesso
            };

        } catch (error) {
            console.error(`[NFe] ❌ Erro ao importar NF-e: ${error.message}`);
            throw error;
        } finally {
            await page.close();
            await getPool().release(sessionId);
        }
    }

    /**
     * Importa múltiplas NF-e de um diretório
     */
    async importBatch(directory, credentials) {
        const files = fs.readdirSync(directory).filter(f => f.endsWith('.xml'));
        const results = [];

        console.log(`[NFe] 📦 Encontradas ${files.length} NF-e para importar`);

        for (const file of files) {
            try {
                const xmlPath = path.join(directory, file);
                const nfeData = await this.parseXML(xmlPath);
                const result = await this.importToCalima(nfeData, credentials);
                
                results.push({
                    file,
                    ...result
                });

                console.log(`[NFe] ✅ ${file} - Importado`);
            } catch (error) {
                console.error(`[NFe] ❌ ${file} - Erro: ${error.message}`);
                results.push({
                    file,
                    success: false,
                    error: error.message
                });
            }
        }

        const sucessos = results.filter(r => r.success).length;
        const falhas = results.filter(r => !r.success).length;

        console.log(`\n[NFe] 📊 Resumo: ${sucessos} sucesso(s), ${falhas} falha(s)`);

        return results;
    }

    /**
     * Valida XML de NF-e
     */
    async validateXML(xmlPath) {
        try {
            const nfeData = await this.parseXML(xmlPath);
            
            const errors = [];

            if (!nfeData.chaveAcesso || nfeData.chaveAcesso.length !== 44) {
                errors.push('Chave de acesso inválida');
            }

            if (!nfeData.numero) {
                errors.push('Número da NF-e não encontrado');
            }

            if (!nfeData.emitente.cnpj) {
                errors.push('CNPJ do emitente não encontrado');
            }

            if (nfeData.valores.total <= 0) {
                errors.push('Valor total inválido');
            }

            return {
                valid: errors.length === 0,
                errors,
                data: nfeData
            };

        } catch (error) {
            return {
                valid: false,
                errors: [error.message]
            };
        }
    }
}

module.exports = {
    NFeImporter
};
