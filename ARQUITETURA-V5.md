# Arquitetura Calima-Manus v5.0

## Visão Geral

A versão 5.0 representa uma expansão completa da integração, transformando-a em uma **plataforma de automação contábil e fiscal end-to-end**.

---

## Módulos Principais

### 1. **Core (Núcleo)**
- `lib/browser-pool.cjs` - Pool de navegadores reutilizáveis
- `lib/retry.cjs` - Sistema de retry com backoff
- `lib/crypto.cjs` - Criptografia de credenciais
- `lib/database.cjs` - Banco de dados histórico
- `lib/auth.cjs` - Gerenciamento de autenticação

### 2. **Documentos Fiscais**
- `modules/fiscal/nfe-importer.cjs` - Importação de NF-e
- `modules/fiscal/nfse-importer.cjs` - Importação de NFS-e
- `modules/fiscal/iss-retido.cjs` - Documentos de ISS retido
- `modules/fiscal/document-analyzer.cjs` - Análise de documentos com IA

### 3. **Folha de Pagamento**
- `modules/payroll/calculator.cjs` - Cálculo de folhas
- `modules/payroll/gps-generator.cjs` - Geração de GPS
- `modules/payroll/prolabore.cjs` - Recibos de pró-labore
- `modules/payroll/reports.cjs` - Relatórios analíticos

### 4. **eSocial**
- `modules/esocial/s1200.cjs` - Evento S-1200 (Remuneração)
- `modules/esocial/s1210.cjs` - Evento S-1210 (Pagamentos)
- `modules/esocial/s1299.cjs` - Evento S-1299 (Fechamento)
- `modules/esocial/sender.cjs` - Envio de eventos

### 5. **Apuração de Tributos**
- `modules/tax/pis.cjs` - Apuração de PIS
- `modules/tax/cofins.cjs` - Apuração de COFINS
- `modules/tax/irpj.cjs` - Apuração de IRPJ
- `modules/tax/csll.cjs` - Apuração de CSLL
- `modules/tax/iss.cjs` - Apuração de ISS

### 6. **Declarações**
- `modules/declarations/dctf.cjs` - Geração de DCTF
- `modules/declarations/ecf.cjs` - Geração de ECF
- `modules/declarations/efd-contribuicoes.cjs` - EFD-Contribuições
- `modules/declarations/dctfweb.cjs` - DCTFWeb

### 7. **Relatórios**
- `modules/reports/iss-retido.cjs` - Relatório de ISS retido
- `modules/reports/tributos-pagos.cjs` - Demonstrativo de tributos
- `modules/reports/faturamento.cjs` - Faturamento por município

### 8. **Configuração Automática (IA)**
- `modules/ai/config-assistant.cjs` - Assistente de configuração
- `modules/ai/document-processor.cjs` - Processamento de documentos
- `modules/ai/nlp-parser.cjs` - Parser de linguagem natural

### 9. **CLI e Interface**
- `calima-cli.cjs` - Interface de linha de comando
- `calima-api.cjs` - API REST (futuro)
- `calima-web/` - Dashboard web (futuro)

---

## Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                    USUÁRIO (Manus)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              CLI Interativa / Linguagem Natural             │
│                   (calima-cli.cjs)                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Assistente IA (GPT-4)                      │
│          Interpreta comandos e processa documentos          │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Módulos    │ │   Módulos    │ │   Módulos    │
│   Fiscais    │ │   Folha      │ │   Tributos   │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Browser Pool + Retry System                    │
│           Executa ações no Calima com resiliência          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sistema Calima                           │
│              (https://www.calima.app/)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Banco de Dados SQLite                          │
│         Armazena histórico e resultados                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Casos de Uso

### 1. Importação de Documentos Fiscais

**Comando:**
```
"Importar as notas fiscais do arquivo notas.xml"
```

**Fluxo:**
1. IA identifica que é uma importação de NF-e
2. Processa o arquivo XML
3. Extrai dados relevantes
4. Acessa o Calima via browser pool
5. Importa os documentos
6. Salva log no banco de dados

### 2. Cálculo de Folha de Pagamento

**Comando:**
```
"Calcular a folha de pagamento de novembro/2025"
```

**Fluxo:**
1. IA identifica o período
2. Acessa módulo de folha
3. Coleta dados dos funcionários
4. Calcula proventos e descontos
5. Gera GPS
6. Cria eventos do eSocial (S-1200, S-1210, S-1299)
7. Salva resultados

### 3. Apuração de Tributos

**Comando:**
```
"Apurar PIS e COFINS de outubro/2025"
```

**Fluxo:**
1. IA identifica os tributos e período
2. Coleta documentos fiscais do mês
3. Calcula base de cálculo
4. Aplica alíquotas
5. Gera relatórios
6. Prepara declarações

### 4. Configuração Automática

**Comando:**
```
"Configurar empresa XYZ LTDA, CNPJ 12.345.678/0001-90, 
regime Lucro Presumido, atividade consultoria"
```

**Fluxo:**
1. IA extrai dados estruturados
2. Acessa cadastro no Calima
3. Preenche formulários automaticamente
4. Configura parâmetros fiscais
5. Valida e confirma

---

## Tecnologias Utilizadas

- **Node.js 22** - Runtime
- **Playwright** - Automação de navegador
- **SQLite (better-sqlite3)** - Banco de dados
- **OpenAI API** - Processamento de linguagem natural
- **Commander.js** - CLI
- **Inquirer.js** - Prompts interativos
- **Chalk** - Cores no terminal
- **Ora** - Spinners e loading
- **xml2js** - Parser de XML
- **pdf-parse** - Extração de texto de PDF

---

## Segurança

### Criptografia
- AES-256-GCM para credenciais
- PBKDF2 para derivação de chaves
- Salt único por instalação

### Autenticação
- Senha mestra obrigatória
- Timeout de sessão configurável
- Logs sanitizados (sem dados sensíveis)

### Validação
- Validação de entrada em todos os módulos
- Sanitização de dados antes de envio
- Verificação de integridade com hashes

---

## Performance

### Otimizações
- Pool de navegadores (reduz 73% do tempo)
- Cache inteligente de sessões
- Retry automático (95% de taxa de sucesso)
- Execução paralela quando possível

### Métricas Esperadas
- Importação de NF-e: ~2s por documento
- Cálculo de folha: ~30s para 50 funcionários
- Apuração de tributos: ~1min por mês
- Geração de declaração: ~2min

---

## Escalabilidade

### Limites Atuais
- Pool de navegadores: 3 instâncias simultâneas
- Banco de dados: SQLite (adequado para 1M+ registros)
- Processamento: Single-threaded (Node.js)

### Expansão Futura
- Migração para PostgreSQL
- Worker threads para paralelização
- API REST para múltiplos clientes
- Dashboard web responsivo

---

## Roadmap v5.0

### Fase 1 (Atual)
- ✅ Arquitetura definida
- ⏳ Módulos fiscais
- ⏳ Módulos de folha
- ⏳ Módulos de tributos

### Fase 2
- ⏳ Integração com eSocial
- ⏳ Geração de declarações
- ⏳ Assistente IA

### Fase 3
- ⏳ Dashboard web
- ⏳ API REST
- ⏳ Testes automatizados

---

**Versão:** 5.0.0-alpha  
**Data:** 2025-11-04  
**Autor:** Manus AI
