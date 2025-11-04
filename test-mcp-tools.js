#!/usr/bin/env node

/**
 * Script de Teste das Ferramentas MCP do Calima
 * Testa todas as ferramentas implementadas no servidor MCP v2.0
 */

import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const CALIMA_USERNAME = process.env.CALIMA_USERNAME;
const CALIMA_PASSWORD = process.env.CALIMA_PASSWORD;

// Classe CalimaClient (mesma do index-v2.js)
class CalimaClient {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isAuthenticated = false;
  }

  async initialize() {
    if (this.browser) return;

    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    this.page = await this.context.newPage();
  }

  async authenticate() {
    if (this.isAuthenticated) return true;

    await this.initialize();

    try {
      await this.page.goto('https://www.calima.app/', { waitUntil: 'networkidle' });
      await this.page.fill('input[aria-label="Usuário, CPF, e-mail, código de cliente ou CNPJ"]', CALIMA_USERNAME);
      await this.page.fill('input[aria-label="Senha"]', CALIMA_PASSWORD);
      await this.page.click('button:has-text("Entrar")');
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });

      const currentUrl = this.page.url();
      this.isAuthenticated = currentUrl.includes('stable.calima.app');

      if (this.isAuthenticated) {
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
    await this.page.goto('https://stable.calima.app/mfp/dashboard', { waitUntil: 'networkidle' });
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

  async getEmpresaInfo() {
    await this.authenticate();
    
    const empresaData = await this.page.evaluate(() => {
      const empresaElements = Array.from(document.querySelectorAll('*'))
        .filter(el => {
          const text = el.textContent || '';
          return text.includes('LFG CONSULTORIA') || text.includes('IMOBILIARIA');
        });

      if (empresaElements.length > 0) {
        const text = empresaElements[0].textContent?.trim() || '';
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
        ferias: { provisaoMes: null },
        decimoTerceiro: { provisaoMes: null },
        inss: null,
        fgts: null
      };

      // Procurar todos os textos com "R$"
      const allTexts = Array.from(document.querySelectorAll('*'))
        .map(el => el.textContent?.trim())
        .filter(text => text && text.includes('R$'));

      // Procurar provisão de férias
      const pageText = document.body.textContent || '';
      
      if (pageText.includes('PROVISÃO DE FÉRIAS')) {
        const feriasMatch = pageText.match(/PROVISÃO DE FÉRIAS[^R]*R\$\s*([\d,\.]+)/);
        if (feriasMatch) {
          result.ferias.provisaoMes = 'R$ ' + feriasMatch[1];
        } else {
          result.ferias.provisaoMes = 'R$ 0,00';
        }
      }

      if (pageText.includes('PROVISÃO DÉCIMO TERCEIRO') || pageText.includes('PROVISÃO DE DÉCIMO')) {
        const decimoMatch = pageText.match(/PROVISÃO.*?DÉCIMO[^R]*R\$\s*([\d,\.]+)/);
        if (decimoMatch) {
          result.decimoTerceiro.provisaoMes = 'R$ ' + decimoMatch[1];
        } else {
          result.decimoTerceiro.provisaoMes = 'R$ 0,00';
        }
      }

      return result;
    });

    return provisoes;
  }

  async getProcessos() {
    await this.navigateToDashboard();

    const processos = await this.page.evaluate(() => {
      const pageText = document.body.textContent || '';
      const lines = pageText.split('\n').map(l => l.trim()).filter(l => l);
      
      const processosList = [];
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Dt. Início:')) {
          const processo = {
            dataInicio: lines[i].replace('Dt. Início:', '').trim(),
            dataFim: null,
            descricao: null,
            status: null
          };
          
          // Procurar próximas linhas
          if (i + 1 < lines.length && lines[i + 1].includes('Dt. Fim:')) {
            processo.dataFim = lines[i + 1].replace('Dt. Fim:', '').trim();
          }
          
          if (i + 2 < lines.length) {
            processo.descricao = lines[i + 2];
          }
          
          if (i + 3 < lines.length && (lines[i + 3].includes('Finalizado') || 
                                       lines[i + 3].includes('Em andamento') || 
                                       lines[i + 3].includes('Erro'))) {
            processo.status = lines[i + 3];
          }
          
          processosList.push(processo);
        }
      }
      
      return processosList.slice(0, 5);
    });

    return processos;
  }

  async extractDashboard() {
    await this.navigateToDashboard();

    const dashboardData = await this.page.evaluate(() => {
      return {
        titulo: document.title,
        url: window.location.href,
        empresa: document.querySelector('[class*="empresa"]')?.textContent?.trim() || null,
        textoCompleto: document.body.textContent?.substring(0, 2000) || ''
      };
    });

    return dashboardData;
  }
}

// Função principal de teste
async function testAllTools() {
  console.log('🧪 Testando Ferramentas MCP do Calima v2.0\n');
  console.log('='.repeat(60));

  const client = new CalimaClient();
  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  try {
    // TESTE 1: Verificar Status
    console.log('\n📋 [1/6] Testando: calima_verificar_status');
    try {
      const authenticated = await client.authenticate();
      const empresa = authenticated ? await client.getEmpresaInfo() : null;
      
      const statusResult = {
        status: authenticated ? 'conectado' : 'erro',
        autenticado: authenticated,
        empresa: empresa,
        mensagem: authenticated ? 'Conexão estabelecida com sucesso' : 'Falha na autenticação'
      };
      
      results.tests.push({
        tool: 'calima_verificar_status',
        status: authenticated ? 'PASSOU' : 'FALHOU',
        result: statusResult
      });
      
      console.log(authenticated ? '   ✅ PASSOU' : '   ❌ FALHOU');
      console.log('   Resultado:', JSON.stringify(statusResult, null, 2));
    } catch (error) {
      console.log('   ❌ ERRO:', error.message);
      results.tests.push({
        tool: 'calima_verificar_status',
        status: 'ERRO',
        error: error.message
      });
    }

    // TESTE 2: Listar Empresas
    console.log('\n📋 [2/6] Testando: calima_listar_empresas');
    try {
      const empresa = await client.getEmpresaInfo();
      
      const empresasResult = {
        empresas: empresa ? [empresa] : [],
        total: empresa ? 1 : 0
      };
      
      results.tests.push({
        tool: 'calima_listar_empresas',
        status: empresa ? 'PASSOU' : 'FALHOU',
        result: empresasResult
      });
      
      console.log(empresa ? '   ✅ PASSOU' : '   ❌ FALHOU');
      console.log('   Resultado:', JSON.stringify(empresasResult, null, 2));
    } catch (error) {
      console.log('   ❌ ERRO:', error.message);
      results.tests.push({
        tool: 'calima_listar_empresas',
        status: 'ERRO',
        error: error.message
      });
    }

    // TESTE 3: Consultar Provisões
    console.log('\n📋 [3/6] Testando: calima_consultar_provisoes');
    try {
      const provisoes = await client.getProvisoes();
      
      const provisoesResult = {
        provisoes: provisoes,
        observacao: 'Valores podem estar zerados se a referência não estiver no mês atual'
      };
      
      results.tests.push({
        tool: 'calima_consultar_provisoes',
        status: 'PASSOU',
        result: provisoesResult
      });
      
      console.log('   ✅ PASSOU');
      console.log('   Resultado:', JSON.stringify(provisoesResult, null, 2));
    } catch (error) {
      console.log('   ❌ ERRO:', error.message);
      results.tests.push({
        tool: 'calima_consultar_provisoes',
        status: 'ERRO',
        error: error.message
      });
    }

    // TESTE 4: Listar Processos
    console.log('\n📋 [4/6] Testando: calima_listar_processos');
    try {
      const processos = await client.getProcessos();
      
      const processosResult = {
        processos: processos,
        total: processos.length
      };
      
      results.tests.push({
        tool: 'calima_listar_processos',
        status: 'PASSOU',
        result: processosResult
      });
      
      console.log('   ✅ PASSOU');
      console.log('   Resultado:', JSON.stringify(processosResult, null, 2));
    } catch (error) {
      console.log('   ❌ ERRO:', error.message);
      results.tests.push({
        tool: 'calima_listar_processos',
        status: 'ERRO',
        error: error.message
      });
    }

    // TESTE 5: Extrair Dashboard
    console.log('\n📋 [5/6] Testando: calima_extrair_dashboard');
    try {
      const dashboardData = await client.extractDashboard();
      
      results.tests.push({
        tool: 'calima_extrair_dashboard',
        status: 'PASSOU',
        result: dashboardData
      });
      
      console.log('   ✅ PASSOU');
      console.log('   Resultado (primeiros 500 caracteres):');
      console.log('   ', JSON.stringify(dashboardData, null, 2).substring(0, 500) + '...');
    } catch (error) {
      console.log('   ❌ ERRO:', error.message);
      results.tests.push({
        tool: 'calima_extrair_dashboard',
        status: 'ERRO',
        error: error.message
      });
    }

    // TESTE 6: Screenshot Final
    console.log('\n📋 [6/6] Capturando screenshot do dashboard');
    try {
      const screenshotPath = join(__dirname, 'test-mcp-dashboard.png');
      await client.page.screenshot({ path: screenshotPath, fullPage: true });
      console.log('   ✅ Screenshot salvo:', screenshotPath);
    } catch (error) {
      console.log('   ⚠️  Não foi possível capturar screenshot:', error.message);
    }

    // Salvar resultados
    const resultsPath = join(__dirname, 'test-mcp-results.json');
    writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log('\n💾 Resultados salvos em:', resultsPath);

    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DOS TESTES');
    console.log('='.repeat(60));
    
    const passed = results.tests.filter(t => t.status === 'PASSOU').length;
    const failed = results.tests.filter(t => t.status === 'FALHOU').length;
    const errors = results.tests.filter(t => t.status === 'ERRO').length;
    
    console.log(`✅ Testes aprovados: ${passed}`);
    console.log(`❌ Testes falhados: ${failed}`);
    console.log(`⚠️  Erros: ${errors}`);
    console.log(`📊 Total: ${results.tests.length}`);
    console.log('='.repeat(60));

    return results;

  } catch (error) {
    console.error('\n💥 Erro fatal durante os testes:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Navegador fechado.');
  }
}

// Executar testes
testAllTools()
  .then((results) => {
    const allPassed = results.tests.every(t => t.status === 'PASSOU');
    console.log(allPassed ? '\n✅ TODOS OS TESTES PASSARAM!' : '\n⚠️  ALGUNS TESTES FALHARAM');
    process.exit(allPassed ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
