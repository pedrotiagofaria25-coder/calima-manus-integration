# Calima-Manus MCP Server

Servidor MCP (Model Context Protocol) para integração entre o **Calima ERP Contábil** e o **Manus**.

## 📋 Visão Geral

Este servidor permite que o Manus interaja com o sistema Calima ERP através de automação web, fornecendo ferramentas para:

- ✅ Listar empresas cadastradas
- ✅ Consultar saldos de contas contábeis
- ✅ Extrair balancetes de verificação
- ✅ Criar lançamentos contábeis
- ✅ Verificar status da conexão

## ⚠️ Avisos Importantes

1. **Não é uma API oficial**: Este servidor utiliza automação web (web scraping) para interagir com o Calima
2. **Credenciais necessárias**: Requer login e senha válidos do Calima ERP
3. **Manutenção**: Pode quebrar se o Calima alterar sua interface web
4. **Termos de uso**: Verifique se o uso está de acordo com os termos do Calima
5. **Uso responsável**: Use apenas com suas próprias contas e dados

## 🚀 Instalação

### Pré-requisitos

- Node.js 18 ou superior
- npm ou pnpm
- Conta ativa no Calima ERP

### Passo 1: Instalar Dependências

```bash
cd calima-manus-mcp
npm install
```

### Passo 2: Instalar Navegador Playwright

```bash
npx playwright install chromium
```

### Passo 3: Configurar Credenciais

Crie um arquivo `.env` na raiz do projeto:

```bash
CALIMA_USERNAME=seu_usuario_ou_cnpj
CALIMA_PASSWORD=sua_senha
```

**Importante:** Nunca compartilhe ou versione o arquivo `.env` com credenciais reais.

## 🔧 Configuração no Manus

### Opção 1: Configuração Manual

Adicione o servidor MCP ao arquivo de configuração do Manus:

**No Windows** (`%APPDATA%\Manus\mcp_config.json`):
```json
{
  "mcpServers": {
    "calima": {
      "command": "node",
      "args": ["C:\\caminho\\para\\calima-manus-mcp\\index.js"],
      "env": {
        "CALIMA_USERNAME": "seu_usuario",
        "CALIMA_PASSWORD": "sua_senha"
      }
    }
  }
}
```

**No macOS/Linux** (`~/.config/manus/mcp_config.json`):
```json
{
  "mcpServers": {
    "calima": {
      "command": "node",
      "args": ["/caminho/para/calima-manus-mcp/index.js"],
      "env": {
        "CALIMA_USERNAME": "seu_usuario",
        "CALIMA_PASSWORD": "sua_senha"
      }
    }
  }
}
```

### Opção 2: Usando manus-mcp-cli

```bash
# Listar ferramentas disponíveis
manus-mcp-cli tool list --server calima

# Chamar uma ferramenta
manus-mcp-cli tool call calima_listar_empresas --server calima --input '{}'
```

## 📚 Ferramentas Disponíveis

### 1. `calima_verificar_status`

Verifica se a conexão com o Calima está ativa.

**Exemplo:**
```bash
manus-mcp-cli tool call calima_verificar_status --server calima --input '{}'
```

**Resposta:**
```json
{
  "success": true,
  "authenticated": true,
  "message": "Conexão ativa com o Calima"
}
```

---

### 2. `calima_listar_empresas`

Lista todas as empresas cadastradas no Calima.

**Exemplo:**
```bash
manus-mcp-cli tool call calima_listar_empresas --server calima --input '{}'
```

**Resposta:**
```json
{
  "success": true,
  "empresas": [
    {
      "cnpj": "12.345.678/0001-90",
      "razaoSocial": "Empresa Exemplo LTDA",
      "nomeFantasia": "Exemplo"
    }
  ],
  "total": 1
}
```

---

### 3. `calima_consultar_saldo`

Consulta o saldo de uma conta contábil específica.

**Parâmetros:**
- `cnpj` (string): CNPJ da empresa
- `conta_contabil` (string): Código da conta contábil
- `data` (string): Data da consulta (DD/MM/AAAA)

**Exemplo:**
```bash
manus-mcp-cli tool call calima_consultar_saldo --server calima --input '{
  "cnpj": "12.345.678/0001-90",
  "conta_contabil": "1.1.1.01.001",
  "data": "31/10/2025"
}'
```

**Resposta:**
```json
{
  "success": true,
  "cnpj": "12.345.678/0001-90",
  "conta": "1.1.1.01.001",
  "data": "31/10/2025",
  "saldo": "R$ 15.000,00"
}
```

---

### 4. `calima_extrair_balancete`

Extrai o balancete de verificação de um período.

**Parâmetros:**
- `cnpj` (string): CNPJ da empresa
- `data_inicio` (string): Data inicial (DD/MM/AAAA)
- `data_fim` (string): Data final (DD/MM/AAAA)

**Exemplo:**
```bash
manus-mcp-cli tool call calima_extrair_balancete --server calima --input '{
  "cnpj": "12.345.678/0001-90",
  "data_inicio": "01/10/2025",
  "data_fim": "31/10/2025"
}'
```

**Resposta:**
```json
{
  "success": true,
  "cnpj": "12.345.678/0001-90",
  "periodo": {
    "inicio": "01/10/2025",
    "fim": "31/10/2025"
  },
  "contas": [
    {
      "codigo": "1.1.1.01.001",
      "descricao": "Caixa Geral",
      "debito": "50.000,00",
      "credito": "35.000,00"
    }
  ],
  "total": 1
}
```

---

### 5. `calima_criar_lancamento`

Cria um novo lançamento contábil.

**Parâmetros:**
- `cnpj` (string): CNPJ da empresa
- `data` (string): Data do lançamento (DD/MM/AAAA)
- `historico` (string): Descrição do lançamento
- `conta_debito` (string): Código da conta de débito
- `conta_credito` (string): Código da conta de crédito
- `valor` (string): Valor (formato: 0.000,00)

**Exemplo:**
```bash
manus-mcp-cli tool call calima_criar_lancamento --server calima --input '{
  "cnpj": "12.345.678/0001-90",
  "data": "03/11/2025",
  "historico": "Pagamento de fornecedor",
  "conta_debito": "2.1.1.01.001",
  "conta_credito": "1.1.1.01.001",
  "valor": "5.000,00"
}'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Lançamento criado com sucesso"
}
```

## 🎯 Casos de Uso com Manus

### Exemplo 1: Consultar Saldo via Chat

No Manus, você pode simplesmente perguntar:

> "Qual o saldo da conta caixa (1.1.1.01.001) da empresa 12.345.678/0001-90 em 31/10/2025?"

O Manus automaticamente chamará `calima_consultar_saldo` e retornará o resultado.

### Exemplo 2: Gerar Relatório de Balancete

> "Extraia o balancete da empresa 12.345.678/0001-90 do período de 01/10/2025 a 31/10/2025 e crie um relatório em PDF"

O Manus irá:
1. Chamar `calima_extrair_balancete`
2. Processar os dados retornados
3. Gerar um PDF formatado com o balancete

### Exemplo 3: Criar Lançamentos em Lote

> "Crie os seguintes lançamentos contábeis para a empresa 12.345.678/0001-90:
> - Pagamento de aluguel: R$ 3.000,00
> - Recebimento de cliente: R$ 10.000,00
> - Compra de material: R$ 1.500,00"

O Manus processará a solicitação e criará múltiplos lançamentos usando `calima_criar_lancamento`.

## 🔍 Troubleshooting

### Erro: "Credenciais não configuradas"

**Solução:** Certifique-se de que as variáveis `CALIMA_USERNAME` e `CALIMA_PASSWORD` estão definidas no arquivo de configuração MCP.

### Erro: "Falha na autenticação"

**Solução:** Verifique se as credenciais estão corretas. Tente fazer login manualmente no Calima para confirmar.

### Erro: "Timeout" ou "Elemento não encontrado"

**Solução:** O Calima pode ter alterado sua interface. Será necessário atualizar os seletores no código `index.js`.

### Navegador não fecha

**Solução:** O servidor fecha o navegador automaticamente ao receber SIGINT/SIGTERM. Use `Ctrl+C` para encerrar corretamente.

## 🛠️ Desenvolvimento e Customização

### Estrutura do Código

```
calima-manus-mcp/
├── index.js          # Servidor MCP principal
├── package.json      # Dependências
└── README.md         # Esta documentação
```

### Adicionar Novas Ferramentas

Para adicionar uma nova ferramenta MCP:

1. **Defina a função** que implementa a lógica
2. **Registre a ferramenta** em `ListToolsRequestSchema`
3. **Adicione o handler** em `CallToolRequestSchema`

**Exemplo:**

```javascript
// 1. Implementar função
async function exportarPlanoContas(cnpj) {
  await initializeBrowser();
  // ... lógica de extração
  return { success: true, contas: [...] };
}

// 2. Registrar ferramenta
{
  name: 'calima_exportar_plano_contas',
  description: 'Exporta o plano de contas da empresa',
  inputSchema: {
    type: 'object',
    properties: {
      cnpj: { type: 'string', description: 'CNPJ da empresa' }
    },
    required: ['cnpj']
  }
}

// 3. Adicionar handler
case 'calima_exportar_plano_contas': {
  const result = await exportarPlanoContas(args.cnpj);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}
```

### Ajustar Seletores

Os seletores CSS/XPath podem precisar de ajustes conforme o Calima atualiza sua interface. Localize e atualize em `index.js`:

```javascript
// Exemplo de seletor que pode precisar ajuste
await page.fill('input[aria-label="Usuário, CPF, e-mail, código de cliente ou CNPJ"]', username);
```

## 📄 Licença

MIT License - Sinta-se livre para usar e modificar.

## ⚖️ Disclaimer

Este projeto não é oficial nem afiliado à Projetus TI ou ao Calima ERP. Use por sua conta e risco. Os desenvolvedores não se responsabilizam por:

- Violação de termos de uso do Calima
- Perda ou corrupção de dados
- Problemas de segurança
- Indisponibilidade do serviço

**Recomendação:** Entre em contato com a Projetus TI para solicitar uma API oficial.

## 🤝 Contribuições

Contribuições são bem-vindas! Sinta-se livre para abrir issues ou pull requests.

## 📞 Suporte

Para questões sobre o Calima ERP, entre em contato com a Projetus TI:
- Site: https://www.calimaerp.com/
- Telefone: (32) 3112-1500
- WhatsApp: (32) 3112-1503

Para questões sobre este servidor MCP, abra uma issue no repositório do projeto.
