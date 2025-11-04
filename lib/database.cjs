/**
 * Database Module - Banco de Dados Histórico com SQLite
 * 
 * Armazena histórico completo de todas as extrações do Calima,
 * permitindo análises temporais e comparativos.
 */

const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class CalimaDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(__dirname, '..', 'data', 'calima.db');
        this.db = null;
        this.ensureDirectoryExists();
    }

    /**
     * Garante que o diretório do banco existe
     */
    ensureDirectoryExists() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Conecta ao banco de dados
     */
    connect() {
        if (this.db) {
            return this.db;
        }

        this.db = new sqlite3(this.dbPath);
        this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging para melhor performance
        
        console.log(`[Database] ✅ Conectado a: ${this.dbPath}`);
        return this.db;
    }

    /**
     * Inicializa o schema do banco
     */
    initialize() {
        const db = this.connect();

        // Tabela de empresas
        db.exec(`
            CREATE TABLE IF NOT EXISTS empresas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT NOT NULL,
                razao_social TEXT NOT NULL,
                cnpj TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(codigo)
            )
        `);

        // Tabela de provisões
        db.exec(`
            CREATE TABLE IF NOT EXISTS provisoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresa_id INTEGER NOT NULL,
                referencia TEXT NOT NULL,
                tipo TEXT NOT NULL,
                valor REAL NOT NULL,
                data_extracao DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id),
                UNIQUE(empresa_id, referencia, tipo)
            )
        `);

        // Tabela de processos
        db.exec(`
            CREATE TABLE IF NOT EXISTS processos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresa_id INTEGER NOT NULL,
                nome TEXT NOT NULL,
                tipo TEXT,
                status TEXT,
                data_processo DATETIME,
                data_extracao DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id)
            )
        `);

        // Tabela de notificações
        db.exec(`
            CREATE TABLE IF NOT EXISTS notificacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresa_id INTEGER NOT NULL,
                tipo TEXT NOT NULL,
                mensagem TEXT NOT NULL,
                lida BOOLEAN DEFAULT 0,
                data_notificacao DATETIME,
                data_extracao DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id)
            )
        `);

        // Tabela de backups
        db.exec(`
            CREATE TABLE IF NOT EXISTS backups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                empresa_id INTEGER NOT NULL,
                tipo TEXT NOT NULL,
                dados TEXT NOT NULL,
                tamanho INTEGER,
                hash TEXT,
                data_backup DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES empresas(id)
            )
        `);

        // Tabela de execuções (log de automações)
        db.exec(`
            CREATE TABLE IF NOT EXISTS execucoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT NOT NULL,
                status TEXT NOT NULL,
                duracao INTEGER,
                erro TEXT,
                data_execucao DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Índices para performance
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_provisoes_empresa ON provisoes(empresa_id);
            CREATE INDEX IF NOT EXISTS idx_provisoes_referencia ON provisoes(referencia);
            CREATE INDEX IF NOT EXISTS idx_processos_empresa ON processos(empresa_id);
            CREATE INDEX IF NOT EXISTS idx_notificacoes_empresa ON notificacoes(empresa_id);
            CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);
            CREATE INDEX IF NOT EXISTS idx_execucoes_tipo ON execucoes(tipo);
            CREATE INDEX IF NOT EXISTS idx_execucoes_data ON execucoes(data_execucao);
        `);

        console.log('[Database] ✅ Schema inicializado');
    }

    /**
     * Insere ou atualiza uma empresa
     */
    upsertEmpresa(empresa) {
        const db = this.connect();
        const stmt = db.prepare(`
            INSERT INTO empresas (codigo, razao_social, cnpj)
            VALUES (?, ?, ?)
            ON CONFLICT(codigo) DO UPDATE SET
                razao_social = excluded.razao_social,
                cnpj = excluded.cnpj
        `);

        const result = stmt.run(empresa.codigo, empresa.razaoSocial, empresa.cnpj);
        
        // Retornar ID da empresa
        const selectStmt = db.prepare('SELECT id FROM empresas WHERE codigo = ?');
        return selectStmt.get(empresa.codigo).id;
    }

    /**
     * Insere provisões
     */
    insertProvisoes(empresaId, referencia, provisoes) {
        const db = this.connect();
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO provisoes (empresa_id, referencia, tipo, valor)
            VALUES (?, ?, ?, ?)
        `);

        const insertMany = db.transaction((provisoes) => {
            for (const provisao of provisoes) {
                stmt.run(empresaId, referencia, provisao.tipo, provisao.valor);
            }
        });

        insertMany(provisoes);
        console.log(`[Database] ✅ ${provisoes.length} provisões inseridas`);
    }

    /**
     * Consulta provisões por período
     */
    getProvisoes(empresaId, referencia = null) {
        const db = this.connect();
        
        let query = 'SELECT * FROM provisoes WHERE empresa_id = ?';
        const params = [empresaId];

        if (referencia) {
            query += ' AND referencia = ?';
            params.push(referencia);
        }

        query += ' ORDER BY data_extracao DESC';

        const stmt = db.prepare(query);
        return stmt.all(...params);
    }

    /**
     * Compara provisões entre dois períodos
     */
    compareProvisoes(empresaId, referencia1, referencia2) {
        const db = this.connect();
        
        const query = `
            SELECT 
                p1.tipo,
                p1.valor as valor_periodo1,
                p2.valor as valor_periodo2,
                (p2.valor - p1.valor) as diferenca,
                ROUND(((p2.valor - p1.valor) / NULLIF(p1.valor, 0)) * 100, 2) as percentual
            FROM provisoes p1
            LEFT JOIN provisoes p2 ON p1.empresa_id = p2.empresa_id AND p1.tipo = p2.tipo
            WHERE p1.empresa_id = ? 
                AND p1.referencia = ?
                AND p2.referencia = ?
            ORDER BY p1.tipo
        `;

        const stmt = db.prepare(query);
        return stmt.all(empresaId, referencia1, referencia2);
    }

    /**
     * Insere processo
     */
    insertProcesso(empresaId, processo) {
        const db = this.connect();
        const stmt = db.prepare(`
            INSERT INTO processos (empresa_id, nome, tipo, status, data_processo)
            VALUES (?, ?, ?, ?, ?)
        `);

        return stmt.run(
            empresaId,
            processo.nome,
            processo.tipo,
            processo.status,
            processo.dataProcesso
        );
    }

    /**
     * Consulta processos
     */
    getProcessos(empresaId, limit = 100) {
        const db = this.connect();
        const stmt = db.prepare(`
            SELECT * FROM processos 
            WHERE empresa_id = ?
            ORDER BY data_processo DESC
            LIMIT ?
        `);

        return stmt.all(empresaId, limit);
    }

    /**
     * Insere notificação
     */
    insertNotificacao(empresaId, notificacao) {
        const db = this.connect();
        const stmt = db.prepare(`
            INSERT INTO notificacoes (empresa_id, tipo, mensagem, data_notificacao)
            VALUES (?, ?, ?, ?)
        `);

        return stmt.run(
            empresaId,
            notificacao.tipo,
            notificacao.mensagem,
            notificacao.data
        );
    }

    /**
     * Consulta notificações não lidas
     */
    getNotificacoesNaoLidas(empresaId) {
        const db = this.connect();
        const stmt = db.prepare(`
            SELECT * FROM notificacoes 
            WHERE empresa_id = ? AND lida = 0
            ORDER BY data_notificacao DESC
        `);

        return stmt.all(empresaId);
    }

    /**
     * Marca notificação como lida
     */
    marcarNotificacaoLida(notificacaoId) {
        const db = this.connect();
        const stmt = db.prepare('UPDATE notificacoes SET lida = 1 WHERE id = ?');
        return stmt.run(notificacaoId);
    }

    /**
     * Registra execução de automação
     */
    logExecucao(tipo, status, duracao, erro = null) {
        const db = this.connect();
        const stmt = db.prepare(`
            INSERT INTO execucoes (tipo, status, duracao, erro)
            VALUES (?, ?, ?, ?)
        `);

        return stmt.run(tipo, status, duracao, erro);
    }

    /**
     * Estatísticas de execuções
     */
    getEstatisticasExecucoes(tipo = null, dias = 30) {
        const db = this.connect();
        
        let query = `
            SELECT 
                tipo,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'sucesso' THEN 1 ELSE 0 END) as sucessos,
                SUM(CASE WHEN status = 'erro' THEN 1 ELSE 0 END) as erros,
                AVG(duracao) as duracao_media,
                MIN(duracao) as duracao_minima,
                MAX(duracao) as duracao_maxima
            FROM execucoes
            WHERE data_execucao >= datetime('now', '-' || ? || ' days')
        `;

        const params = [dias];

        if (tipo) {
            query += ' AND tipo = ?';
            params.push(tipo);
        }

        query += ' GROUP BY tipo';

        const stmt = db.prepare(query);
        return stmt.all(...params);
    }

    /**
     * Exporta dados para JSON
     */
    exportToJSON(empresaId, outputPath) {
        const db = this.connect();

        const data = {
            empresa: db.prepare('SELECT * FROM empresas WHERE id = ?').get(empresaId),
            provisoes: db.prepare('SELECT * FROM provisoes WHERE empresa_id = ?').all(empresaId),
            processos: db.prepare('SELECT * FROM processos WHERE empresa_id = ?').all(empresaId),
            notificacoes: db.prepare('SELECT * FROM notificacoes WHERE empresa_id = ?').all(empresaId)
        };

        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`[Database] ✅ Dados exportados para: ${outputPath}`);
    }

    /**
     * Fecha a conexão
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('[Database] ✅ Conexão fechada');
        }
    }

    /**
     * Executa query SQL customizada
     */
    query(sql, params = []) {
        const db = this.connect();
        const stmt = db.prepare(sql);
        return stmt.all(...params);
    }
}

module.exports = {
    CalimaDatabase
};
