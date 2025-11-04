# Guia de Implementação - Calima-Manus v5.0

## Visão Geral

Este guia descreve como implementar os novos módulos da versão 5.0, usando a arquitetura e os templates fornecidos.

---

## Passo a Passo para Criar um Novo Módulo

### 1. **Copiar o Template**

Copie o arquivo `MODULE_TEMPLATE.cjs` para o diretório apropriado em `modules/`.

**Exemplo:**
```bash
cp MODULE_TEMPLATE.cjs modules/payroll/calculator.cjs
```

### 2. **Renomear a Classe e Funções**

- Renomeie `NomeDaClasse` para algo descritivo (ex: `PayrollCalculator`).
- Renomeie `executar` para a ação principal (ex: `calculateMonthly`).

### 3. **Implementar a Lógica de Negócio**

Dentro da função principal (`executar`):

1. **Navegue** para a área correta do Calima.
2. **Preencha** os formulários com os parâmetros recebidos.
3. **Execute** as ações (cliques, envios).
4. **Extraia** os resultados da tela.
5. **Retorne** os dados de forma estruturada.

**Dica:** Use o `retryBrowserOperation` para garantir a resiliência da sua automação.

### 4. **Integrar com o Banco de Dados**

- Use `this.db` para acessar o banco de dados.
- **Logue** o início e o fim de cada execução.
- **Salve** os resultados extraídos nas tabelas apropriadas.

**Exemplo:**
```javascript
this.db.logExecucao("calculo_folha", "sucesso", duration);
this.db.insertFolhaPagamento(empresaId, resultados);
```

### 5. **Integrar com a CLI**

Abra o arquivo `calima-cli.cjs` e adicione um novo comando para o seu módulo.

**Exemplo:**
```javascript
program
    .command("folha:calcular <mes>")
    .description("Calcula a folha de pagamento de um mês")
    .action(async (mes) => {
        const spinner = ora("Calculando folha...").start();
        
        const payroll = new PayrollCalculator();
        const resultado = await payroll.calculateMonthly({ mes }, credentials);
        
        spinner.succeed("Folha calculada com sucesso!");
        console.log(resultado);
    });
```

### 6. **Documentar o Módulo**

- Adicione comentários claros no topo do arquivo.
- Descreva os parâmetros e o que a função retorna.
- Inclua exemplos de uso.

### 7. **Testar Extensivamente**

- Teste com diferentes cenários e parâmetros.
- Teste o tratamento de erros.
- Verifique se os dados são salvos corretamente no banco.

---

## Exemplo Prático: Módulo de Cálculo de Folha

### 1. **Arquivo:** `modules/payroll/calculator.cjs`

```javascript
const { retryBrowserOperation } = require("../../lib/retry.cjs");
// ... outros imports

class PayrollCalculator {
    // ... constructor

    async calculateMonthly(params, credentials) {
        // ... lógica de login e navegação

        await page.fill("#mes_referencia", params.mes);
        await page.click("#btn_calcular");

        const resultado = await page.textContent("#resultado_calculo");

        this.db.logExecucao("calculo_folha", "sucesso", ...);

        return { mes: params.mes, resultado };
    }
}
```

### 2. **CLI:** `calima-cli.cjs`

```javascript
program
    .command("folha:calcular <mes>")
    // ...
```

### 3. **Uso:**

```bash
./calima-cli.cjs folha:calcular 11/2025
```

---

## Próximos Passos Recomendados

1. **Implementar `modules/payroll/calculator.cjs`** (Cálculo de Folha)
2. **Implementar `modules/esocial/sender.cjs`** (Envio ao eSocial)
3. **Implementar `modules/tax/pis.cjs`** (Apuração de PIS)
4. **Implementar `modules/declarations/dctf.cjs`** (Geração de DCTF)
5. **Implementar `modules/ai/config-assistant.cjs`** (Assistente IA)

---

## Conclusão

Com esta arquitetura e guia, você tem uma base sólida para construir uma solução de automação completa e robusta. Cada novo módulo seguirá o mesmo padrão, garantindo consistência e manutenibilidade.

**Lembre-se:** comece pequeno, implemente um módulo de cada vez e teste extensivamente.
