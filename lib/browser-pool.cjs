/**
 * Browser Pool - Pool de Navegadores Reutilizáveis
 * 
 * Gerencia um pool de navegadores Playwright para reutilização,
 * reduzindo o overhead de inicialização de 15s para ~1s.
 */

const { chromium } = require('playwright');

class BrowserPool {
    constructor(options = {}) {
        this.maxBrowsers = options.maxBrowsers || 3;
        this.idleTimeout = options.idleTimeout || 300000; // 5 minutos
        this.browsers = [];
        this.activeSessions = new Map();
        this.sessionCounter = 0;
    }

    /**
     * Obtém um navegador do pool ou cria um novo
     */
    async acquire() {
        // Procurar navegador disponível
        for (let i = 0; i < this.browsers.length; i++) {
            const browser = this.browsers[i];
            if (!browser.inUse && browser.instance.isConnected()) {
                browser.inUse = true;
                browser.lastUsed = Date.now();
                clearTimeout(browser.timeoutId);
                
                const sessionId = ++this.sessionCounter;
                this.activeSessions.set(sessionId, browser);
                
                console.log(`[BrowserPool] Reutilizando navegador #${i + 1} (sessão ${sessionId})`);
                return { browser: browser.instance, sessionId };
            }
        }

        // Se não há navegadores disponíveis e atingiu o limite, aguardar
        if (this.browsers.length >= this.maxBrowsers) {
            console.log('[BrowserPool] Pool cheio, aguardando navegador disponível...');
            return await this.waitForAvailable();
        }

        // Criar novo navegador
        console.log('[BrowserPool] Criando novo navegador...');
        const instance = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const browser = {
            instance,
            inUse: true,
            lastUsed: Date.now(),
            timeoutId: null
        };

        this.browsers.push(browser);
        
        const sessionId = ++this.sessionCounter;
        this.activeSessions.set(sessionId, browser);
        
        console.log(`[BrowserPool] Navegador #${this.browsers.length} criado (sessão ${sessionId})`);
        return { browser: instance, sessionId };
    }

    /**
     * Libera um navegador de volta ao pool
     */
    async release(sessionId) {
        const browser = this.activeSessions.get(sessionId);
        if (!browser) {
            console.warn(`[BrowserPool] Sessão ${sessionId} não encontrada`);
            return;
        }

        browser.inUse = false;
        browser.lastUsed = Date.now();
        this.activeSessions.delete(sessionId);

        // Configurar timeout para fechar navegador ocioso
        browser.timeoutId = setTimeout(async () => {
            if (!browser.inUse) {
                console.log(`[BrowserPool] Fechando navegador ocioso após ${this.idleTimeout}ms`);
                await this.closeBrowser(browser);
            }
        }, this.idleTimeout);

        console.log(`[BrowserPool] Navegador liberado (sessão ${sessionId})`);
    }

    /**
     * Aguarda um navegador ficar disponível
     */
    async waitForAvailable() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(async () => {
                for (let i = 0; i < this.browsers.length; i++) {
                    const browser = this.browsers[i];
                    if (!browser.inUse && browser.instance.isConnected()) {
                        clearInterval(checkInterval);
                        browser.inUse = true;
                        browser.lastUsed = Date.now();
                        clearTimeout(browser.timeoutId);
                        
                        const sessionId = ++this.sessionCounter;
                        this.activeSessions.set(sessionId, browser);
                        
                        console.log(`[BrowserPool] Navegador #${i + 1} disponível (sessão ${sessionId})`);
                        resolve({ browser: browser.instance, sessionId });
                        return;
                    }
                }
            }, 500);
        });
    }

    /**
     * Fecha um navegador específico
     */
    async closeBrowser(browser) {
        try {
            if (browser.instance.isConnected()) {
                await browser.instance.close();
            }
            const index = this.browsers.indexOf(browser);
            if (index > -1) {
                this.browsers.splice(index, 1);
            }
        } catch (error) {
            console.error('[BrowserPool] Erro ao fechar navegador:', error.message);
        }
    }

    /**
     * Fecha todos os navegadores do pool
     */
    async closeAll() {
        console.log('[BrowserPool] Fechando todos os navegadores...');
        const closePromises = this.browsers.map(browser => this.closeBrowser(browser));
        await Promise.all(closePromises);
        this.browsers = [];
        this.activeSessions.clear();
        console.log('[BrowserPool] Todos os navegadores fechados');
    }

    /**
     * Retorna estatísticas do pool
     */
    getStats() {
        return {
            total: this.browsers.length,
            inUse: this.browsers.filter(b => b.inUse).length,
            available: this.browsers.filter(b => !b.inUse).length,
            maxBrowsers: this.maxBrowsers,
            activeSessions: this.activeSessions.size
        };
    }
}

// Singleton global
let globalPool = null;

/**
 * Obtém a instância global do pool
 */
function getPool(options) {
    if (!globalPool) {
        globalPool = new BrowserPool(options);
    }
    return globalPool;
}

/**
 * Fecha o pool global
 */
async function closeGlobalPool() {
    if (globalPool) {
        await globalPool.closeAll();
        globalPool = null;
    }
}

module.exports = {
    BrowserPool,
    getPool,
    closeGlobalPool
};
