/**
 * Crypto Module - Criptografia de Credenciais
 * 
 * Implementa criptografia AES-256-GCM para proteger credenciais sensíveis,
 * substituindo armazenamento em texto plano.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const ITERATIONS = 100000;

class CryptoManager {
    constructor(options = {}) {
        this.keyFile = options.keyFile || path.join(__dirname, '..', '.key');
        this.masterKey = null;
    }

    /**
     * Deriva uma chave a partir de uma senha usando PBKDF2
     */
    deriveKey(password, salt) {
        return crypto.pbkdf2Sync(
            password,
            salt,
            ITERATIONS,
            KEY_LENGTH,
            'sha512'
        );
    }

    /**
     * Gera um salt aleatório
     */
    generateSalt() {
        return crypto.randomBytes(SALT_LENGTH);
    }

    /**
     * Gera um IV aleatório
     */
    generateIV() {
        return crypto.randomBytes(IV_LENGTH);
    }

    /**
     * Inicializa o gerenciador com uma senha mestra
     */
    async initialize(masterPassword) {
        let salt;

        // Verificar se já existe um arquivo de chave
        if (fs.existsSync(this.keyFile)) {
            const keyData = JSON.parse(fs.readFileSync(this.keyFile, 'utf-8'));
            salt = Buffer.from(keyData.salt, 'hex');
        } else {
            // Criar novo salt
            salt = this.generateSalt();
            fs.writeFileSync(this.keyFile, JSON.stringify({
                salt: salt.toString('hex'),
                created: new Date().toISOString()
            }), { mode: 0o600 }); // Permissões restritas
        }

        this.masterKey = this.deriveKey(masterPassword, salt);
        console.log('[Crypto] ✅ Gerenciador inicializado');
    }

    /**
     * Criptografa um texto
     */
    encrypt(plaintext) {
        if (!this.masterKey) {
            throw new Error('CryptoManager não inicializado. Chame initialize() primeiro.');
        }

        const iv = this.generateIV();
        const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const tag = cipher.getAuthTag();

        // Retornar IV + Tag + Ciphertext
        return {
            iv: iv.toString('hex'),
            tag: tag.toString('hex'),
            encrypted: encrypted
        };
    }

    /**
     * Descriptografa um texto
     */
    decrypt(encryptedData) {
        if (!this.masterKey) {
            throw new Error('CryptoManager não inicializado. Chame initialize() primeiro.');
        }

        const iv = Buffer.from(encryptedData.iv, 'hex');
        const tag = Buffer.from(encryptedData.tag, 'hex');
        const encrypted = encryptedData.encrypted;

        const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    /**
     * Criptografa um objeto (converte para JSON primeiro)
     */
    encryptObject(obj) {
        const json = JSON.stringify(obj);
        return this.encrypt(json);
    }

    /**
     * Descriptografa um objeto
     */
    decryptObject(encryptedData) {
        const json = this.decrypt(encryptedData);
        return JSON.parse(json);
    }

    /**
     * Salva credenciais criptografadas em arquivo
     */
    saveCredentials(credentials, filePath) {
        const encrypted = this.encryptObject(credentials);
        fs.writeFileSync(filePath, JSON.stringify(encrypted, null, 2), { mode: 0o600 });
        console.log(`[Crypto] ✅ Credenciais salvas em: ${filePath}`);
    }

    /**
     * Carrega credenciais criptografadas de arquivo
     */
    loadCredentials(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Arquivo de credenciais não encontrado: ${filePath}`);
        }

        const encrypted = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const credentials = this.decryptObject(encrypted);
        console.log(`[Crypto] ✅ Credenciais carregadas de: ${filePath}`);
        return credentials;
    }

    /**
     * Gera um hash SHA-256 de um texto
     */
    hash(text) {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    /**
     * Verifica se um hash corresponde a um texto
     */
    verifyHash(text, hash) {
        return this.hash(text) === hash;
    }

    /**
     * Gera um token aleatório
     */
    generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
}

/**
 * Migra credenciais do .env para formato criptografado
 */
async function migrateFromEnv(envPath, outputPath, masterPassword) {
    console.log('[Crypto] 🔄 Migrando credenciais do .env...');

    // Ler .env
    if (!fs.existsSync(envPath)) {
        throw new Error(`.env não encontrado em: ${envPath}`);
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const credentials = {};

    // Parsear .env
    envContent.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('=').trim();
            if (key && value) {
                credentials[key.trim()] = value;
            }
        }
    });

    // Criptografar e salvar
    const crypto = new CryptoManager();
    await crypto.initialize(masterPassword);
    crypto.saveCredentials(credentials, outputPath);

    console.log('[Crypto] ✅ Migração concluída!');
    console.log(`[Crypto] ⚠️  IMPORTANTE: Faça backup do .env e depois delete-o`);
    
    return credentials;
}

/**
 * Utilitário para testar criptografia
 */
async function testCrypto() {
    console.log('\n=== Teste de Criptografia ===\n');

    const crypto = new CryptoManager();
    await crypto.initialize('senha-teste-123');

    // Teste 1: Texto simples
    const plaintext = 'Dados sensíveis do usuário';
    console.log('Original:', plaintext);
    
    const encrypted = crypto.encrypt(plaintext);
    console.log('Criptografado:', JSON.stringify(encrypted));
    
    const decrypted = crypto.decrypt(encrypted);
    console.log('Descriptografado:', decrypted);
    console.log('✅ Teste 1 passou:', plaintext === decrypted);

    // Teste 2: Objeto
    const obj = { username: 'usuario', password: 'senha123' };
    console.log('\nOriginal:', obj);
    
    const encryptedObj = crypto.encryptObject(obj);
    console.log('Criptografado:', JSON.stringify(encryptedObj));
    
    const decryptedObj = crypto.decryptObject(encryptedObj);
    console.log('Descriptografado:', decryptedObj);
    console.log('✅ Teste 2 passou:', JSON.stringify(obj) === JSON.stringify(decryptedObj));

    // Teste 3: Hash
    const text = 'texto para hash';
    const hash1 = crypto.hash(text);
    const hash2 = crypto.hash(text);
    console.log('\nHash 1:', hash1);
    console.log('Hash 2:', hash2);
    console.log('✅ Teste 3 passou:', hash1 === hash2);

    console.log('\n=== Todos os testes passaram! ===\n');
}

module.exports = {
    CryptoManager,
    migrateFromEnv,
    testCrypto
};
