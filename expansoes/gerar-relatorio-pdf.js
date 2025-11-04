#!/usr/bin/env node

/**
 * Gerador de Relatórios PDF - Expansão Calima-Manus
 * 
 * Este módulo gera relatórios contábeis em PDF a partir dos dados extraídos.
 * 
 * Uso:
 *   node gerar-relatorio-pdf.js [tipo] [periodo]
 * 
 * Exemplos:
 *   node gerar-relatorio-pdf.js provisoes 2025-11
 *   node gerar-relatorio-pdf.js processos 2025-11
 *   node gerar-relatorio-pdf.js completo 2025-11
 */

const fs = require('fs');
const path = require('path');

// Verificar se puppeteer está instalado
let puppeteer;
try {
    puppeteer = require('puppeteer');
} catch (e) {
    console.log('❌ Puppeteer não está instalado.');
    console.log('Para instalar, execute: npm install puppeteer');
    process.exit(1);
}

const DADOS_DIR = path.join(__dirname, '..', 'dados_extraidos');
const RELATORIOS_DIR = path.join(__dirname, '..', 'relatorios');

// Criar diretório de relatórios se não existir
if (!fs.existsSync(RELATORIOS_DIR)) {
    fs.mkdirSync(RELATORIOS_DIR, { recursive: true });
}

/**
 * Gera HTML para relatório de provisões
 */
function gerarHTMLProvisoes(dados, periodo) {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório de Provisões - ${periodo}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #333;
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        .info {
            background-color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #bdc3c7;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #3498db;
            color: white;
        }
        tr:nth-child(even) {
            background-color: #f2f2f2;
        }
        .valor {
            text-align: right;
            font-weight: bold;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #7f8c8d;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <h1>Relatório de Provisões</h1>
    
    <div class="info">
        <p><strong>Período:</strong> ${periodo}</p>
        <p><strong>Empresa:</strong> ${dados.empresa || 'LFG CONSULTORIA IMOBILIARIA LTDA'}</p>
        <p><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    </div>

    <h2>Provisões do Mês</h2>
    <table>
        <thead>
            <tr>
                <th>Tipo de Provisão</th>
                <th>Valor (R$)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Provisão de Férias</td>
                <td class="valor">${dados.provisaoFerias || '0,00'}</td>
            </tr>
            <tr>
                <td>Provisão de 13º Salário</td>
                <td class="valor">${dados.provisao13 || '0,00'}</td>
            </tr>
            <tr>
                <td>Provisão INSS</td>
                <td class="valor">${dados.provisaoINSS || '0,00'}</td>
            </tr>
            <tr>
                <td>Provisão FGTS</td>
                <td class="valor">${dados.provisaoFGTS || '0,00'}</td>
            </tr>
        </tbody>
    </table>

    <div class="footer">
        <p>Relatório gerado automaticamente pelo sistema Calima-Manus</p>
        <p>© ${new Date().getFullYear()} - Todos os direitos reservados</p>
    </div>
</body>
</html>
    `;
}

/**
 * Gera PDF a partir de HTML
 */
async function gerarPDF(html, caminhoSaida) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html);

    await page.pdf({
        path: caminhoSaida,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
        }
    });

    await browser.close();
}

/**
 * Função principal
 */
async function main() {
    const args = process.argv.slice(2);
    const tipo = args[0] || 'provisoes';
    const periodo = args[1] || new Date().toISOString().slice(0, 7);

    console.log('\n========================================');
    console.log('GERADOR DE RELATÓRIOS PDF');
    console.log('========================================\n');

    console.log(`📄 Tipo: ${tipo}`);
    console.log(`📅 Período: ${periodo}\n`);

    // Buscar dados
    const dataAtual = new Date().toISOString().split('T')[0];
    const arquivoDados = path.join(DADOS_DIR, `${tipo}_${dataAtual}.json`);

    let dados = {};
    if (fs.existsSync(arquivoDados)) {
        dados = JSON.parse(fs.readFileSync(arquivoDados, 'utf-8'));
        console.log(`✅ Dados carregados de: ${arquivoDados}\n`);
    } else {
        console.log(`⚠️  Arquivo de dados não encontrado: ${arquivoDados}`);
        console.log(`Usando dados de exemplo...\n`);
        dados = {
            empresa: 'LFG CONSULTORIA IMOBILIARIA LTDA',
            provisaoFerias: '0,00',
            provisao13: '0,00',
            provisaoINSS: '0,00',
            provisaoFGTS: '0,00'
        };
    }

    // Gerar HTML
    console.log('📝 Gerando HTML...');
    const html = gerarHTMLProvisoes(dados, periodo);

    // Gerar PDF
    const nomePDF = `relatorio_${tipo}_${periodo}.pdf`;
    const caminhoPDF = path.join(RELATORIOS_DIR, nomePDF);

    console.log('🖨️  Gerando PDF...\n');
    await gerarPDF(html, caminhoPDF);

    console.log('========================================');
    console.log('✅ RELATÓRIO GERADO COM SUCESSO!');
    console.log('========================================\n');
    console.log(`📁 Arquivo: ${caminhoPDF}`);
    console.log(`📊 Tamanho: ${(fs.statSync(caminhoPDF).size / 1024).toFixed(2)} KB\n`);
}

// Executar
main().catch(error => {
    console.error('❌ Erro ao gerar relatório:', error);
    process.exit(1);
});
