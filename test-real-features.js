#!/usr/bin/env node

/**
 * Teste Real de Funcionalidades do Calima
 * Testa navegação e extração de dados reais
 */

import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

async function testRealFeatures() {
  console.log('🧪 Testando funcionalidades reais do Calima...\n');

  const username = process.env.CALIMA_USERNAME;
  const password = process.env.CALIMA_PASSWORD;

  let browser = null;
  const results = {
    authentication: false,
    empresa: null,
    menuNavigation: [],
    dataExtraction: {}
  };

  try {
    browser = await chromium.launch({ headless: true }); // headless mode para servidor
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    const page = await context.newPage();

    // ========== TESTE 1: AUTENTICAÇÃO ==========
    console.log('🔐 [1/5] Testando autenticação...');
    await page.goto('https://www.calima.app/', { waitUntil: 'networkidle' });
    await page.fill('input[aria-label="Usuário, CPF, e-mail, código de cliente ou CNPJ"]', username);
    await page.fill('input[aria-label="Senha"]', password);
    await page.click('button:has-text("Entrar")');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    results.authentication = page.url().includes('stable.calima.app');
    console.log(results.authentication ? '   ✅ Autenticação OK' : '   ❌ Falha na autenticação');

    if (!results.authentication) {
      throw new Error('Falha na autenticação');
    }

    // Aguardar carregamento completo do React
    await page.waitForTimeout(3000);

    // ========== TESTE 2: EXTRAIR DADOS DA EMPRESA ==========
    console.log('\n🏢 [2/5] Extraindo dados da empresa...');
    
    const empresaData = await page.evaluate(() => {
      // Tentar diferentes seletores
      const empresaElement = document.querySelector('[class*="empresa"]');
      if (empresaElement) {
        return {
          text: empresaElement.textContent?.trim(),
          html: empresaElement.innerHTML
        };
      }
      return null;
    });

    results.empresa = empresaData;
    console.log(empresaData ? `   ✅ Empresa: ${empresaData.text}` : '   ❌ Não encontrado');

    // ========== TESTE 3: NAVEGAR PELO MENU ==========
    console.log('\n📋 [3/5] Testando navegação pelo menu...');
    
    // Tentar clicar em diferentes itens do menu
    const menuItems = ['Manutenção', 'Processos', 'Relatórios'];
    
    for (const item of menuItems) {
      try {
        console.log(`   🔍 Tentando acessar: ${item}`);
        
        // Procurar o item no menu lateral
        const menuButton = await page.locator(`text="${item}"`).first();
        
        if (await menuButton.isVisible({ timeout: 5000 })) {
          await menuButton.click();
          await page.waitForTimeout(2000);
          
          const currentUrl = page.url();
          results.menuNavigation.push({
            item,
            success: true,
            url: currentUrl
          });
          
          console.log(`   ✅ ${item} acessado: ${currentUrl}`);
          
          // Screenshot
          const screenshot = join(__dirname, `test-${item.toLowerCase()}.png`);
          await page.screenshot({ path: screenshot, fullPage: true });
        } else {
          console.log(`   ⚠️  ${item} não visível`);
          results.menuNavigation.push({ item, success: false });
        }
      } catch (err) {
        console.log(`   ❌ Erro ao acessar ${item}: ${err.message}`);
        results.menuNavigation.push({ item, success: false, error: err.message });
      }
    }

    // ========== TESTE 4: TENTAR ACESSAR MÓDULO CONTÁBIL ==========
    console.log('\n💰 [4/5] Tentando acessar módulo contábil...');
    
    try {
      // Voltar ao dashboard
      await page.goto('https://stable.calima.app/mfp/dashboard', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      // Procurar link/botão do módulo contábil
      const contabilLinks = await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a, button'));
        return allLinks
          .filter(el => {
            const text = el.textContent?.toLowerCase() || '';
            return text.includes('contábil') || text.includes('contabil') || 
                   text.includes('lançamento') || text.includes('lancamento');
          })
          .map(el => ({
            text: el.textContent?.trim(),
            href: el.getAttribute('href'),
            tag: el.tagName
          }));
      });
      
      results.dataExtraction.contabilLinks = contabilLinks;
      console.log(`   ✅ Encontrados ${contabilLinks.length} links relacionados à contabilidade`);
      
      if (contabilLinks.length > 0) {
        console.log('   Links encontrados:');
        contabilLinks.slice(0, 5).forEach(link => {
          console.log(`      - ${link.text} (${link.href || 'sem href'})`);
        });
      }
    } catch (err) {
      console.log(`   ❌ Erro: ${err.message}`);
    }

    // ========== TESTE 5: EXTRAIR ESTRUTURA DO DASHBOARD ==========
    console.log('\n📊 [5/5] Extraindo estrutura do dashboard...');
    
    await page.goto('https://stable.calima.app/mfp/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    const dashboardData = await page.evaluate(() => {
      // Extrair cards/widgets do dashboard
      const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="widget"], [class*="provisao"]'));
      
      return {
        totalCards: cards.length,
        cards: cards.slice(0, 10).map(card => ({
          class: card.className,
          text: card.textContent?.trim().substring(0, 100)
        })),
        // Tentar encontrar valores monetários
        valores: Array.from(document.querySelectorAll('[class*="valor"], [class*="total"]'))
          .map(el => el.textContent?.trim())
          .filter(text => text && text.includes('R$'))
          .slice(0, 5)
      };
    });
    
    results.dataExtraction.dashboard = dashboardData;
    console.log(`   ✅ Dashboard analisado: ${dashboardData.totalCards} cards encontrados`);
    
    if (dashboardData.valores.length > 0) {
      console.log('   Valores encontrados:');
      dashboardData.valores.forEach(valor => {
        console.log(`      - ${valor}`);
      });
    }

    // Screenshot final
    const finalScreenshot = join(__dirname, 'test-final-dashboard.png');
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    console.log(`\n📸 Screenshot final salvo: ${finalScreenshot}`);

    // Salvar resultados
    const resultsFile = join(__dirname, 'test-results.json');
    writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`💾 Resultados salvos em: ${resultsFile}`);

    // ========== RESUMO ==========
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO DOS TESTES');
    console.log('='.repeat(50));
    console.log(`✅ Autenticação: ${results.authentication ? 'OK' : 'FALHA'}`);
    console.log(`✅ Empresa identificada: ${results.empresa ? 'SIM' : 'NÃO'}`);
    console.log(`✅ Itens do menu testados: ${results.menuNavigation.length}`);
    console.log(`✅ Links contábeis encontrados: ${results.dataExtraction.contabilLinks?.length || 0}`);
    console.log(`✅ Cards no dashboard: ${results.dataExtraction.dashboard?.totalCards || 0}`);
    console.log('='.repeat(50));

    return results;

  } catch (error) {
    console.error('\n❌ Erro durante os testes:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔌 Navegador fechado.');
    }
  }
}

// Executar testes
testRealFeatures()
  .then(() => {
    console.log('\n✅ Todos os testes concluídos!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
