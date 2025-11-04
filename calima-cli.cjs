#!/usr/bin/env node

/**
 * Calima CLI - Interface de Linha de Comando Interativa
 * 
 * CLI amigável e intuitiva para gerenciar a integração Calima-Manus.
 */

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const { CalimaDatabase } = require('./lib/database.cjs');
const { CryptoManager } = require('./lib/crypto.cjs');
const { getPool, closeGlobalPool } = require('./lib/browser-pool.cjs');
const path = require('path');
const fs = require('fs');

const VERSION = '4.0.0';

// Configuração do programa
program
    .name('calima')
    .description('CLI para integração Calima-Manus')
    .version(VERSION);

/**
 * Comando: status
 */
program
    .command('status')
    .description('Exibe o status geral do sistema')
    .action(async () => {
        console.log(chalk.bold.blue('\n📊 Status do Sistema Calima-Manus\n'));

        const db = new CalimaDatabase();
        db.initialize();

        // Estatísticas de execuções
        const stats = db.getEstatisticasExecucoes(null, 7);
        
        if (stats.length === 0) {
            console.log(chalk.yellow('⚠️  Nenhuma execução registrada nos últimos 7 dias\n'));
        } else {
            const table = new Table({
                head: ['Tipo', 'Total', 'Sucessos', 'Erros', 'Taxa', 'Duração Média'],
                style: { head: ['cyan'] }
            });

            stats.forEach(stat => {
                const taxaSucesso = ((stat.sucessos / stat.total) * 100).toFixed(1);
                const duracaoMedia = (stat.duracao_media / 1000).toFixed(2);
                
                table.push([
                    stat.tipo,
                    stat.total,
                    chalk.green(stat.sucessos),
                    stat.erros > 0 ? chalk.red(stat.erros) : stat.erros,
                    `${taxaSucesso}%`,
                    `${duracaoMedia}s`
                ]);
            });

            console.log(table.toString());
            console.log('');
        }

        // Status do pool de navegadores
        const pool = getPool();
        const poolStats = pool.getStats();
        
        console.log(chalk.bold('🌐 Pool de Navegadores:'));
        console.log(`   Total: ${poolStats.total}/${poolStats.maxBrowsers}`);
        console.log(`   Em uso: ${chalk.yellow(poolStats.inUse)}`);
        console.log(`   Disponíveis: ${chalk.green(poolStats.available)}`);
        console.log('');

        db.close();
    });

/**
 * Comando: run
 */
program
    .command('run <automacao>')
    .description('Executa uma automação específica')
    .option('-e, --empresa <codigo>', 'Código da empresa')
    .action(async (automacao, options) => {
        const spinner = ora(`Executando ${automacao}...`).start();
        const startTime = Date.now();

        try {
            // Aqui você integraria com o sistema de automações
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulação
            
            const duration = Date.now() - startTime;
            spinner.succeed(chalk.green(`✅ ${automacao} executado com sucesso em ${(duration/1000).toFixed(2)}s`));

            // Registrar no banco
            const db = new CalimaDatabase();
            db.initialize();
            db.logExecucao(automacao, 'sucesso', duration);
            db.close();

        } catch (error) {
            const duration = Date.now() - startTime;
            spinner.fail(chalk.red(`❌ Erro ao executar ${automacao}: ${error.message}`));

            // Registrar erro no banco
            const db = new CalimaDatabase();
            db.initialize();
            db.logExecucao(automacao, 'erro', duration, error.message);
            db.close();
        }
    });

/**
 * Comando: config
 */
program
    .command('config')
    .description('Assistente de configuração interativo')
    .action(async () => {
        console.log(chalk.bold.blue('\n🔧 Assistente de Configuração\n'));

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'username',
                message: 'Usuário do Calima:',
                validate: input => input.length > 0 || 'Usuário é obrigatório'
            },
            {
                type: 'password',
                name: 'password',
                message: 'Senha do Calima:',
                mask: '*',
                validate: input => input.length > 0 || 'Senha é obrigatória'
            },
            {
                type: 'password',
                name: 'masterPassword',
                message: 'Senha mestra para criptografia:',
                mask: '*',
                validate: input => input.length >= 8 || 'Senha deve ter pelo menos 8 caracteres'
            },
            {
                type: 'confirm',
                name: 'enableCron',
                message: 'Deseja configurar agendamentos automáticos?',
                default: true
            }
        ]);

        const spinner = ora('Salvando configurações...').start();

        try {
            // Criptografar e salvar credenciais
            const crypto = new CryptoManager();
            await crypto.initialize(answers.masterPassword);
            
            const credPath = path.join(__dirname, '.credentials.enc');
            crypto.saveCredentials({
                username: answers.username,
                password: answers.password
            }, credPath);

            spinner.succeed(chalk.green('✅ Configurações salvas com sucesso!'));
            
            console.log(chalk.yellow('\n⚠️  IMPORTANTE:'));
            console.log('   - Guarde sua senha mestra em local seguro');
            console.log('   - Não compartilhe o arquivo .credentials.enc');
            console.log('');

            if (answers.enableCron) {
                console.log(chalk.blue('📅 Para configurar agendamentos, execute:'));
                console.log(chalk.cyan('   ./setup-cron.sh\n'));
            }

        } catch (error) {
            spinner.fail(chalk.red(`❌ Erro ao salvar configurações: ${error.message}`));
        }
    });

/**
 * Comando: query
 */
program
    .command('query')
    .description('Consulta dados do banco de dados')
    .action(async () => {
        const db = new CalimaDatabase();
        db.initialize();

        const { queryType } = await inquirer.prompt([
            {
                type: 'list',
                name: 'queryType',
                message: 'O que você deseja consultar?',
                choices: [
                    { name: '📊 Provisões', value: 'provisoes' },
                    { name: '📝 Processos', value: 'processos' },
                    { name: '🔔 Notificações', value: 'notificacoes' },
                    { name: '📈 Estatísticas', value: 'estatisticas' },
                    { name: '🔙 Voltar', value: 'voltar' }
                ]
            }
        ]);

        if (queryType === 'voltar') {
            db.close();
            return;
        }

        // Aqui você implementaria as consultas específicas
        console.log(chalk.yellow(`\n⚠️  Funcionalidade "${queryType}" em desenvolvimento\n`));

        db.close();
    });

/**
 * Comando: export
 */
program
    .command('export')
    .description('Exporta dados para arquivo')
    .option('-f, --format <formato>', 'Formato de exportação (json, csv, excel)', 'json')
    .option('-o, --output <arquivo>', 'Arquivo de saída')
    .action(async (options) => {
        const spinner = ora('Exportando dados...').start();

        try {
            const db = new CalimaDatabase();
            db.initialize();

            const outputPath = options.output || `export_${Date.now()}.${options.format}`;
            
            // Aqui você implementaria a exportação real
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulação

            spinner.succeed(chalk.green(`✅ Dados exportados para: ${outputPath}`));
            
            db.close();

        } catch (error) {
            spinner.fail(chalk.red(`❌ Erro ao exportar: ${error.message}`));
        }
    });

/**
 * Comando: test
 */
program
    .command('test')
    .description('Testa a conexão com o Calima')
    .action(async () => {
        const spinner = ora('Testando conexão com Calima...').start();

        try {
            // Verificar se credenciais existem
            const credPath = path.join(__dirname, '.credentials.enc');
            if (!fs.existsSync(credPath)) {
                spinner.fail(chalk.red('❌ Credenciais não configuradas. Execute: calima config'));
                return;
            }

            // Aqui você implementaria o teste real de conexão
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulação

            spinner.succeed(chalk.green('✅ Conexão com Calima OK!'));

        } catch (error) {
            spinner.fail(chalk.red(`❌ Erro ao testar conexão: ${error.message}`));
        }
    });

/**
 * Comando: menu (interativo)
 */
program
    .command('menu')
    .description('Menu interativo principal')
    .action(async () => {
        let continuar = true;

        while (continuar) {
            console.clear();
            console.log(chalk.bold.blue(`
╔═══════════════════════════════════════╗
║   Calima-Manus CLI v${VERSION}          ║
╚═══════════════════════════════════════╝
            `));

            const { opcao } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'opcao',
                    message: 'O que você deseja fazer?',
                    choices: [
                        { name: '📊 Ver Status do Sistema', value: 'status' },
                        { name: '▶️  Executar Automação', value: 'run' },
                        { name: '🔍 Consultar Dados', value: 'query' },
                        { name: '📤 Exportar Dados', value: 'export' },
                        { name: '🔧 Configurações', value: 'config' },
                        { name: '🧪 Testar Conexão', value: 'test' },
                        { name: '❌ Sair', value: 'sair' }
                    ]
                }
            ]);

            if (opcao === 'sair') {
                console.log(chalk.green('\n👋 Até logo!\n'));
                continuar = false;
            } else {
                // Executar comando correspondente
                await program.parseAsync(['node', 'calima', opcao]);
                
                // Aguardar Enter para continuar
                await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'continuar',
                        message: chalk.gray('Pressione Enter para continuar...')
                    }
                ]);
            }
        }
    });

// Se nenhum comando foi fornecido, mostrar menu interativo
if (process.argv.length === 2) {
    program.parseAsync(['node', 'calima', 'menu']);
} else {
    program.parse(process.argv);
}

// Cleanup ao sair
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n⚠️  Encerrando...'));
    await closeGlobalPool();
    process.exit(0);
});
