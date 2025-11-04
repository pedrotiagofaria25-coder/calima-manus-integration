#!/usr/bin/env node

/**
 * Calima CLI v5.0 - Interface de Linha de Comando Completa
 * 
 * CLI interativa para automação completa do Calima ERP.
 */

const { Command } = require('commander');
const inquirer = require('inquirer');
const ora = require('ora');
const chalk = require('chalk');
const { CryptoManager } = require('./lib/crypto.cjs');
const { NFeImporter } = require('./modules/fiscal/nfe-importer.cjs');
const { PayrollCalculator } = require('./modules/payroll/calculator.cjs');
const { ESocialSender } = require('./modules/esocial/sender.cjs');
const { TaxCalculator } = require('./modules/tax/calculator.cjs');
const { DeclarationsGenerator } = require('./modules/declarations/generator.cjs');

const program = new Command();
const crypto = new CryptoManager();

// Configuração do programa
program
    .name('calima-cli')
    .description('CLI para automação completa do Calima ERP')
    .version('5.0.0');

// ============================================================================
// COMANDOS DE CONFIGURAÇÃO
// ============================================================================

program
    .command('config')
    .description('Configurar credenciais criptografadas')
    .action(async () => {
        console.log(chalk.blue.bold('\n🔐 Configuração de Credenciais\n'));

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'username',
                message: 'Usuário do Calima:',
                validate: (input) => input.length > 0 || 'Usuário é obrigatório'
            },
            {
                type: 'password',
                name: 'password',
                message: 'Senha do Calima:',
                mask: '*',
                validate: (input) => input.length > 0 || 'Senha é obrigatória'
            },
            {
                type: 'password',
                name: 'masterPassword',
                message: 'Senha mestra (para criptografia):',
                mask: '*',
                validate: (input) => input.length >= 8 || 'Senha mestra deve ter no mínimo 8 caracteres'
            }
        ]);

        const spinner = ora('Criptografando credenciais...').start();

        try {
            crypto.encryptCredentials(
                { username: answers.username, password: answers.password },
                answers.masterPassword
            );
            spinner.succeed('Credenciais configuradas com sucesso!');
            console.log(chalk.green('\n✅ Você já pode usar todos os comandos do Calima CLI.\n'));
        } catch (error) {
            spinner.fail(`Erro ao configurar: ${error.message}`);
        }
    });

// ============================================================================
// COMANDOS DE DOCUMENTOS FISCAIS
// ============================================================================

program
    .command('nfe:importar <diretorio>')
    .description('Importar NF-e de um diretório')
    .action(async (diretorio) => {
        const credentials = await getCredentials();
        const spinner = ora('Importando NF-e...').start();

        try {
            const importer = new NFeImporter({ verbose: true });
            const results = await importer.importBatch(diretorio, credentials);
            
            spinner.succeed(`Importação concluída!`);
            console.log(chalk.green(`\n✅ ${results.filter(r => r.success).length} NF-e importadas com sucesso`));
            console.log(chalk.red(`❌ ${results.filter(r => !r.success).length} falhas\n`));
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

program
    .command('nfe:validar <arquivo>')
    .description('Validar arquivo XML de NF-e')
    .action(async (arquivo) => {
        const spinner = ora('Validando NF-e...').start();

        try {
            const importer = new NFeImporter();
            const validation = await importer.validateXML(arquivo);
            
            if (validation.valid) {
                spinner.succeed('NF-e válida!');
                console.log(chalk.green(`\n✅ Chave: ${validation.data.chaveAcesso}`));
                console.log(chalk.green(`✅ Número: ${validation.data.numero}`));
                console.log(chalk.green(`✅ Valor: R$ ${validation.data.valores.total.toFixed(2)}\n`));
            } else {
                spinner.fail('NF-e inválida!');
                console.log(chalk.red(`\n❌ Erros encontrados:`));
                validation.errors.forEach(err => console.log(chalk.red(`   - ${err}`)));
                console.log();
            }
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

// ============================================================================
// COMANDOS DE FOLHA DE PAGAMENTO
// ============================================================================

program
    .command('folha:calcular <mes>')
    .description('Calcular folha de pagamento (formato: MM/AAAA)')
    .option('-e, --empresa <id>', 'ID da empresa')
    .action(async (mes, options) => {
        const credentials = await getCredentials();
        const spinner = ora('Calculando folha de pagamento...').start();

        try {
            const payroll = new PayrollCalculator({ verbose: true });
            const result = await payroll.calculateMonthly({ mes, empresaId: options.empresa }, credentials);
            
            spinner.succeed('Folha calculada!');
            console.log(chalk.green(`\n✅ Mês: ${result.mes}`));
            console.log(chalk.green(`✅ Funcionários: ${result.funcionarios}`));
            console.log(chalk.green(`✅ Total Proventos: ${result.totalProventos}`));
            console.log(chalk.green(`✅ Total Descontos: ${result.totalDescontos}`));
            console.log(chalk.green(`✅ Total Líquido: ${result.totalLiquido}\n`));
            
            payroll.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

program
    .command('folha:gps <mes>')
    .description('Gerar GPS (formato: MM/AAAA)')
    .option('-e, --empresa <id>', 'ID da empresa')
    .option('-d, --download', 'Fazer download do PDF')
    .action(async (mes, options) => {
        const credentials = await getCredentials();
        const spinner = ora('Gerando GPS...').start();

        try {
            const payroll = new PayrollCalculator({ verbose: true });
            const result = await payroll.generateGPS({ 
                mes, 
                empresaId: options.empresa,
                downloadPDF: options.download
            }, credentials);
            
            spinner.succeed('GPS gerada!');
            console.log(chalk.green(`\n✅ Código GPS: ${result.codigoGPS}`));
            console.log(chalk.green(`✅ Valor INSS: ${result.valorINSS}`));
            console.log(chalk.green(`✅ Vencimento: ${result.vencimento}\n`));
            
            payroll.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

program
    .command('folha:prolabore <mes>')
    .description('Gerar recibos de pró-labore (formato: MM/AAAA)')
    .option('-s, --socio <id>', 'ID do sócio')
    .action(async (mes, options) => {
        const credentials = await getCredentials();
        const spinner = ora('Gerando recibos de pró-labore...').start();

        try {
            const payroll = new PayrollCalculator({ verbose: true });
            const result = await payroll.generateProlabore({ mes, socioId: options.socio }, credentials);
            
            spinner.succeed('Recibos gerados!');
            console.log(chalk.green(`\n✅ ${result.recibosGerados} recibo(s) gerado(s)\n`));
            
            payroll.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

// ============================================================================
// COMANDOS DE eSocial
// ============================================================================

program
    .command('esocial:gerar <tipo> <periodo>')
    .description('Gerar evento do eSocial (S-1200, S-1210, S-1299)')
    .option('-e, --empresa <id>', 'ID da empresa')
    .action(async (tipo, periodo, options) => {
        const credentials = await getCredentials();
        const spinner = ora(`Gerando evento ${tipo}...`).start();

        try {
            const esocial = new ESocialSender({ verbose: true });
            let result;

            if (tipo === 'S-1200') {
                result = await esocial.generateS1200({ periodo, empresaId: options.empresa }, credentials);
            } else if (tipo === 'S-1210') {
                result = await esocial.generateS1210({ periodo, empresaId: options.empresa }, credentials);
            } else if (tipo === 'S-1299') {
                result = await esocial.generateS1299({ periodo, empresaId: options.empresa }, credentials);
            } else {
                throw new Error('Tipo de evento inválido. Use: S-1200, S-1210 ou S-1299');
            }
            
            spinner.succeed(`Evento ${tipo} gerado!`);
            console.log(chalk.green(`\n✅ Protocolo: ${result.protocolo}`));
            console.log(chalk.green(`✅ Status: ${result.status}`));
            console.log(chalk.green(`✅ Trabalhadores: ${result.trabalhadores}\n`));
            
            esocial.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

program
    .command('esocial:enviar <periodo>')
    .description('Enviar eventos ao eSocial')
    .option('-e, --eventos <eventos...>', 'Eventos específicos (S-1200, S-1210, S-1299)')
    .action(async (periodo, options) => {
        const credentials = await getCredentials();
        const spinner = ora('Enviando eventos ao eSocial...').start();

        try {
            const esocial = new ESocialSender({ verbose: true });
            const result = await esocial.sendEvents({ periodo, eventos: options.eventos }, credentials);
            
            spinner.succeed('Envio concluído!');
            console.log(chalk.green(`\n✅ Total: ${result.total}`));
            console.log(chalk.green(`✅ Sucessos: ${result.sucessos}`));
            console.log(chalk.red(`❌ Erros: ${result.erros}`));
            console.log(chalk.yellow(`⚠️  Avisos: ${result.avisos}`));
            console.log(chalk.green(`✅ Protocolo: ${result.protocoloEnvio}\n`));
            
            esocial.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

program
    .command('esocial:mensal <periodo>')
    .description('Processar eventos mensais completos (gerar + enviar)')
    .option('-e, --empresa <id>', 'ID da empresa')
    .action(async (periodo, options) => {
        const credentials = await getCredentials();
        const spinner = ora('Processando eventos mensais do eSocial...').start();

        try {
            const esocial = new ESocialSender({ verbose: true });
            const result = await esocial.processMonthlyEvents({ periodo, empresaId: options.empresa }, credentials);
            
            if (result.success) {
                spinner.succeed('Processamento mensal concluído!');
                console.log(chalk.green(`\n✅ Todos os eventos foram gerados e enviados com sucesso\n`));
            } else {
                spinner.fail('Processamento concluído com erros');
                console.log(chalk.red(`\n❌ Erro: ${result.error}\n`));
            }
            
            esocial.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

// ============================================================================
// COMANDOS DE TRIBUTOS
// ============================================================================

program
    .command('tributos:pis <periodo>')
    .description('Apurar PIS (formato: MM/AAAA)')
    .option('-e, --empresa <id>', 'ID da empresa')
    .action(async (periodo, options) => {
        const credentials = await getCredentials();
        const spinner = ora('Apurando PIS...').start();

        try {
            const tax = new TaxCalculator({ verbose: true });
            const result = await tax.calculatePIS({ periodo, empresaId: options.empresa }, credentials);
            
            spinner.succeed('PIS apurado!');
            console.log(chalk.green(`\n✅ Base de Cálculo: ${result.baseCalculo}`));
            console.log(chalk.green(`✅ Alíquota: ${result.aliquota}`));
            console.log(chalk.green(`✅ Valor a Pagar: ${result.valorPagar}`));
            console.log(chalk.green(`✅ Vencimento: ${result.vencimento}\n`));
            
            tax.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

program
    .command('tributos:cofins <periodo>')
    .description('Apurar COFINS (formato: MM/AAAA)')
    .option('-e, --empresa <id>', 'ID da empresa')
    .action(async (periodo, options) => {
        const credentials = await getCredentials();
        const spinner = ora('Apurando COFINS...').start();

        try {
            const tax = new TaxCalculator({ verbose: true });
            const result = await tax.calculateCOFINS({ periodo, empresaId: options.empresa }, credentials);
            
            spinner.succeed('COFINS apurado!');
            console.log(chalk.green(`\n✅ Base de Cálculo: ${result.baseCalculo}`));
            console.log(chalk.green(`✅ Alíquota: ${result.aliquota}`));
            console.log(chalk.green(`✅ Valor a Pagar: ${result.valorPagar}`));
            console.log(chalk.green(`✅ Vencimento: ${result.vencimento}\n`));
            
            tax.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

program
    .command('tributos:mensal <periodo>')
    .description('Apurar todos os tributos mensais (PIS + COFINS + ISS)')
    .option('-e, --empresa <id>', 'ID da empresa')
    .action(async (periodo, options) => {
        const credentials = await getCredentials();
        const spinner = ora('Apurando tributos mensais...').start();

        try {
            const tax = new TaxCalculator({ verbose: true });
            const result = await tax.calculateMonthlyTaxes({ periodo, empresaId: options.empresa }, credentials);
            
            spinner.succeed('Apuração mensal concluída!');
            console.log(chalk.green(`\n✅ Total a Pagar: R$ ${result.totalDevido.toFixed(2)}\n`));
            
            result.tributos.forEach(t => {
                console.log(chalk.blue(`${t.tributo}: ${t.valorPagar}`));
            });
            console.log();
            
            tax.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

program
    .command('tributos:trimestral <periodo>')
    .description('Apurar tributos trimestrais (IRPJ + CSLL)')
    .option('-e, --empresa <id>', 'ID da empresa')
    .action(async (periodo, options) => {
        const credentials = await getCredentials();
        const spinner = ora('Apurando tributos trimestrais...').start();

        try {
            const tax = new TaxCalculator({ verbose: true });
            const result = await tax.calculateQuarterlyTaxes({ periodo, empresaId: options.empresa }, credentials);
            
            spinner.succeed('Apuração trimestral concluída!');
            console.log(chalk.green(`\n✅ Total a Pagar: R$ ${result.totalDevido.toFixed(2)}\n`));
            
            result.tributos.forEach(t => {
                console.log(chalk.blue(`${t.tributo}: ${t.valorPagar}`));
            });
            console.log();
            
            tax.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

// ============================================================================
// COMANDOS DE DECLARAÇÕES
// ============================================================================

program
    .command('declaracao:dctf <periodo>')
    .description('Gerar DCTF')
    .option('-e, --empresa <id>', 'ID da empresa')
    .option('-d, --download', 'Fazer download do arquivo')
    .action(async (periodo, options) => {
        const credentials = await getCredentials();
        const spinner = ora('Gerando DCTF...').start();

        try {
            const declarations = new DeclarationsGenerator({ verbose: true });
            const result = await declarations.generateDCTF({ 
                periodo, 
                empresaId: options.empresa,
                download: options.download
            }, credentials);
            
            spinner.succeed('DCTF gerada!');
            console.log(chalk.green(`\n✅ Protocolo: ${result.protocolo}`));
            console.log(chalk.green(`✅ Status: ${result.status}\n`));
            
            declarations.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

program
    .command('declaracao:dctfweb <periodo>')
    .description('Processar DCTFWeb completo (gerar + validar + transmitir)')
    .option('-e, --empresa <id>', 'ID da empresa')
    .action(async (periodo, options) => {
        const credentials = await getCredentials();
        const spinner = ora('Processando DCTFWeb...').start();

        try {
            const declarations = new DeclarationsGenerator({ verbose: true });
            const result = await declarations.processDCTFWebComplete({ periodo, empresaId: options.empresa }, credentials);
            
            if (result.success) {
                spinner.succeed('DCTFWeb processada e transmitida!');
                console.log(chalk.green(`\n✅ Processamento completo concluído\n`));
            } else {
                spinner.fail('Erro no processamento');
                console.log(chalk.red(`\n❌ ${result.error}\n`));
            }
            
            declarations.close();
        } catch (error) {
            spinner.fail(`Erro: ${error.message}`);
        }
    });

// ============================================================================
// MENU INTERATIVO
// ============================================================================

program
    .command('menu')
    .description('Menu interativo com todas as opções')
    .action(async () => {
        const mainMenu = async () => {
            const { categoria } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'categoria',
                    message: 'Escolha uma categoria:',
                    choices: [
                        { name: '📄 Documentos Fiscais', value: 'fiscal' },
                        { name: '👥 Folha de Pagamento', value: 'folha' },
                        { name: '📊 eSocial', value: 'esocial' },
                        { name: '💰 Tributos', value: 'tributos' },
                        { name: '📝 Declarações', value: 'declaracoes' },
                        { name: '⚙️  Configurações', value: 'config' },
                        { name: '🚪 Sair', value: 'sair' }
                    ]
                }
            ]);

            if (categoria === 'sair') {
                console.log(chalk.blue('\n👋 Até logo!\n'));
                return;
            }

            // Implementar submenus para cada categoria
            console.log(chalk.yellow(`\n⚠️  Submenu de ${categoria} em desenvolvimento...\n`));
            await mainMenu();
        };

        console.log(chalk.blue.bold('\n🚀 Calima CLI v5.0 - Menu Interativo\n'));
        await mainMenu();
    });

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

async function getCredentials() {
    const { masterPassword } = await inquirer.prompt([
        {
            type: 'password',
            name: 'masterPassword',
            message: 'Senha mestra:',
            mask: '*'
        }
    ]);

    try {
        return crypto.decryptCredentials(masterPassword);
    } catch (error) {
        console.error(chalk.red('\n❌ Erro ao descriptografar credenciais. Verifique sua senha mestra.\n'));
        process.exit(1);
    }
}

// ============================================================================
// EXECUTAR CLI
// ============================================================================

program.parse();
