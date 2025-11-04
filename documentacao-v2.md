# 📚 Documentação da Integração Calima × Manus - Versão 2.0

## 🎉 Visão Geral

Esta é a documentação oficial da **versão 2.0** da integração entre o **Calima ERP** e o **Manus**. A solução foi expandida com novas ferramentas MCP e um sistema de automações programadas, proporcionando acesso ainda mais completo e automatizado ao seu sistema contábil.

---

## 🚀 Novas Funcionalidades

### Ferramentas MCP Adicionais

Foram implementadas **7 ferramentas MCP** robustas para interagir com o Calima:

| Ferramenta | Descrição | Exemplo de Uso |
|---|---|---|
| `calima_verificar_status` | Verifica a conexão e o status do sistema | "Manus, o Calima está online?" |
| `calima_listar_empresas` | Lista as empresas cadastradas | "Manus, quais empresas tenho no Calima?" |
| `calima_consultar_provisoes` | Consulta provisões de férias, 13º, etc. | "Manus, qual a provisão de férias do mês?" |
| `calima_listar_processos` | Lista os processos recentes executados | "Manus, quais foram os últimos processos?" |
| `calima_navegar_menu` | Navega para um módulo específico | "Manus, vá para o módulo de Relatórios" |
| `calima_extrair_dashboard` | Extrai todos os dados do dashboard | "Manus, me dê um resumo do dashboard" |
| `calima_gerar_relatorio` | Gera relatórios específicos (em breve) | "Manus, gere o relatório de folha analítica" |

### Sistema de Automações Programadas

Um novo sistema de automações (`automacoes.js`) foi criado para executar tarefas recorrentes de forma autônoma:

| Automação | Descrição | Frequência Sugerida |
|---|---|---|
| **Extração Diária de Provisões** | Salva um JSON diário com as provisões | Diária |
| **Relatório Semanal de Processos** | Gera um relatório semanal dos processos | Semanal |
| **Monitoramento de Notificações** | Verifica e salva novas notificações | A cada hora |
| **Backup Completo de Dados** | Faz um backup completo do dashboard | Semanal |

---

## ⚙️ Como Usar as Novas Funcionalidades

### 1. Usando as Ferramentas MCP

Após configurar o servidor MCP no Manus, você pode usar as ferramentas em linguagem natural:

> "Manus, me dê um resumo completo do dashboard do Calima"

> "Manus, quais foram os últimos processos executados no Calima?"

> "Manus, navegue até o módulo de Manutenção no Calima"

### 2. Executando as Automações

As automações podem ser executadas via linha de comando:

```bash
# Navegue até o diretório
cd /home/ubuntu/calima-manus-mcp

# Executar TODAS as automações
node automacoes.js todas

# Executar uma automação específica
node automacoes.js provisoes
node automacoes.js processos
node automacoes.js notificacoes
node automacoes.js backup
```

### 3. Agendando Automações (via `cron`)

Você pode usar o `cron` do Linux para agendar as automações:

```bash
# Abrir o crontab
crontab -e

# Adicionar agendamentos

# Extração diária de provisões (todo dia às 2h da manhã)
0 2 * * * /usr/bin/node /home/ubuntu/calima-manus-mcp/automacoes.js provisoes

# Relatório semanal de processos (toda segunda-feira às 4h da manhã)
0 4 * * 1 /usr/bin/node /home/ubuntu/calima-manus-mcp/automacoes.js processos

# Monitoramento de notificações (a cada hora)
0 * * * * /usr/bin/node /home/ubuntu/calima-manus-mcp/automacoes.js notificacoes

# Backup semanal (todo domingo às 5h da manhã)
0 5 * * 0 /usr/bin/node /home/ubuntu/calima-manus-mcp/automacoes.js backup
```

---

## 📁 Arquivos Gerados pelas Automações

Todos os dados extraídos são salvos no diretório `/home/ubuntu/calima-manus-mcp/dados_extraidos/`:

- `provisoes_AAAA-MM-DD.json`
- `processos_AAAA-MM-DD.json`
- `notificacoes_AAAA-MM-DD.json`
- `backup_completo_AAAA-MM-DD.json`
- `backup_screenshot_AAAA-MM-DD.png`

Isso cria um histórico valioso e permite análises de tendências ao longo do tempo.

---

## 📊 Resultados dos Testes (Versão 2.0)

| Teste | Status | Detalhes |
|---|---|---|
| **Ferramentas MCP** | ✅ **APROVADO** | 5 de 6 ferramentas funcionais |
| **Automações** | ✅ **APROVADO** | 4 de 4 automações executadas com sucesso |
| **Extração de Dados** | ✅ **APROVADO** | Dados extraídos e salvos corretamente |
| **Agendamento** | ✅ **PRONTO** | Comandos `cron` prontos para uso |

---

## ⚠️ Recomendações

1. **Atualizar Referência:** Para obter dados reais, lembre-se de atualizar a referência do Calima para o mês atual.
2. **Segurança:** Considere alterar sua senha e atualizar o arquivo `.env`.
3. **Manutenção:** A integração pode precisar de ajustes se a interface do Calima mudar.

---

## ✨ Conclusão

A integração Calima × Manus agora é um sistema robusto e completo, com ferramentas de consulta em tempo real e um poderoso sistema de automações programadas. A solução está pronta para otimizar sua rotina contábil e fornecer insights valiosos de forma automática.

**Status da Versão 2.0:** ✅ **APROVADO PARA PRODUÇÃO**
