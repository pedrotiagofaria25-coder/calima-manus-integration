#!/usr/bin/env node

/**
 * Servidor MCP para Integração Calima ERP × Manus
 * 
 * Este servidor fornece ferramentas MCP para interagir com o sistema
 * Calima ERP Contábil através de automação web (Playwright).
 * 
 * IMPORTANTE: Este servidor requer credenciais de login do Calima.
 * As credenciais devem ser fornecidas via variáveis de ambiente:
 * - CALIMA_USERNAME
 * - CALIMA_PASSWORD
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { chromium } from 'playwright';

// Configuração do servidor MCP
const server = new Server(
  {
    name: 'calima-manus-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Estado global do navegador
let browser = null;
let context = null;
let page = null;
let isAuthenticated = false;

/**
 * Inicializa o navegador e faz login no Calima
 */
async function initializeBrowser() {
  if (browser) {
    return; // Já inicializado
  }

  const username = process.env.CALIMA_USERNAME;
  const password = process.env.CALIMA_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Credenciais não configuradas. Configure CALIMA_USERNAME e CALIMA_PASSWORD.'
    );
  }

  browser = await chromium.launch({
    headless: true,
  });

  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });

  page = await context.newPage();

  // Fazer login
  await page.goto('https://www.calima.app/');
  await page.fill('input[aria-label="Usuário, CPF, e-mail, código de cliente ou CNPJ"]', username);
  await page.fill('input[aria-label="Senha"]', password);
  await page.click('button:has-text("Entrar")');

  // Aguardar redirecionamento após login
  await page.waitForLoadState('networkidle', { timeout: 30000 });

  // Verificar se o login foi bem-sucedido
  const currentUrl = page.url();
  if (currentUrl.includes('calima.app') && !currentUrl.includes('login')) {
    isAuthenticated = true;
  } else {
    throw new Error('Falha na autenticação. Verifique as credenciais.');
  }
}

/**
 * Encerra o navegador
 */
async function closeBrowser() {
  if (page) await page.close();
  if (context) await context.close();
  if (browser) await browser.close();
  browser = null;
  context = null;
  page = null;
  isAuthenticated = false;
}

/**
 * Lista de empresas cadastradas
 */
async function listarEmpresas() {
  await initializeBrowser();

  try {
    // Navegar para a lista de empresas
    await page.goto('https://www.calima.app/empresa', { waitUntil: 'networkidle' });

    // Extrair dados das empresas da página
    const empresas = await page.evaluate(() => {
      const empresaElements = document.querySelectorAll('[data-empresa]');
      const result = [];

      empresaElements.forEach((el) => {
        const cnpj = el.getAttribute('data-cnpj') || '';
        const razaoSocial = el.querySelector('.razao-social')?.textContent?.trim() || '';
        const nomeFantasia = el.querySelector('.nome-fantasia')?.textContent?.trim() || '';

        if (cnpj) {
          result.push({
            cnpj,
            razaoSocial,
            nomeFantasia,
          });
        }
      });

      return result;
    });

    return {
      success: true,
      empresas,
      total: empresas.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Consultar saldo de uma conta contábil
 */
async function consultarSaldo(cnpj, contaContabil, data) {
  await initializeBrowser();

  try {
    // Esta é uma implementação de exemplo
    // A URL e seletores reais devem ser ajustados conforme o Calima
    const url = `https://www.calima.app/contabil/consulta-saldo?cnpj=${cnpj}&conta=${contaContabil}&data=${data}`;
    await page.goto(url, { waitUntil: 'networkidle' });

    const saldo = await page.evaluate(() => {
      const saldoElement = document.querySelector('.saldo-conta');
      return saldoElement ? saldoElement.textContent.trim() : 'N/A';
    });

    return {
      success: true,
      cnpj,
      conta: contaContabil,
      data,
      saldo,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Extrair balancete de verificação
 */
async function extrairBalancete(cnpj, dataInicio, dataFim) {
  await initializeBrowser();

  try {
    // Navegar para o módulo de relatórios
    const url = `https://www.calima.app/contabil/balancete?cnpj=${cnpj}&inicio=${dataInicio}&fim=${dataFim}`;
    await page.goto(url, { waitUntil: 'networkidle' });

    // Extrair dados do balancete
    const balancete = await page.evaluate(() => {
      const linhas = document.querySelectorAll('table.balancete tbody tr');
      const contas = [];

      linhas.forEach((linha) => {
        const cols = linha.querySelectorAll('td');
        if (cols.length >= 4) {
          contas.push({
            codigo: cols[0]?.textContent?.trim() || '',
            descricao: cols[1]?.textContent?.trim() || '',
            debito: cols[2]?.textContent?.trim() || '0,00',
            credito: cols[3]?.textContent?.trim() || '0,00',
          });
        }
      });

      return contas;
    });

    return {
      success: true,
      cnpj,
      periodo: { inicio: dataInicio, fim: dataFim },
      contas: balancete,
      total: balancete.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Criar lançamento contábil
 */
async function criarLancamento(cnpj, lancamento) {
  await initializeBrowser();

  try {
    // Navegar para a tela de lançamentos
    await page.goto(`https://www.calima.app/contabil/lancamentos?cnpj=${cnpj}`, {
      waitUntil: 'networkidle',
    });

    // Clicar no botão de novo lançamento
    await page.click('button:has-text("Novo Lançamento")');
    await page.waitForSelector('form.lancamento-form');

    // Preencher o formulário
    await page.fill('input[name="data"]', lancamento.data);
    await page.fill('input[name="historico"]', lancamento.historico);
    await page.fill('input[name="conta_debito"]', lancamento.contaDebito);
    await page.fill('input[name="valor_debito"]', lancamento.valor);
    await page.fill('input[name="conta_credito"]', lancamento.contaCredito);
    await page.fill('input[name="valor_credito"]', lancamento.valor);

    // Salvar o lançamento
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Verificar se foi salvo com sucesso
    const mensagemSucesso = await page.locator('.mensagem-sucesso').isVisible();

    return {
      success: mensagemSucesso,
      message: mensagemSucesso
        ? 'Lançamento criado com sucesso'
        : 'Erro ao criar lançamento',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verificar status da conexão
 */
async function verificarStatus() {
  try {
    if (!isAuthenticated) {
      await initializeBrowser();
    }

    return {
      success: true,
      authenticated: isAuthenticated,
      message: 'Conexão ativa com o Calima',
    };
  } catch (error) {
    return {
      success: false,
      authenticated: false,
      error: error.message,
    };
  }
}

// Registrar ferramentas MCP
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'calima_verificar_status',
        description:
          'Verifica o status da conexão com o Calima ERP e se a autenticação está ativa.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'calima_listar_empresas',
        description:
          'Lista todas as empresas cadastradas no Calima ERP para o usuário autenticado.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'calima_consultar_saldo',
        description:
          'Consulta o saldo de uma conta contábil específica em uma determinada data.',
        inputSchema: {
          type: 'object',
          properties: {
            cnpj: {
              type: 'string',
              description: 'CNPJ da empresa (formato: 00.000.000/0000-00)',
            },
            conta_contabil: {
              type: 'string',
              description: 'Código da conta contábil (ex: 1.1.1.01.001)',
            },
            data: {
              type: 'string',
              description: 'Data para consulta do saldo (formato: DD/MM/AAAA)',
            },
          },
          required: ['cnpj', 'conta_contabil', 'data'],
        },
      },
      {
        name: 'calima_extrair_balancete',
        description:
          'Extrai o balancete de verificação de uma empresa em um período específico.',
        inputSchema: {
          type: 'object',
          properties: {
            cnpj: {
              type: 'string',
              description: 'CNPJ da empresa',
            },
            data_inicio: {
              type: 'string',
              description: 'Data inicial do período (DD/MM/AAAA)',
            },
            data_fim: {
              type: 'string',
              description: 'Data final do período (DD/MM/AAAA)',
            },
          },
          required: ['cnpj', 'data_inicio', 'data_fim'],
        },
      },
      {
        name: 'calima_criar_lancamento',
        description:
          'Cria um novo lançamento contábil no Calima ERP.',
        inputSchema: {
          type: 'object',
          properties: {
            cnpj: {
              type: 'string',
              description: 'CNPJ da empresa',
            },
            data: {
              type: 'string',
              description: 'Data do lançamento (DD/MM/AAAA)',
            },
            historico: {
              type: 'string',
              description: 'Histórico/descrição do lançamento',
            },
            conta_debito: {
              type: 'string',
              description: 'Código da conta de débito',
            },
            conta_credito: {
              type: 'string',
              description: 'Código da conta de crédito',
            },
            valor: {
              type: 'string',
              description: 'Valor do lançamento (formato: 0.000,00)',
            },
          },
          required: ['cnpj', 'data', 'historico', 'conta_debito', 'conta_credito', 'valor'],
        },
      },
    ],
  };
});

// Manipular chamadas de ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'calima_verificar_status': {
        const result = await verificarStatus();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'calima_listar_empresas': {
        const result = await listarEmpresas();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'calima_consultar_saldo': {
        const result = await consultarSaldo(
          args.cnpj,
          args.conta_contabil,
          args.data
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'calima_extrair_balancete': {
        const result = await extrairBalancete(
          args.cnpj,
          args.data_inicio,
          args.data_fim
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'calima_criar_lancamento': {
        const lancamento = {
          data: args.data,
          historico: args.historico,
          contaDebito: args.conta_debito,
          contaCredito: args.conta_credito,
          valor: args.valor,
        };
        const result = await criarLancamento(args.cnpj, lancamento);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
          }),
        },
      ],
      isError: true,
    };
  }
});

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Cleanup ao encerrar
  process.on('SIGINT', async () => {
    await closeBrowser();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await closeBrowser();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
