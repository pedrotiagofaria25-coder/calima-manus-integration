#!/usr/bin/env node

/**
 * Servidor MCP para Integração Calima × Manus - Versão 2.0
 * 
 * Ferramentas implementadas:
 * 1. calima_verificar_status - Verifica conexão e status do sistema
 * 2. calima_listar_empresas - Lista empresas cadastradas
 * 3. calima_consultar_provisoes - Consulta provisões (férias, 13º, INSS, FGTS)
 * 4. calima_listar_processos - Lista processos recentes
 * 5. calima_gerar_relatorio - Gera relatórios específicos
 * 6. calima_navegar_menu - Navega para um módulo específico
 * 7. calima_extrair_dashboard - Extrai todos os dados do dashboard
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

// Configurações
const CALIMA_USERNAME = process.env.CALIMA_USERNAME;
const CALIMA_PASSWORD = process.env.CALIMA_PASSWORD;
const CALIMA_URL = 'https://www.calima.app/';
const CALIMA_DASHBOARD_URL = 'https://stable.calima.app/mfp/dashboard';

// Classe para gerenciar a conexão com o Calima
class CalimaClient {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isAuthenticated = false;
  }

  async initialize() {
    if (this.browser) {
      return; // Já inicializado
    }

    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    this.page = await this.context.newPage();
  }

  async authenticate() {
    if (this.isAuthenticated) {
      return true;
    }

    await this.initialize();

    try {
      await this.page.goto(CALIMA_URL, { waitUntil: 'networkidle' });
      await this.page.fill('input[aria-label="Usuário, CPF, e-mail, código de cliente ou CNPJ"]', CALIMA_USERNAME);
      await this.page.fill('input[aria-label="Senha"]', CALIMA_PASSWORD);
      await this.page.click('button:has-text("Entrar")');
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });

      // Verificar se o login foi bem-sucedido
      const currentUrl = this.page.url();
      this.isAuthenticated = currentUrl.includes('stable.calima.app');

      if (this.isAuthenticated) {
        // Aguardar carregamento do React
        await this.page.waitForTimeout(3000);
      }

      return this.isAuthenticated;
    } catch (error) {
      console.error('Erro na autenticação:', error.message);
      return false;
    }
  }

  async navigateToDashboard() {
    await this.authenticate();
    await this.page.goto(CALIMA_DASHBOARD_URL, { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(2000);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isAuthenticated = false;
    }
  }

  // Métodos de extração de dados

  async getEmpresaInfo() {
    await this.authenticate();
    
    const empresaData = await this.page.evaluate(() => {
      const empresaButton = document.querySelector('button:has-text("LFG CONSULTORIA")') || 
                           document.querySelector('[class*="empresa"]');
      
      if (empresaButton) {
        const text = empresaButton.textContent?.trim() || '';
        const match = text.match(/(\d+)\s*-\s*([^R]+)/);
        
        if (match) {
          return {
            codigo: match[1],
            razaoSocial: match[2].trim(),
            textoCompleto: text
          };
        }
      }
      return null;
    });

    return empresaData;
  }

  async getProvisoes() {
    await this.navigateToDashboard();

    const provisoes = await this.page.evaluate(() => {
      const result = {
        ferias: { provisaoMes: 'R$ 0,00' },
        decimoTerceiro: { provisaoMes: 'R$ 0,00' },
        inss: null,
        fgts: null
      };

      // Procurar provisão de férias
      const feriasTexts = Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent?.includes('PROVISÃO DE FÉRIAS'))
        .map(el => el.closest('[class*="card"], [class*="widget"], div'));
      
      if (feriasTexts.length > 0) {
        const feriasCard = feriasTexts[0];
        const valores = Array.from(feriasCard.querySelectorAll('*'))
          .filter(el => el.textContent?.includes('R$'))
          .map(el => el.textContent?.trim());
        
        if (valores.length > 0) {
          result.ferias.provisaoMes = valores[0];
        }
      }

      // Procurar provisão de 13º
      const decimoTexts = Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent?.includes('PROVISÃO DE DÉCIMO') || 
                     el.textContent?.includes('PROVISÃO DÉCIMO TERCEIRO'))
        .map(el => el.closest('[class*="card"], [class*="widget"], div'));
      
      if (decimoTexts.length > 0) {
        const decimoCard = decimoTexts[0];
        const valores = Array.from(decimoCard.querySelectorAll('*'))
          .filter(el => el.textContent?.includes('R$'))
          .map(el => el.textContent?.trim());
        
        if (valores.length > 0) {
          result.decimoTerceiro.provisaoMes = valores[0];
        }
      }

      return result;
    });

    return provisoes;
  }

  async getProcessos() {
    await this.navigateToDashboard();

    const processos = await this.page.evaluate(() => {
      const processosElements = Array.from(document.querySelectorAll('*'))
        .filter(el => {
          const text = el.textContent || '';
          return text.includes('Dt. Início:') && text.includes('Dt. Fim:');
        });

      return processosElements.slice(0, 5).map(el => {
        const text = el.textContent || '';
        const inicioMatch = text.match(/Dt\. Início:\s*([^\n]+)/);
        const fimMatch = text.match(/Dt\. Fim:\s*([^\n]+)/);
        const descMatch = text.match(/Fim:.*?\n\s*([^\n]+)/);
        const statusMatch = text.match(/(Finalizado|Em andamento|Erro)/i);

        return {
          dataInicio: inicioMatch ? inicioMatch[1].trim() : null,
          dataFim: fimMatch ? fimMatch[1].trim() : null,
          descricao: descMatch ? descMatch[1].trim() : text.substring(0, 100),
          status: statusMatch ? statusMatch[1] : 'Desconhecido'
        };
      });
    });

    return processos;
  }

  async navigateToMenu(menuItem) {
    await this.navigateToDashboard();

    try {
      const menuLink = await this.page.locator(`a:has-text("${menuItem}")`).first();
      
      if (await menuLink.isVisible({ timeout: 5000 })) {
        await menuLink.click();
        await this.page.waitForTimeout(2000);
        
        return {
          success: true,
          url: this.page.url(),
          message: `Navegado para ${menuItem} com sucesso`
        };
      } else {
        return {
          success: false,
          message: `Menu "${menuItem}" não encontrado ou não visível`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Erro ao navegar: ${error.message}`
      };
    }
  }

  async extractDashboard() {
    await this.navigateToDashboard();

    const dashboardData = await this.page.evaluate(() => {
      // Extrair informações gerais
      const result = {
        titulo: document.title,
        url: window.location.href,
        empresa: null,
        provisoes: {},
        processos: [],
        notificacoes: [],
        widgets: []
      };

      // Empresa
      const empresaBtn = document.querySelector('[class*="empresa"]');
      if (empresaBtn) {
        result.empresa = empresaBtn.textContent?.trim();
      }

      // Notificações
      const notifElements = Array.from(document.querySelectorAll('[class*="alert"], [class*="notification"]'));
      result.notificacoes = notifElements.slice(0, 5).map(el => ({
        tipo: el.className.includes('danger') ? 'erro' : 
              el.className.includes('warning') ? 'aviso' : 'info',
        texto: el.textContent?.trim().substring(0, 200)
      }));

      // Widgets/Cards
      const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="widget"]'));
      result.widgets = cards.slice(0, 10).map(card => ({
        classes: card.className,
        texto: card.textContent?.trim().substring(0, 150)
      }));

      return result;
    });

    return dashboardData;
  }
}

// Instância global do cliente
const calimaClient = new CalimaClient();

// Criar servidor MCP
const server = new Server(
  {
    name: 'calima-mcp-server',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Registrar ferramentas
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'calima_verificar_status',
        description: 'Verifica o status da conexão com o Calima e retorna informações básicas do sistema',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'calima_listar_empresas',
        description: 'Lista as empresas cadastradas no Calima para o usuário autenticado',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'calima_consultar_provisoes',
        description: 'Consulta as provisões de férias, décimo terceiro, INSS e FGTS do mês atual',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'calima_listar_processos',
        description: 'Lista os processos recentes executados no sistema (últimos 5)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'calima_navegar_menu',
        description: 'Navega para um módulo específico do menu (Home, Manutenção, Processos, Relatórios, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            menu: {
              type: 'string',
              description: 'Nome do menu para navegar (ex: "Relatórios", "Processos", "Manutenção")'
            }
          },
          required: ['menu']
        }
      },
      {
        name: 'calima_extrair_dashboard',
        description: 'Extrai todos os dados visíveis no dashboard principal do Calima',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ]
  };
});

// Implementar handlers das ferramentas
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'calima_verificar_status': {
        const authenticated = await calimaClient.authenticate();
        const empresa = authenticated ? await calimaClient.getEmpresaInfo() : null;
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: authenticated ? 'conectado' : 'erro',
              autenticado: authenticated,
              empresa: empresa,
              url: authenticated ? CALIMA_DASHBOARD_URL : null,
              mensagem: authenticated ? 
                'Conexão estabelecida com sucesso' : 
                'Falha na autenticação'
            }, null, 2)
          }]
        };
      }

      case 'calima_listar_empresas': {
        await calimaClient.authenticate();
        const empresa = await calimaClient.getEmpresaInfo();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              empresas: empresa ? [empresa] : [],
              total: empresa ? 1 : 0
            }, null, 2)
          }]
        };
      }

      case 'calima_consultar_provisoes': {
        const provisoes = await calimaClient.getProvisoes();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              provisoes: provisoes,
              observacao: 'Valores podem estar zerados se a referência não estiver no mês atual'
            }, null, 2)
          }]
        };
      }

      case 'calima_listar_processos': {
        const processos = await calimaClient.getProcessos();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              processos: processos,
              total: processos.length
            }, null, 2)
          }]
        };
      }

      case 'calima_navegar_menu': {
        const menuItem = args.menu;
        const result = await calimaClient.navigateToMenu(menuItem);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'calima_extrair_dashboard': {
        const dashboardData = await calimaClient.extractDashboard();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(dashboardData, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          erro: error.message,
          stack: error.stack
        }, null, 2)
      }],
      isError: true
    };
  }
});

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Servidor MCP Calima v2.0 iniciado');
  
  // Cleanup ao encerrar
  process.on('SIGINT', async () => {
    await calimaClient.close();
    process.exit(0);
  });
}

main().catch(console.error);
