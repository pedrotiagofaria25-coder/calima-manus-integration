#!/usr/bin/env node

/**
 * Script de Processamento em Lote - Cliente Luiz
 * LFG CONSULTORIA IMOBILIARIA LTDA (CNPJ: 51.200.940/0001-65)
 * 
 * Processa automaticamente todas as pendências de 2024.
 */

const { PayrollCalculator } = require('../modules/payroll/calculator.cjs');
const { ESocialSender } = require('../modules/esocial/sender.cjs');
const { DeclarationsGenerator } = require('../modules/declarations/generator.cjs');
const { CryptoManager } = require('../lib/crypto.cjs');
const inquirer = require('inquirer');
const ora = require('ora');
const chalk = require('chalk');

console.log(chalk.blue.bold('\n🚀 Processamento em Lote - Cliente Luiz\n'));
console.log(chalk.cyan('Cliente: LFG CONSULTORIA IMOBILIARIA LTDA'));
console.log(chalk.cyan('CNPJ: 51.200.940/0001-65'));
console.log(chalk.cyan('Período: Janeiro a Dezembro/2024\n'));

async function main() {
    // Solicitar senha mestra
    const { masterPassword } = await inquirer.prompt([
        {
            type: 'password',
            name: 'masterPassword',
            message: 'Senha mestra:',
            mask: '*'
        }
    ]);

    // Descriptografar credenciais
    const crypto = new CryptoManager();
    let credentials;
    
    try {
        credentials = crypto.decryptCredentials(masterPassword);
    } catch (error) {
        console.error(chalk.red('\n❌ Erro ao descriptografar credenciais. Verifique sua senha mestra.\n'));
        process.exit(1);
    }

    // Confirmar execução
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Deseja processar TODOS os 12 meses de 2024?',
            default: false
        }
    ]);

    if (!confirm) {
        console.log(chalk.yellow('\n⚠️  Operação cancelada pelo usuário.\n'));
        process.exit(0);
    }

    const meses = [
        '01/2024', '02/2024', '03/2024', '04/2024',
        '05/2024', '06/2024', '07/2024', '08/2024',
        '09/2024', '10/2024', '11/2024', '12/2024'
    ];

    const payroll = new PayrollCalculator({ verbose: false });
    const esocial = new ESocialSender({ verbose: false });
    const declarations = new DeclarationsGenerator({ verbose: false });

    const resultados = {
        folhas: [],
        gps: [],
        esocial: [],
        dctfweb: [],
        erros: []
    };

    console.log(chalk.blue('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.blue('📊 Iniciando Processamento'));
    console.log(chalk.blue('═══════════════════════════════════════════════════════════════\n'));

    for (const mes of meses) {
        console.log(chalk.yellow(`\n🔄 Processando ${mes}...\n`));

        // 1. Calcular Folha
        const spinnerFolha = ora(`Calculando folha de ${mes}...`).start();
        try {
            const resultFolha = await payroll.calculateMonthly({ mes }, credentials);
            spinnerFolha.succeed(`Folha de ${mes} calculada`);
            resultados.folhas.push({ mes, success: true, data: resultFolha });
        } catch (error) {
            spinnerFolha.fail(`Erro ao calcular folha de ${mes}`);
            resultados.erros.push({ mes, etapa: 'folha', error: error.message });
            continue; // Pula para o próximo mês
        }

        // 2. Gerar GPS
        const spinnerGPS = ora(`Gerando GPS de ${mes}...`).start();
        try {
            const resultGPS = await payroll.generateGPS({ mes, downloadPDF: true }, credentials);
            spinnerGPS.succeed(`GPS de ${mes} gerada`);
            resultados.gps.push({ mes, success: true, data: resultGPS });
        } catch (error) {
            spinnerGPS.fail(`Erro ao gerar GPS de ${mes}`);
            resultados.erros.push({ mes, etapa: 'gps', error: error.message });
        }

        // 3. Processar eSocial
        const spinnerESocial = ora(`Processando eventos do eSocial de ${mes}...`).start();
        try {
            const resultESocial = await esocial.processMonthlyEvents({ periodo: mes }, credentials);
            spinnerESocial.succeed(`Eventos do eSocial de ${mes} processados`);
            resultados.esocial.push({ mes, success: true, data: resultESocial });
        } catch (error) {
            spinnerESocial.fail(`Erro ao processar eSocial de ${mes}`);
            resultados.erros.push({ mes, etapa: 'esocial', error: error.message });
        }

        // 4. Gerar DCTFWeb
        const spinnerDCTF = ora(`Gerando DCTFWeb de ${mes}...`).start();
        try {
            const resultDCTF = await declarations.processDCTFWebComplete({ periodo: mes }, credentials);
            spinnerDCTF.succeed(`DCTFWeb de ${mes} gerada`);
            resultados.dctfweb.push({ mes, success: true, data: resultDCTF });
        } catch (error) {
            spinnerDCTF.fail(`Erro ao gerar DCTFWeb de ${mes}`);
            resultados.erros.push({ mes, etapa: 'dctfweb', error: error.message });
        }

        // Aguardar 2 segundos entre os meses para não sobrecarregar o sistema
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Fechar conexões
    payroll.close();
    esocial.close();
    declarations.close();

    // Exibir resumo
    console.log(chalk.blue('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.blue('📊 RESUMO DO PROCESSAMENTO'));
    console.log(chalk.blue('═══════════════════════════════════════════════════════════════\n'));

    console.log(chalk.green(`✅ Folhas calculadas: ${resultados.folhas.filter(r => r.success).length}/12`));
    console.log(chalk.green(`✅ GPS geradas: ${resultados.gps.filter(r => r.success).length}/12`));
    console.log(chalk.green(`✅ eSocial processado: ${resultados.esocial.filter(r => r.success).length}/12`));
    console.log(chalk.green(`✅ DCTFWeb geradas: ${resultados.dctfweb.filter(r => r.success).length}/12`));
    
    if (resultados.erros.length > 0) {
        console.log(chalk.red(`\n❌ Erros: ${resultados.erros.length}`));
        console.log(chalk.yellow('\nDetalhes dos erros:'));
        resultados.erros.forEach(erro => {
            console.log(chalk.red(`  • ${erro.mes} (${erro.etapa}): ${erro.error}`));
        });
    }

    // Salvar relatório
    const fs = require('fs');
    const relatorio = {
        cliente: 'LFG CONSULTORIA IMOBILIARIA LTDA',
        cnpj: '51.200.940/0001-65',
        periodo: '2024',
        data_processamento: new Date().toISOString(),
        resultados
    };

    fs.writeFileSync(
        `/home/ubuntu/calima-manus-mcp/relatorios/processamento_luiz_${Date.now()}.json`,
        JSON.stringify(relatorio, null, 2)
    );

    console.log(chalk.blue('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.green('✅ PROCESSAMENTO CONCLUÍDO'));
    console.log(chalk.blue('═══════════════════════════════════════════════════════════════\n'));
}

main().catch(error => {
    console.error(chalk.red(`\n❌ Erro fatal: ${error.message}\n`));
    process.exit(1);
});
