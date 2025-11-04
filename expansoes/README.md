# Expansões - Calima-Manus

Este diretório contém módulos de expansão para adicionar novas funcionalidades à integração Calima-Manus.

## Expansões Disponíveis

### 1. Gerador de Relatórios PDF

**Arquivo:** `gerar-relatorio-pdf.js`

**Descrição:** Gera relatórios contábeis em formato PDF a partir dos dados extraídos do Calima.

**Instalação:**
```bash
npm install puppeteer
```

**Uso:**
```bash
node expansoes/gerar-relatorio-pdf.js provisoes 2025-11
node expansoes/gerar-relatorio-pdf.js processos 2025-11
node expansoes/gerar-relatorio-pdf.js completo 2025-11
```

**Saída:** Arquivos PDF salvos em `/relatorios/`

---

## Como Criar Novas Expansões

### Estrutura Básica

```javascript
#!/usr/bin/env node

/**
 * Nome da Expansão
 * Descrição breve
 */

const fs = require('fs');
const path = require('path');

// Configurações
const DADOS_DIR = path.join(__dirname, '..', 'dados_extraidos');

// Função principal
async function main() {
    console.log('Executando expansão...');
    // Sua lógica aqui
}

// Executar
main().catch(error => {
    console.error('Erro:', error);
    process.exit(1);
});
```

### Boas Práticas

1. **Documentação:** Sempre inclua comentários e documentação clara
2. **Tratamento de Erros:** Use try/catch e trate erros adequadamente
3. **Logs:** Forneça feedback claro sobre o que está acontecendo
4. **Configuração:** Use variáveis de ambiente para configurações sensíveis
5. **Testes:** Teste extensivamente antes de usar em produção

### Checklist para Nova Expansão

- [ ] Criar arquivo `.js` ou `.cjs` no diretório `expansoes/`
- [ ] Adicionar shebang `#!/usr/bin/env node`
- [ ] Tornar executável: `chmod +x arquivo.js`
- [ ] Documentar uso no cabeçalho do arquivo
- [ ] Adicionar entrada neste README
- [ ] Atualizar `expansoes-futuras.md` se aplicável
- [ ] Testar com dados reais
- [ ] Adicionar ao sistema de monitoramento se necessário

---

## Expansões Planejadas

Veja o arquivo `expansoes-futuras.md` na raiz do projeto para uma lista completa de expansões planejadas.

### Próximas Implementações

1. **Integração WhatsApp/Telegram** - Notificações via mensageiros
2. **Dashboard Web** - Interface visual para dados
3. **Análise Preditiva** - IA para previsões e insights
4. **Backup em Nuvem** - Sincronização automática
5. **Alertas Inteligentes** - Sistema de notificações customizadas

---

## Contribuindo

Para contribuir com novas expansões:

1. Crie um branch: `git checkout -b feature/nova-expansao`
2. Desenvolva a expansão seguindo as boas práticas
3. Teste extensivamente
4. Documente completamente
5. Faça um pull request

---

## Suporte

Para dúvidas ou problemas com expansões:

- Verifique a documentação no cabeçalho do arquivo
- Consulte o arquivo `expansoes-futuras.md`
- Execute com `--help` se disponível

---

**Última atualização:** 2025-11-04
