// Configurações do sistema persistidas no LocalStorage (chave "systemConfigs").
// Guarda o estado do menu lateral e o contador de IDs das transações.

const CONFIG_KEY = 'systemConfigs';
const DEFAULT_CONFIG = {
    menuExpanded: false,
    nextTransactionId: 1,
    nextAssetId: 1,
    activeAssetId: null,
    priceRefreshMinutes: 10
};

// Lê o objeto de configurações, mesclando com os defaults.
function loadSystemConfigs() {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) {
        return { ...DEFAULT_CONFIG };
    }
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return { ...DEFAULT_CONFIG, ...parsed };
        }
    } catch (e) {
        console.warn('Falha ao ler systemConfigs do LocalStorage:', e);
    }
    return { ...DEFAULT_CONFIG };
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
