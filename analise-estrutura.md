# Análise da Estrutura do Calima - Conta do Usuário

## Informações da Conta

**Usuário:** 39948154878  
**Empresa:** LFG CONSULTORIA IMOBILIARIA LTDA  
**Código da Empresa:** 1  
**Referência Atual:** 06/2023  
**Versão do Calima:** Pro (5.3.10.3)

## Estrutura do Sistema

### URL Base
- **Login:** `https://www.calima.app/`
- **Dashboard:** `https://stable.calima.app/mfp/dashboard`
- **Domínio estável:** `stable.calima.app`

### Menu Lateral Identificado

1. **Home** - Dashboard principal
2. **Manutenção** - Cadastros e configurações
3. **Processos** - Operações contábeis
4. **Arquivos digitais** - SPED, eSocial, etc.
5. **eSocial** - Módulo específico
6. **Relatórios** - Geração de relatórios

### Módulos Visíveis

- **MÓDULO FOLHA DE PAGAMENTO** (banner vermelho no topo)
- **Provisão de Férias**
- **Provisão de Décimo Terceiro**
- **Provisões INSS/FGTS**

### Informações do Rodapé

- Registrado para: Pedro Tiago Corrêa Faria
- CPF: 399.481.548-78
- Código: 102154

## Descobertas Técnicas

### Seletores Úteis

```javascript
// Seletor de empresa
"[class*='empresa']"
// Exemplo: span.label-empresa-mobile-mfp

// Botão de seleção de empresa
"#companySelectorPopover"

// Container principal
"#root"
```

### Estrutura React

O Calima é uma aplicação **React** moderna (Single Page Application):
- Renderização dinâmica via JavaScript
- Navegação client-side
- Conteúdo carregado via AJAX/API interna

### Desafios Identificados

1. **Conteúdo Dinâmico:** A página carrega via JavaScript, necessitando aguardar renderização
2. **Menu Colapsado:** Links do menu podem estar ocultos inicialmente
3. **Referência de Período:** Sistema trabalha com referência mensal (06/2023)
4. **Autenticação Persistente:** Após login, redireciona para dashboard

## Próximos Passos Recomendados

1. ✅ Autenticação funcionando
2. ⏳ Mapear URLs específicas dos módulos
3. ⏳ Identificar seletores para extração de dados
4. ⏳ Testar navegação entre módulos
5. ⏳ Implementar extração de dados reais

## Observações

- A conta possui **Calima Pro** (versão paga)
- Há uma notificação sobre integração com Nirus (eSocial)
- Sistema está em referência 06/2023 (pode estar desatualizado)
- Histórico de versões disponível no rodapé
