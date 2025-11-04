#!/bin/bash

# Script de Configuração de Agendamento Cron para Automações Calima
# Autor: Manus AI
# Data: 2025-11-04

echo "======================================"
echo "Configuração de Agendamento Cron"
echo "Automações Calima-Manus"
echo "======================================"
echo ""

# Diretório do projeto
PROJECT_DIR="/home/ubuntu/calima-manus-mcp"

# Verificar se o diretório existe
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Erro: Diretório $PROJECT_DIR não encontrado!"
    exit 1
fi

echo "✅ Diretório do projeto encontrado: $PROJECT_DIR"
echo ""

# Criar diretório para logs
LOGS_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOGS_DIR"
echo "✅ Diretório de logs criado: $LOGS_DIR"
echo ""

# Backup do crontab atual
echo "📦 Fazendo backup do crontab atual..."
crontab -l > "$PROJECT_DIR/crontab_backup_$(date +%Y%m%d_%H%M%S).txt" 2>/dev/null || echo "Nenhum crontab anterior encontrado"
echo ""

# Criar arquivo temporário com as novas entradas
TEMP_CRON=$(mktemp)

# Adicionar crontab existente (se houver)
crontab -l 2>/dev/null > "$TEMP_CRON" || true

# Adicionar comentário de identificação
echo "" >> "$TEMP_CRON"
echo "# ========================================" >> "$TEMP_CRON"
echo "# Automações Calima-Manus" >> "$TEMP_CRON"
echo "# Instalado em: $(date '+%Y-%m-%d %H:%M:%S')" >> "$TEMP_CRON"
echo "# ========================================" >> "$TEMP_CRON"

# 1. Extração Diária de Provisões (todos os dias às 2h da manhã)
echo "" >> "$TEMP_CRON"
echo "# Extração Diária de Provisões - 2h da manhã" >> "$TEMP_CRON"
echo "0 2 * * * cd $PROJECT_DIR && /usr/bin/node automacoes.js provisoes >> $LOGS_DIR/provisoes.log 2>&1" >> "$TEMP_CRON"

# 2. Relatório Semanal de Processos (toda segunda-feira às 4h da manhã)
echo "" >> "$TEMP_CRON"
echo "# Relatório Semanal de Processos - Segunda-feira 4h" >> "$TEMP_CRON"
echo "0 4 * * 1 cd $PROJECT_DIR && /usr/bin/node automacoes.js processos >> $LOGS_DIR/processos.log 2>&1" >> "$TEMP_CRON"

# 3. Monitoramento de Notificações (a cada hora)
echo "" >> "$TEMP_CRON"
echo "# Monitoramento de Notificações - A cada hora" >> "$TEMP_CRON"
echo "0 * * * * cd $PROJECT_DIR && /usr/bin/node automacoes.js notificacoes >> $LOGS_DIR/notificacoes.log 2>&1" >> "$TEMP_CRON"

# 4. Backup Completo de Dados (todo domingo às 5h da manhã)
echo "" >> "$TEMP_CRON"
echo "# Backup Completo de Dados - Domingo 5h" >> "$TEMP_CRON"
echo "0 5 * * 0 cd $PROJECT_DIR && /usr/bin/node automacoes.js backup >> $LOGS_DIR/backup.log 2>&1" >> "$TEMP_CRON"

# 5. Limpeza de Logs Antigos (primeiro dia do mês às 3h)
echo "" >> "$TEMP_CRON"
echo "# Limpeza de Logs Antigos - 1º dia do mês às 3h" >> "$TEMP_CRON"
echo "0 3 1 * * find $LOGS_DIR -name '*.log' -mtime +30 -delete" >> "$TEMP_CRON"

echo "======================================"
echo "Agendamentos configurados:"
echo "======================================"
echo ""
echo "✅ Extração de Provisões: Diariamente às 2h"
echo "✅ Relatório de Processos: Segundas-feiras às 4h"
echo "✅ Monitoramento de Notificações: A cada hora"
echo "✅ Backup Completo: Domingos às 5h"
echo "✅ Limpeza de Logs: 1º dia do mês às 3h"
echo ""

# Perguntar se deseja instalar
read -p "Deseja instalar esses agendamentos no crontab? (s/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[SsYy]$ ]]; then
    # Instalar o novo crontab
    crontab "$TEMP_CRON"
    echo ""
    echo "✅ Agendamentos instalados com sucesso!"
    echo ""
    echo "Para visualizar os agendamentos:"
    echo "  $ crontab -l"
    echo ""
    echo "Para editar os agendamentos:"
    echo "  $ crontab -e"
    echo ""
    echo "Para remover todos os agendamentos:"
    echo "  $ crontab -r"
    echo ""
    echo "Logs serão salvos em: $LOGS_DIR"
else
    echo ""
    echo "❌ Instalação cancelada."
    echo ""
    echo "Para instalar manualmente, execute:"
    echo "  $ crontab $TEMP_CRON"
fi

# Limpar arquivo temporário
rm -f "$TEMP_CRON"

echo ""
echo "======================================"
echo "Configuração concluída!"
echo "======================================"
