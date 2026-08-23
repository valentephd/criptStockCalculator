// Configurações do sistema persistidas no LocalStorage (chave "systemConfigs").
// Guarda o estado do menu lateral e o contador de IDs das transações.

const CONFIG_KEY = 'systemConfigs';
const DEFAULT_CONFIG = {
    menuExpanded: false,
    nextTransactionId: 1,
    nextAssetId: 1,
    priceRefreshMinutes: 10
};

// Lê o objeto de configurações. Parte dos defaults e sobrepõe apenas as chaves
// CONHECIDAS que estiverem salvas — chaves obsoletas (ex.: um activeAssetId
// legado) são descartadas, mantendo o systemConfigs limpo.
function loadSystemConfigs() {
    let parsed = {};
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
        try {
            const p = JSON.parse(raw);
            if (p && typeof p === 'object') parsed = p;
        } catch (e) {
            console.warn('Falha ao ler systemConfigs do LocalStorage:', e);
        }
    }
    const cfg = { ...DEFAULT_CONFIG };
    Object.keys(DEFAULT_CONFIG).forEach(k => {
        if (k in parsed) cfg[k] = parsed[k];
    });
    return cfg;
}

// Salva o objeto de configurações no LocalStorage.
function saveSystemConfigs(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

// Lê uma configuração pontual, com valor padrão opcional.
function getConfig(key, def) {
    const cfg = loadSystemConfigs();
    return key in cfg ? cfg[key] : def;
}

// Atualiza uma configuração pontual e persiste.
function setConfig(key, value) {
    const cfg = loadSystemConfigs();
    cfg[key] = value;
    saveSystemConfigs(cfg);
}

// Retorna o próximo ID sequencial e incrementa o contador persistido.
function nextId() {
    const cfg = loadSystemConfigs();
    const id = cfg.nextTransactionId || 1;
    cfg.nextTransactionId = id + 1;
    saveSystemConfigs(cfg);
    return id;
}
