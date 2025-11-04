#!/usr/bin/env node

/**
 * Sistema de Monitoramento de Logs - Calima-Manus
 * 
 * Este script monitora os logs das automações e gera relatórios
 * sobre o status, erros e estatísticas de execução.
 */

const fs = require('fs');
const path = require('path');

// Configurações
const LOGS_DIR = path.join(__dirname, 'logs');
const DADOS_DIR = path.join(__dirname, 'dados_extraidos');
const RELATORIO_DIR = path.join(__dirname, 'relatorios');

// Criar diretórios se não existirem
[LOGS_DIR, DADOS_DIR, RELATORIO_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

/**
 * Analisa um arquivo de log e extrai estatísticas
 */
function analisarLog(caminhoLog) {
    if (!fs.existsSync(caminhoLog)) {
        return {
            existe: false,
            linhas: 0,
            erros: 0,
            sucessos: 0,
            ultimaExecucao: null
        };
    }

    const conteudo = fs.readFileSync(caminhoLog, 'utf-8');
    const linhas = conteudo.split('\n');
    
    let erros = 0;
    let sucessos = 0;
    let ultimaExecucao = null;

    linhas.forEach(linha => {
        if (linha.includes('ERROR') || linha.includes('Erro') || linha.includes('Failed')) {
            erros++;
        }
        if (linha.includes('SUCCESS') || linha.includes('Sucesso') || linha.includes('✅')) {
            sucessos++;
        }
        
        // Tentar extrair timestamp
        const matchData = linha.match(/\d{4}-\d{2}-\d{2}/);
        if (matchData && !ultimaExecucao) {
            ultimaExecucao = matchData[0];
        }
    });

    return {
        existe: true,
        linhas: linhas.length,
        erros,
        sucessos,
        ultimaExecucao,
        tamanho: fs.statSync(caminhoLog).size
    };
}

/**
 * Analisa arquivos de dados extraídos
 */
function analisarDadosExtraidos() {
    const arquivos = fs.existsSync(DADOS_DIR) 
        ? fs.readdirSync(DADOS_DIR).filter(f => f.endsWith('.json'))
        : [];
    
    const analise = arquivos.map(arquivo => {
        const caminho = path.join(DADOS_DIR, arquivo);
        const stats = fs.statSync(caminho);
        
        let conteudo = null;
        try {
            conteudo = JSON.parse(fs.readFileSync(caminho, 'utf-8'));
        } catch (e) {
            conteudo = { erro: 'Não foi possível parsear o JSON' };
        }

        return {
            arquivo,
            tamanho: stats.size,
            modificado: stats.mtime.toISOString(),
            conteudo: conteudo
        };
    });

    return analise;
}

/**
 * Gera relatório de status das automações
 */
function gerarRelatorioStatus() {
    const agora = new Date();
    const dataFormatada = agora.toISOString().split('T')[0];
    
    console.log('\n========================================');
    console.log('RELATÓRIO DE STATUS - AUTOMAÇÕES CALIMA');
    console.log(`Gerado em: ${agora.toLocaleString('pt-BR')}`);
    console.log('========================================\n');

    // Análise dos logs
    const logs = {
        provisoes: analisarLog(path.join(LOGS_DIR, 'provisoes.log')),
        processos: analisarLog(path.join(LOGS_DIR, 'processos.log')),
        notificacoes: analisarLog(path.join(LOGS_DIR, 'notificacoes.log')),
        backup: analisarLog(path.join(LOGS_DIR, 'backup.log'))
    };

    console.log('📊 STATUS DOS LOGS:\n');
    
    Object.entries(logs).forEach(([nome, info]) => {
        const status = info.existe ? '✅' : '❌';
        console.log(`${status} ${nome.toUpperCase()}`);
        if (info.existe) {
            console.log(`   Linhas: ${info.linhas}`);
            console.log(`   Sucessos: ${info.sucessos}`);
            console.log(`   Erros: ${info.erros}`);
            console.log(`   Última execução: ${info.ultimaExecucao || 'Desconhecida'}`);
            console.log(`   Tamanho: ${(info.tamanho / 1024).toFixed(2)} KB`);
        } else {
            console.log(`   Status: Nenhuma execução registrada`);
        }
        console.log('');
    });

    // Análise dos dados extraídos
    const dadosExtraidos = analisarDadosExtraidos();
    
    console.log('📁 DADOS EXTRAÍDOS:\n');
    
    if (dadosExtraidos.length === 0) {
        console.log('❌ Nenhum dado extraído encontrado\n');
    } else {
        dadosExtraidos.forEach(dado => {
            console.log(`✅ ${dado.arquivo}`);
            console.log(`   Tamanho: ${(dado.tamanho / 1024).toFixed(2)} KB`);
            console.log(`   Modificado: ${new Date(dado.modificado).toLocaleString('pt-BR')}`);
            console.log('');
        });
    }

    // Estatísticas gerais
    const totalErros = Object.values(logs).reduce((sum, log) => sum + log.erros, 0);
    const totalSucessos = Object.values(logs).reduce((sum, log) => sum + log.sucessos, 0);
    const logsAtivos = Object.values(logs).filter(log => log.existe).length;

    console.log('📈 ESTATÍSTICAS GERAIS:\n');
    console.log(`   Logs ativos: ${logsAtivos}/4`);
    console.log(`   Total de sucessos: ${totalSucessos}`);
    console.log(`   Total de erros: ${totalErros}`);
    console.log(`   Arquivos de dados: ${dadosExtraidos.length}`);
    console.log('');

    // Alertas
    console.log('⚠️  ALERTAS:\n');
    
    let temAlertas = false;
    
    Object.entries(logs).forEach(([nome, info]) => {
        if (info.existe && info.erros > 0) {
            console.log(`   ⚠️  ${nome}: ${info.erros} erro(s) detectado(s)`);
            temAlertas = true;
        }
    });

    // Verificar logs muito grandes (> 10MB)
    Object.entries(logs).forEach(([nome, info]) => {
        if (info.existe && info.tamanho > 10 * 1024 * 1024) {
            console.log(`   ⚠️  ${nome}: Log muito grande (${(info.tamanho / 1024 / 1024).toFixed(2)} MB)`);
            temAlertas = true;
        }
    });

    if (!temAlertas) {
        console.log('   ✅ Nenhum alerta detectado');
    }
    
    console.log('');
    console.log('========================================\n');

    // Salvar relatório em arquivo
    const relatorio = {
        dataGeracao: agora.toISOString(),
        logs,
        dadosExtraidos: dadosExtraidos.map(d => ({
            arquivo: d.arquivo,
            tamanho: d.tamanho,
            modificado: d.modificado
        })),
        estatisticas: {
            logsAtivos,
            totalSucessos,
            totalErros,
            arquivosDados: dadosExtraidos.length
        }
    };

    const caminhoRelatorio = path.join(RELATORIO_DIR, `status_${dataFormatada}.json`);
    fs.writeFileSync(caminhoRelatorio, JSON.stringify(relatorio, null, 2));
    
    console.log(`✅ Relatório salvo em: ${caminhoRelatorio}\n`);
}

/**
 * Exibe últimas linhas de um log (tail)
 */
function exibirUltimasLinhas(nomeLog, linhas = 20) {
    const caminhoLog = path.join(LOGS_DIR, `${nomeLog}.log`);
    
    if (!fs.existsSync(caminhoLog)) {
        console.log(`❌ Log ${nomeLog} não encontrado\n`);
        return;
    }

    const conteudo = fs.readFileSync(caminhoLog, 'utf-8');
    const todasLinhas = conteudo.split('\n');
    const ultimasLinhas = todasLinhas.slice(-linhas);

    console.log(`\n📄 Últimas ${linhas} linhas de ${nomeLog}.log:\n`);
    console.log('========================================');
    ultimasLinhas.forEach(linha => {
        if (linha.trim()) {
            console.log(linha);
        }
    });
    console.log('========================================\n');
}

/**
 * Limpa logs antigos
 */
function limparLogsAntigos(dias = 30) {
    console.log(`\n🧹 Limpando logs com mais de ${dias} dias...\n`);
    
    const agora = Date.now();
    const limiteMs = dias * 24 * 60 * 60 * 1000;
    
    let removidos = 0;
    
    if (fs.existsSync(LOGS_DIR)) {
        const arquivos = fs.readdirSync(LOGS_DIR);
        
        arquivos.forEach(arquivo => {
            const caminho = path.join(LOGS_DIR, arquivo);
            const stats = fs.statSync(caminho);
            const idade = agora - stats.mtime.getTime();
            
            if (idade > limiteMs) {
                fs.unlinkSync(caminho);
                console.log(`   ✅ Removido: ${arquivo}`);
                removidos++;
            }
        });
    }
    
    if (removidos === 0) {
        console.log('   ℹ️  Nenhum log antigo encontrado');
    } else {
        console.log(`\n✅ ${removidos} arquivo(s) removido(s)\n`);
    }
}

// Processar argumentos da linha de comando
const args = process.argv.slice(2);
const comando = args[0] || 'status';

switch (comando) {
    case 'status':
        gerarRelatorioStatus();
        break;
    
    case 'tail':
        const nomeLog = args[1] || 'provisoes';
        const numLinhas = parseInt(args[2]) || 20;
        exibirUltimasLinhas(nomeLog, numLinhas);
        break;
    
    case 'limpar':
        const dias = parseInt(args[1]) || 30;
        limparLogsAntigos(dias);
        break;
    
    case 'help':
    case '--help':
    case '-h':
        console.log(`
Sistema de Monitoramento de Logs - Calima-Manus

Uso:
  node monitor-logs.js [comando] [opções]

Comandos:
  status              Gera relatório completo de status (padrão)
  tail <log> [n]      Exibe últimas n linhas do log especificado
  limpar [dias]       Remove logs com mais de n dias (padrão: 30)
  help                Exibe esta ajuda

Exemplos:
  node monitor-logs.js status
  node monitor-logs.js tail provisoes 50
  node monitor-logs.js limpar 60

Logs disponíveis:
  - provisoes
  - processos
  - notificacoes
  - backup
        `);
        break;
    
    default:
        console.log(`❌ Comando desconhecido: ${comando}`);
        console.log('Use "node monitor-logs.js help" para ver os comandos disponíveis\n');
}
