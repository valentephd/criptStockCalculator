// Registro de ativos (chave "assets" do LocalStorage) e ativo atualmente ativo.
// Cada ativo: { id, type, marketId, symbol, name, quantityDecimals, isActive, createdAt }.

const ASSETS_KEY = 'assets';

// Valida que o dado é um array de ativos com o mínimo necessário.
function isValidAssets(data) {
    return Array.isArray(data) && data.every(a =>
        a && typeof a.id === 'number' &&
        typeof a.marketId === 'string' && a.marketId
    );
}

// Carrega a lista de ativos cadastrados (vazia se não houver/for inválida).
function loadAssets() {
    const raw = localStorage.getItem(ASSETS_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (isValidAssets(parsed)) return parsed;
        console.warn('Dados de ativos inválidos no LocalStorage; começando vazio.');
    } catch (e) {
        console.warn('Falha ao ler ativos do LocalStorage:', e);
    }
    return [];
}

// Salva a lista de ativos.
function saveAssets(assets) {
    localStorage.setItem(ASSETS_KEY, JSON.stringify(assets));
}

// Busca um ativo pelo id (número) no registro; null se não existir.
function getAssetById(id) {
    if (id === null || id === undefined || Number.isNaN(id)) return null;
    return loadAssets().find(a => a.id === id) || null;
}

// Calcula o próximo ID de ativo: considera tanto o maior ID existente quanto o
// tamanho do array, e soma 1 (evita colisões, igual às transações).
function computeNextAssetId(assets) {
    const maxId = assets.reduce((m, a) => (typeof a.id === 'number' && a.id > m ? a.id : m), 0);
    return Math.max(maxId, assets.length) + 1;
}
