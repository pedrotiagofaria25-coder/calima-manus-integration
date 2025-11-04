#!/usr/bin/env python3
"""
Exemplo de Integração Calima × Manus usando Python
===================================================

Este script demonstra uma abordagem alternativa usando Python
e Playwright para automação do Calima ERP.

Útil para:
- Integração direta sem MCP
- Scripts de automação standalone
- Processamento em lote de dados contábeis
"""

import asyncio
import os
from playwright.async_api import async_playwright
import json
from datetime import datetime


class CalimaClient:
    """Cliente para interação com o Calima ERP via automação web"""

    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self.browser = None
        self.context = None
        self.page = None
        self.authenticated = False

    async def __aenter__(self):
        """Context manager entry"""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        await self.disconnect()

    async def connect(self):
        """Inicializa o navegador e faz login"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        self.page = await self.context.new_page()

        # Fazer login
        await self.page.goto('https://www.calima.app/')
        await self.page.fill(
            'input[aria-label="Usuário, CPF, e-mail, código de cliente ou CNPJ"]',
            self.username
        )
        await self.page.fill('input[aria-label="Senha"]', self.password)
        await self.page.click('button:has-text("Entrar")')

        # Aguardar login
        await self.page.wait_for_load_state('networkidle', timeout=30000)

        # Verificar autenticação
        current_url = self.page.url
        if 'calima.app' in current_url and 'login' not in current_url:
            self.authenticated = True
            print("✅ Autenticado com sucesso no Calima")
        else:
            raise Exception("❌ Falha na autenticação")

    async def disconnect(self):
        """Fecha o navegador"""
        if self.page:
            await self.page.close()
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        print("🔌 Desconectado do Calima")

    async def listar_empresas(self):
        """Lista empresas cadastradas"""
        if not self.authenticated:
            raise Exception("Não autenticado")

        await self.page.goto('https://www.calima.app/empresa', wait_until='networkidle')

        empresas = await self.page.evaluate('''() => {
            const empresaElements = document.querySelectorAll('[data-empresa]');
            const result = [];

            empresaElements.forEach(el => {
                const cnpj = el.getAttribute('data-cnpj') || '';
                const razaoSocial = el.querySelector('.razao-social')?.textContent?.trim() || '';
                const nomeFantasia = el.querySelector('.nome-fantasia')?.textContent?.trim() || '';

                if (cnpj) {
                    result.push({ cnpj, razaoSocial, nomeFantasia });
                }
            });

            return result;
        }''')

        return empresas

    async def consultar_saldo(self, cnpj: str, conta: str, data: str):
        """Consulta saldo de uma conta contábil"""
        if not self.authenticated:
            raise Exception("Não autenticado")

        url = f'https://www.calima.app/contabil/consulta-saldo?cnpj={cnpj}&conta={conta}&data={data}'
        await self.page.goto(url, wait_until='networkidle')

        saldo = await self.page.evaluate('''() => {
            const saldoElement = document.querySelector('.saldo-conta');
            return saldoElement ? saldoElement.textContent.trim() : 'N/A';
        }''')

        return {
            'cnpj': cnpj,
            'conta': conta,
            'data': data,
            'saldo': saldo
        }

    async def extrair_balancete(self, cnpj: str, data_inicio: str, data_fim: str):
        """Extrai balancete de verificação"""
        if not self.authenticated:
            raise Exception("Não autenticado")

        url = f'https://www.calima.app/contabil/balancete?cnpj={cnpj}&inicio={data_inicio}&fim={data_fim}'
        await self.page.goto(url, wait_until='networkidle')

        balancete = await self.page.evaluate('''() => {
            const linhas = document.querySelectorAll('table.balancete tbody tr');
            const contas = [];

            linhas.forEach(linha => {
                const cols = linha.querySelectorAll('td');
                if (cols.length >= 4) {
                    contas.push({
                        codigo: cols[0]?.textContent?.trim() || '',
                        descricao: cols[1]?.textContent?.trim() || '',
                        debito: cols[2]?.textContent?.trim() || '0,00',
                        credito: cols[3]?.textContent?.trim() || '0,00'
                    });
                }
            });

            return contas;
        }''')

        return {
            'cnpj': cnpj,
            'periodo': {'inicio': data_inicio, 'fim': data_fim},
            'contas': balancete
        }

    async def criar_lancamento(self, cnpj: str, lancamento: dict):
        """Cria um lançamento contábil"""
        if not self.authenticated:
            raise Exception("Não autenticado")

        await self.page.goto(
            f'https://www.calima.app/contabil/lancamentos?cnpj={cnpj}',
            wait_until='networkidle'
        )

        # Clicar em novo lançamento
        await self.page.click('button:has-text("Novo Lançamento")')
        await self.page.wait_for_selector('form.lancamento-form')

        # Preencher formulário
        await self.page.fill('input[name="data"]', lancamento['data'])
        await self.page.fill('input[name="historico"]', lancamento['historico'])
        await self.page.fill('input[name="conta_debito"]', lancamento['conta_debito'])
        await self.page.fill('input[name="valor_debito"]', lancamento['valor'])
        await self.page.fill('input[name="conta_credito"]', lancamento['conta_credito'])
        await self.page.fill('input[name="valor_credito"]', lancamento['valor'])

        # Salvar
        await self.page.click('button[type="submit"]')
        await self.page.wait_for_load_state('networkidle')

        # Verificar sucesso
        sucesso = await self.page.locator('.mensagem-sucesso').is_visible()

        return {
            'success': sucesso,
            'message': 'Lançamento criado' if sucesso else 'Erro ao criar lançamento'
        }


async def exemplo_uso():
    """Exemplo de uso do cliente Calima"""

    # Obter credenciais do ambiente
    username = os.getenv('CALIMA_USERNAME')
    password = os.getenv('CALIMA_PASSWORD')

    if not username or not password:
        print("❌ Configure CALIMA_USERNAME e CALIMA_PASSWORD")
        return

    # Usar context manager
    async with CalimaClient(username, password) as calima:

        # 1. Listar empresas
        print("\n📋 Listando empresas...")
        empresas = await calima.listar_empresas()
        print(json.dumps(empresas, indent=2, ensure_ascii=False))

        if not empresas:
            print("⚠️  Nenhuma empresa encontrada")
            return

        # Usar primeira empresa para exemplos
        cnpj = empresas[0]['cnpj']
        print(f"\n🏢 Usando empresa: {cnpj}")

        # 2. Consultar saldo
        print("\n💰 Consultando saldo...")
        saldo = await calima.consultar_saldo(
            cnpj=cnpj,
            conta='1.1.1.01.001',
            data='31/10/2025'
        )
        print(json.dumps(saldo, indent=2, ensure_ascii=False))

        # 3. Extrair balancete
        print("\n📊 Extraindo balancete...")
        balancete = await calima.extrair_balancete(
            cnpj=cnpj,
            data_inicio='01/10/2025',
            data_fim='31/10/2025'
        )
        print(f"Total de contas: {len(balancete['contas'])}")

        # 4. Criar lançamento (comentado para segurança)
        # print("\n✍️  Criando lançamento...")
        # resultado = await calima.criar_lancamento(
        #     cnpj=cnpj,
        #     lancamento={
        #         'data': '03/11/2025',
        #         'historico': 'Teste de integração',
        #         'conta_debito': '2.1.1.01.001',
        #         'conta_credito': '1.1.1.01.001',
        #         'valor': '100,00'
        #     }
        # )
        # print(json.dumps(resultado, indent=2, ensure_ascii=False))

    print("\n✅ Exemplo concluído!")


if __name__ == '__main__':
    # Executar exemplo
    asyncio.run(exemplo_uso())
