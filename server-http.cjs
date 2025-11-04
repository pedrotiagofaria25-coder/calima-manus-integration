#!/usr/bin/env node

/**
 * Servidor HTTP MCP - Integração Calima
 * 
 * Expõe a integração Calima via protocolo HTTP para conexão com o Manus.
 */

const express = require('express');
const cors = require('cors');
const { PayrollCalculator } = require('./modules/payroll/calculator.cjs');
const { ESocialSender } = require('./modules/esocial/sender.cjs');
const { TaxCalculator } = require('./modules/tax/calculator.cjs');
const { DeclarationsGenerator } = require('./modules/declarations/generator.cjs');
const { NFeImporter } = require('./modules/fiscal/nfe-importer.cjs');
const { CryptoManager } = require('./lib/crypto.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Instanciar módulos
const crypto = new CryptoManager();
let payroll, esocial, tax, declarations, nfeImporter;

// Endpoint de saúde
app.get("/mcp", (req, res) => {
  res.json({
    name: "Calima Integration",
    description: "Servidor de integração com o sistema Calima ERP, versão 5.0.",
    tools: [
      "calima_calcular_folha",
      "calima_gerar_gps",
      "calima_gerar_prolabore",
      "calima_gerar_evento_esocial",
      "calima_enviar_esocial",
      "calima_processar_esocial_mensal",
      "calima_apurar_pis",
      "calima_apurar_cofins",
      "calima_apurar_tributos_mensais",
      "calima_apurar_tributos_trimestrais",
      "calima_gerar_dctf",
      "calima_processar_dctfweb",
      "calima_importar_nfe",
      "calima_validar_nfe"
    ]
  });
});

app.get("/health", (req, res) => {
    res.json({ status: 'ok', service: 'Calima MCP Server', version: '5.0.0' });
});

// Endpoint de informações do servidor
app.get('/mcp/info', (req, res) => {
    res.json({
        name: 'Calima Integration Server',
        version: '5.0.0',
        description: 'Servidor MCP para integração com o sistema Calima ERP',
        capabilities: [
            'folha_pagamento',
            'esocial',
            'tributos',
            'declaracoes',
            'documentos_fiscais'
        ],
        tools: [
            {
                name: 'calima_calcular_folha',
                description: 'Calcula folha de pagamento mensal',
                parameters: ['mes', 'empresaId']
            },
            {
                name: 'calima_gerar_gps',
                description: 'Gera GPS (Guia da Previdência Social)',
                parameters: ['mes', 'empresaId', 'downloadPDF']
            },
            {
                name: 'calima_gerar_prolabore',
                description: 'Gera recibos de pró-labore',
                parameters: ['mes', 'socioId']
            },
            {
                name: 'calima_gerar_evento_esocial',
                description: 'Gera evento do eSocial (S-1200, S-1210, S-1299)',
                parameters: ['tipo', 'periodo', 'empresaId']
            },
            {
                name: 'calima_enviar_esocial',
                description: 'Envia eventos ao eSocial',
                parameters: ['periodo', 'eventos']
            },
            {
                name: 'calima_processar_esocial_mensal',
                description: 'Processa eventos mensais completos do eSocial',
                parameters: ['periodo', 'empresaId']
            },
            {
                name: 'calima_apurar_pis',
                description: 'Apura PIS mensal',
                parameters: ['periodo', 'empresaId']
            },
            {
                name: 'calima_apurar_cofins',
                description: 'Apura COFINS mensal',
                parameters: ['periodo', 'empresaId']
            },
            {
                name: 'calima_apurar_tributos_mensais',
                description: 'Apura todos os tributos mensais (PIS, COFINS, ISS)',
                parameters: ['periodo', 'empresaId']
            },
            {
                name: 'calima_apurar_tributos_trimestrais',
                description: 'Apura tributos trimestrais (IRPJ, CSLL)',
                parameters: ['periodo', 'empresaId']
            },
            {
                name: 'calima_gerar_dctf',
                description: 'Gera DCTF (Declaração de Débitos e Créditos Tributários Federais)',
                parameters: ['periodo', 'empresaId', 'download']
            },
            {
                name: 'calima_processar_dctfweb',
                description: 'Processa DCTFWeb completo (gerar + validar + transmitir)',
                parameters: ['periodo', 'empresaId']
            },
            {
                name: 'calima_importar_nfe',
                description: 'Importa NF-e de um diretório',
                parameters: ['diretorio']
            },
            {
                name: 'calima_validar_nfe',
                description: 'Valida arquivo XML de NF-e',
                parameters: ['arquivo']
            }
        ]
    });
});

// Endpoint para listar ferramentas (padrão MCP)
app.get('/mcp/tools', (req, res) => {
    res.json({
        tools: [
            {
                name: 'calima_calcular_folha',
                description: 'Calcula folha de pagamento mensal no Calima',
                inputSchema: {
                    type: 'object',
                    properties: {
                        mes: { type: 'string', description: 'Mês no formato MM/AAAA' },
                        empresaId: { type: 'string', description: 'ID da empresa (opcional)' },
                        masterPassword: { type: 'string', description: 'Senha mestra para descriptografar credenciais' }
                    },
                    required: ['mes', 'masterPassword']
                }
            },
            {
                name: 'calima_gerar_gps',
                description: 'Gera GPS (Guia da Previdência Social) no Calima',
                inputSchema: {
                    type: 'object',
                    properties: {
                        mes: { type: 'string', description: 'Mês no formato MM/AAAA' },
                        empresaId: { type: 'string', description: 'ID da empresa (opcional)' },
                        downloadPDF: { type: 'boolean', description: 'Fazer download do PDF' },
                        masterPassword: { type: 'string', description: 'Senha mestra para descriptografar credenciais' }
                    },
                    required: ['mes', 'masterPassword']
                }
            },
            {
                name: 'calima_processar_esocial_mensal',
                description: 'Processa eventos mensais completos do eSocial (gerar + enviar)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        periodo: { type: 'string', description: 'Período no formato MM/AAAA' },
                        empresaId: { type: 'string', description: 'ID da empresa (opcional)' },
                        masterPassword: { type: 'string', description: 'Senha mestra para descriptografar credenciais' }
                    },
                    required: ['periodo', 'masterPassword']
                }
            },
            {
                name: 'calima_apurar_tributos_mensais',
                description: 'Apura todos os tributos mensais (PIS, COFINS, ISS)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        periodo: { type: 'string', description: 'Período no formato MM/AAAA' },
                        empresaId: { type: 'string', description: 'ID da empresa (opcional)' },
                        masterPassword: { type: 'string', description: 'Senha mestra para descriptografar credenciais' }
                    },
                    required: ['periodo', 'masterPassword']
                }
            },
            {
                name: 'calima_processar_dctfweb',
                description: 'Processa DCTFWeb completo (gerar + validar + transmitir)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        periodo: { type: 'string', description: 'Período no formato MM/AAAA' },
                        empresaId: { type: 'string', description: 'ID da empresa (opcional)' },
                        masterPassword: { type: 'string', description: 'Senha mestra para descriptografar credenciais' }
                    },
                    required: ['periodo', 'masterPassword']
                }
            }
        ]
    });
});

// Endpoint para executar ferramentas (padrão MCP)
app.post('/mcp/call', async (req, res) => {
    const { tool, arguments: args } = req.body;

    try {
        // Descriptografar credenciais
        const credentials = crypto.decryptCredentials(args.masterPassword);

        // Inicializar módulos se necessário
        if (!payroll) payroll = new PayrollCalculator({ verbose: false });
        if (!esocial) esocial = new ESocialSender({ verbose: false });
        if (!tax) tax = new TaxCalculator({ verbose: false });
        if (!declarations) declarations = new DeclarationsGenerator({ verbose: false });
        if (!nfeImporter) nfeImporter = new NFeImporter({ verbose: false });

        let result;

        switch (tool) {
            case 'calima_calcular_folha':
                result = await payroll.calculateMonthly({ mes: args.mes, empresaId: args.empresaId }, credentials);
                break;

            case 'calima_gerar_gps':
                result = await payroll.generateGPS({ 
                    mes: args.mes, 
                    empresaId: args.empresaId,
                    downloadPDF: args.downloadPDF 
                }, credentials);
                break;

            case 'calima_gerar_prolabore':
                result = await payroll.generateProlabore({ mes: args.mes, socioId: args.socioId }, credentials);
                break;

            case 'calima_processar_esocial_mensal':
                result = await esocial.processMonthlyEvents({ periodo: args.periodo, empresaId: args.empresaId }, credentials);
                break;

            case 'calima_apurar_tributos_mensais':
                result = await tax.calculateMonthlyTaxes({ periodo: args.periodo, empresaId: args.empresaId }, credentials);
                break;

            case 'calima_apurar_tributos_trimestrais':
                result = await tax.calculateQuarterlyTaxes({ periodo: args.periodo, empresaId: args.empresaId }, credentials);
                break;

            case 'calima_processar_dctfweb':
                result = await declarations.processDCTFWebComplete({ periodo: args.periodo, empresaId: args.empresaId }, credentials);
                break;

            case 'calima_importar_nfe':
                result = await nfeImporter.importBatch(args.diretorio, credentials);
                break;

            default:
                return res.status(400).json({ error: 'Ferramenta não encontrada', tool });
        }

        res.json({ success: true, result });

    } catch (error) {
        console.error('Erro ao executar ferramenta:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP MCP - Calima rodando na porta ${PORT}`);
    console.log(`📊 Informações: http://localhost:${PORT}/mcp/info`);
    console.log(`🔧 Ferramentas: http://localhost:${PORT}/mcp/tools`);
    console.log(`✅ Saúde: http://localhost:${PORT}/health`);
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promise rejeitada não tratada:', reason);
});
