#!/usr/bin/env node

/**
 * Sistema de Automações para Calima
 * 
 * Automações disponíveis:
 * 1. Extração diária de provisões
 * 2. Relatório semanal de processos
 * 3. Monitoramento de notificações
 * 4. Backup automático de dados
 */

import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

// Diretório para armazenar dados extraídos
const DATA_DIR = join(__dirname, 'dados_extraidos');
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

class CalimaAutomacao {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async inicializar() {
    this.browser = await chromium.launch({ headless: true });
    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    this.page = await context.newPage();
  }

  async autenticar() {
    await this.page.goto('https://www.calima.app/', { waitUntil: 'networkidle', timeout: 60000 });
    await this.page.fill('input[aria-label="Usuário, CPF, e-mail, código de cliente ou CNPJ"]', 
                        process.env.CALIMA_USERNAME);
    await this.page.fill('input[aria-label="Senha"]', process.env.CALIMA_PASSWORD);
    await this.page.click('button:has-text("Entrar")');
    await this.page.waitForLoadState('networkidle', { timeout: 60000 });
    await this.page.waitForTimeout(3000);
  }

  async navegarDashboard() {
    await this.page.goto('https://stable.calima.app/mfp/dashboard', { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(2000);
  }

  async fechar() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // ========== AUTOMAÇÃO 1: Extração Diária de Provisões ==========
  async extrairProvisoesDiarias() {
    console.log('\n📊 Executando: Extração Diária de Provisões');
    console.log('─'.repeat(60));

    await this.inicializar();
    await this.autenticar();
    await this.navegarDashboard();

    const provisoes = await this.page.evaluate(() => {
      const text = document.body.textContent || '';
      const timestamp = new Date().toISOString();
      
      const feriasMatch = text.match(/PROVISÃO DE FÉRIAS[^R]*R\$\s*([\d,\.]+)/);
      const decimoMatch = text.match(/PROVISÃO.*?DÉCIMO[^R]*R\$\s*([\d,\.]+)/);
      const refMatch = text.match(/Referência Atual:\s*(\d{2}\/\d{4})/);
      
      return {
        timestamp,
        referencia: refMatch ? refMatch[1] : null,
        provisoes: {
          ferias: feriasMatch ? `R$ ${feriasMatch[1]}` : 'R$ 0,00',
          decimoTerceiro: decimoMatch ? `R$ ${decimoMatch[1]}` : 'R$ 0,00'
        }
      };
    });

    // Salvar em arquivo
    const hoje = new Date().toISOString().split('T')[0];
    const arquivo = join(DATA_DIR, `provisoes_${hoje}.json`);
    writeFileSync(arquivo, JSON.stringify(provisoes, null, 2));

    console.log(`✅ Provisões extraídas e salvas em: ${arquivo}`);
    console.log(`   Referência: ${provisoes.referencia}`);
    console.log(`   Férias: ${provisoes.provisoes.ferias}`);
    console.log(`   13º Salário: ${provisoes.provisoes.decimoTerceiro}`);

    await this.fechar();
    return provisoes;
  }

  // ========== AUTOMAÇÃO 2: Relatório Semanal de Processos ==========
  async gerarRelatorioProcessos() {
    console.log('\n⚙️  Executando: Relatório Semanal de Processos');
    console.log('─'.repeat(60));

    await this.inicializar();
    await this.autenticar();
    await this.navegarDashboard();

    const processos = await this.page.evaluate(() => {
      const text = document.body.textContent || '';
      const lines = text.split('\n');
      const timestamp = new Date().toISOString();
      
      const processosList = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('Dt. Início:') && line.includes('Dt. Fim:')) {
          const inicioMatch = line.match(/Dt\. Início:\s*([^\s]+\s+[^\s]+)/);
          const fimMatch = line.match(/Dt\. Fim:\s*([^\s]+\s+[^\s]+)/);
          
          let descricao = 'Processo não identificado';
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const nextLine = lines[j].trim();
            if (nextLine && !nextLine.includes('Dt.') && !nextLine.includes('Finalizado') && 
                nextLine.length > 10 && nextLine.length < 100) {
              descricao = nextLine;
              break;
            }
          }
          
          processosList.push({
            dataInicio: inicioMatch ? inicioMatch[1] : null,
            dataFim: fimMatch ? fimMatch[1] : null,
            descricao,
            status: 'Finalizado'
          });
        }
      }
      
      return {
        timestamp,
        totalProcessos: processosList.length,
        processos: processosList.slice(0, 10)
      };
    });

    // Salvar em arquivo
    const hoje = new Date().toISOString().split('T')[0];
    const arquivo = join(DATA_DIR, `processos_${hoje}.json`);
    writeFileSync(arquivo, JSON.stringify(processos, null, 2));

    console.log(`✅ Relatório de processos gerado: ${arquivo}`);
    console.log(`   Total de processos: ${processos.totalProcessos}`);
    console.log(`   Últimos 3 processos:`);
    processos.processos.slice(0, 3).forEach((proc, idx) => {
      console.log(`   ${idx + 1}. ${proc.descricao}`);
    });

    await this.fechar();
    return processos;
  }

  // ========== AUTOMAÇÃO 3: Monitoramento de Notificações ==========
  async monitorarNotificacoes() {
    console.log('\n🔔 Executando: Monitoramento de Notificações');
    console.log('─'.repeat(60));

    await this.inicializar();
    await this.autenticar();
    await this.navegarDashboard();

    const notificacoes = await this.page.evaluate(() => {
      const timestamp = new Date().toISOString();
      const alerts = [];
      
      // Procurar elementos de alerta/notificação
      const alertElements = Array.from(document.querySelectorAll('[class*="alert"], [class*="notification"]'));
      
      alertElements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length > 20) {
          const tipo = el.className.includes('danger') ? 'erro' : 
                      el.className.includes('warning') ? 'aviso' : 'info';
          alerts.push({ tipo, mensagem: text.substring(0, 200) });
        }
      });

      return {
        timestamp,
        totalNotificacoes: alerts.length,
        notificacoes: alerts
      };
    });

    // Salvar em arquivo
    const hoje = new Date().toISOString().split('T')[0];
    const arquivo = join(DATA_DIR, `notificacoes_${hoje}.json`);
    writeFileSync(arquivo, JSON.stringify(notificacoes, null, 2));

    console.log(`✅ Notificações monitoradas: ${arquivo}`);
    console.log(`   Total: ${notificacoes.totalNotificacoes}`);
    
    if (notificacoes.notificacoes.length > 0) {
      console.log(`   Notificações encontradas:`);
      notificacoes.notificacoes.forEach((notif, idx) => {
        console.log(`   ${idx + 1}. [${notif.tipo.toUpperCase()}] ${notif.mensagem.substring(0, 60)}...`);
      });
    } else {
      console.log(`   Nenhuma notificação pendente`);
    }

    await this.fechar();
    return notificacoes;
  }

  // ========== AUTOMAÇÃO 4: Backup Completo de Dados ==========
  async backupCompleto() {
    console.log('\n💾 Executando: Backup Completo de Dados');
    console.log('─'.repeat(60));

    await this.inicializar();
    await this.autenticar();
    await this.navegarDashboard();

    const backup = await this.page.evaluate(() => {
      return {
        timestamp: new Date().toISOString(),
        empresa: document.querySelector('[class*="empresa"]')?.textContent?.trim() || null,
        titulo: document.title,
        url: window.location.href,
        textoCompleto: document.body.textContent?.substring(0, 5000) || '',
        estruturaHTML: {
          totalElements: document.querySelectorAll('*').length,
          cards: document.querySelectorAll('[class*="card"]').length,
          widgets: document.querySelectorAll('[class*="widget"]').length,
          links: document.querySelectorAll('a').length,
          buttons: document.querySelectorAll('button').length
        }
      };
    });

    // Screenshot
    const hoje = new Date().toISOString().split('T')[0];
    const screenshotPath = join(DATA_DIR, `backup_screenshot_${hoje}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true });

    // Salvar dados
    const arquivo = join(DATA_DIR, `backup_completo_${hoje}.json`);
    writeFileSync(arquivo, JSON.stringify(backup, null, 2));

    console.log(`✅ Backup completo realizado:`);
    console.log(`   Dados: ${arquivo}`);
    console.log(`   Screenshot: ${screenshotPath}`);
    console.log(`   Empresa: ${backup.empresa}`);
    console.log(`   Total de elementos: ${backup.estruturaHTML.totalElements}`);

    await this.fechar();
    return backup;
  }
}

// ========== MENU PRINCIPAL ==========
async function executarAutomacao(tipo) {
  const automacao = new CalimaAutomacao();

  try {
    switch (tipo) {
      case 'provisoes':
        return await automacao.extrairProvisoesDiarias();
      
      case 'processos':
        return await automacao.gerarRelatorioProcessos();
      
      case 'notificacoes':
        return await automacao.monitorarNotificacoes();
      
      case 'backup':
        return await automacao.backupCompleto();
      
      case 'todas':
        console.log('\n🚀 Executando TODAS as automações...\n');
        await automacao.extrairProvisoesDiarias();
        await automacao.gerarRelatorioProcessos();
        await automacao.monitorarNotificacoes();
        await automacao.backupCompleto();
        console.log('\n✅ Todas as automações concluídas!');
        break;
      
      default:
        console.error('❌ Tipo de automação inválido');
        console.log('\nUso: node automacoes.js [provisoes|processos|notificacoes|backup|todas]');
        process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Erro durante a automação:', error.message);
    throw error;
  }
}

// Executar
const tipo = process.argv[2] || 'todas';

console.log('🤖 SISTEMA DE AUTOMAÇÕES CALIMA');
console.log('='.repeat(70));
console.log(`Tipo de automação: ${tipo.toUpperCase()}`);
console.log(`Diretório de dados: ${DATA_DIR}`);
console.log('='.repeat(70));

executarAutomacao(tipo)
  .then(() => {
    console.log('\n✅ Automação concluída com sucesso!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
