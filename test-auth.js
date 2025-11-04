#!/usr/bin/env node

/**
 * Script de Teste de Autenticação no Calima
 * Verifica se as credenciais estão corretas e se o login funciona
 */

import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '.env') });

async function testAuthentication() {
  console.log('🔐 Iniciando teste de autenticação no Calima...\n');

  const username = process.env.CALIMA_USERNAME;
  const password = process.env.CALIMA_PASSWORD;

  if (!username || !password) {
    console.error('❌ Erro: Credenciais não configuradas no arquivo .env');
    process.exit(1);
  }

  console.log(`👤 Usuário: ${username}`);
  console.log(`🔑 Senha: ${'*'.repeat(password.length)}\n`);

  let browser = null;

  try {
    // Iniciar navegador
    console.log('🌐 Iniciando navegador...');
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    // Navegar para a página de login
    console.log('📄 Acessando página de login...');
    await page.goto('https://www.calima.app/', { waitUntil: 'networkidle' });

    // Preencher credenciais
    console.log('✍️  Preenchendo credenciais...');
    await page.fill(
      'input[aria-label="Usuário, CPF, e-mail, código de cliente ou CNPJ"]',
      username
    );
    await page.fill('input[aria-label="Senha"]', password);

    // Fazer login
    console.log('🚀 Fazendo login...');
    await page.click('button:has-text("Entrar")');

    // Aguardar redirecionamento
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Verificar se o login foi bem-sucedido
    const currentUrl = page.url();
    console.log(`📍 URL atual: ${currentUrl}\n`);

    if (currentUrl.includes('calima.app') && !currentUrl.includes('login')) {
      console.log('✅ SUCESSO! Autenticação realizada com sucesso!');
      console.log('🎉 Você está logado no Calima!\n');

      // Tentar extrair informações básicas
      try {
        const pageTitle = await page.title();
        console.log(`📋 Título da página: ${pageTitle}`);

        // Tirar screenshot
        const screenshotPath = join(__dirname, 'calima-logged-in.png');
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`📸 Screenshot salvo em: ${screenshotPath}`);
      } catch (err) {
        console.log('⚠️  Não foi possível extrair informações adicionais');
      }

      return true;
    } else {
      console.log('❌ FALHA! Não foi possível fazer login.');
      console.log('⚠️  Possíveis causas:');
      console.log('   - Credenciais incorretas');
      console.log('   - Conta bloqueada ou inativa');
      console.log('   - Problemas de conexão com o Calima\n');

      // Tirar screenshot do erro
      const screenshotPath = join(__dirname, 'calima-login-error.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot do erro salvo em: ${screenshotPath}`);

      return false;
    }
  } catch (error) {
    console.error('❌ Erro durante o teste de autenticação:');
    console.error(error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n🔌 Navegador fechado.');
    }
  }
}

// Executar teste
testAuthentication()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
