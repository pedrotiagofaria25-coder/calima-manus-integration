#!/usr/bin/env node

/**
 * Script de Exploração do Calima
 * Navega pelo sistema para descobrir a estrutura real e URLs
 */

import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

async function exploreCalima() {
  console.log('🔍 Explorando estrutura do Calima...\n');

  const username = process.env.CALIMA_USERNAME;
  const password = process.env.CALIMA_PASSWORD;

  let browser = null;
  const discoveries = {
    urls: [],
    menuItems: [],
    empresas: [],
    screenshots: []
  };

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    const page = await context.newPage();

    // Login
    console.log('🔐 Fazendo login...');
    await page.goto('https://www.calima.app/', { waitUntil: 'networkidle' });
    await page.fill('input[aria-label="Usuário, CPF, e-mail, código de cliente ou CNPJ"]', username);
    await page.fill('input[aria-label="Senha"]', password);
    await page.click('button:has-text("Entrar")');
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const currentUrl = page.url();
    console.log(`📍 URL após login: ${currentUrl}\n`);
    discoveries.urls.push({ context: 'Após login', url: currentUrl });

    // Aguardar um pouco para a página carregar completamente
    await page.waitForTimeout(3000);

    // Tentar encontrar menu principal
    console.log('📋 Procurando menu principal...');
    const menuLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      return links
        .map(link => ({
          text: link.textContent?.trim() || '',
          href: link.getAttribute('href') || '',
          class: link.className || ''
        }))
        .filter(link => link.text && link.text.length > 0 && link.text.length < 50);
    });

    discoveries.menuItems = menuLinks.slice(0, 30);
    console.log(`✅ Encontrados ${menuLinks.length} links/botões\n`);

    // Screenshot da página principal
    const mainScreenshot = join(__dirname, 'calima-main-page.png');
    await page.screenshot({ path: mainScreenshot, fullPage: true });
    discoveries.screenshots.push(mainScreenshot);
    console.log(`📸 Screenshot da página principal salvo\n`);

    // Tentar acessar diferentes seções
    const sectionsToTry = [
      '/empresa',
      '/empresas',
      '/dashboard',
      '/home',
      '/principal',
      '/contabil',
      '/fiscal'
    ];

    for (const section of sectionsToTry) {
      try {
        const testUrl = `https://www.calima.app${section}`;
        console.log(`🔍 Testando: ${testUrl}`);
        
        const response = await page.goto(testUrl, { 
          waitUntil: 'networkidle',
          timeout: 10000 
        });
        
        if (response && response.ok()) {
          const finalUrl = page.url();
          console.log(`   ✅ Acessível: ${finalUrl}`);
          discoveries.urls.push({ context: `Seção ${section}`, url: finalUrl });
          
          // Screenshot
          const sectionScreenshot = join(__dirname, `calima-${section.replace('/', '')}.png`);
          await page.screenshot({ path: sectionScreenshot, fullPage: true });
          discoveries.screenshots.push(sectionScreenshot);
        }
      } catch (err) {
        console.log(`   ❌ Não acessível ou timeout`);
      }
    }

    // Tentar extrair informações de empresas
    console.log('\n🏢 Procurando empresas cadastradas...');
    
    // Tentar diferentes seletores comuns
    const empresaSelectors = [
      '[data-empresa]',
      '.empresa',
      '[class*="empresa"]',
      '[id*="empresa"]',
      'table tbody tr',
      '.list-item',
      '[role="listitem"]'
    ];

    for (const selector of empresaSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`   ✅ Encontrado ${elements.length} elementos com seletor: ${selector}`);
          
          const empresaData = await page.evaluate((sel) => {
            const elements = document.querySelectorAll(sel);
            return Array.from(elements).slice(0, 5).map(el => ({
              html: el.outerHTML.substring(0, 200),
              text: el.textContent?.trim().substring(0, 100)
            }));
          }, selector);
          
          discoveries.empresas.push({ selector, count: elements.length, sample: empresaData });
        }
      } catch (err) {
        // Ignorar erros de seletores inválidos
      }
    }

    // Extrair estrutura HTML da página
    console.log('\n📄 Extraindo estrutura da página...');
    const pageStructure = await page.evaluate(() => {
      const body = document.body;
      const mainElements = Array.from(body.children).map(el => ({
        tag: el.tagName,
        id: el.id || '',
        class: el.className || '',
        children: el.children.length
      }));
      return mainElements;
    });

    discoveries.pageStructure = pageStructure;

    // Salvar descobertas em arquivo JSON
    const discoveryFile = join(__dirname, 'calima-discoveries.json');
    writeFileSync(discoveryFile, JSON.stringify(discoveries, null, 2));
    console.log(`\n💾 Descobertas salvas em: ${discoveryFile}`);

    // Resumo
    console.log('\n📊 RESUMO DA EXPLORAÇÃO:');
    console.log(`   URLs testadas: ${discoveries.urls.length}`);
    console.log(`   Menu items encontrados: ${discoveries.menuItems.length}`);
    console.log(`   Screenshots capturados: ${discoveries.screenshots.length}`);
    console.log(`   Seletores de empresa testados: ${discoveries.empresas.length}`);

    return discoveries;

  } catch (error) {
    console.error('❌ Erro durante exploração:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n🔌 Navegador fechado.');
    }
  }
}

// Executar exploração
exploreCalima()
  .then((discoveries) => {
    console.log('\n✅ Exploração concluída com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
