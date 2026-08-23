// Busca do preço atual de um ativo em BRL (CoinGecko) e persistência do último
// preço conhecido por ativo (chave "lastPrice", uma lista por assetId).

const PRICE_KEY = 'lastPrice';

// Monta a URL da CoinGecko para um identificador de mercado (marketId).
function coingeckoUrl(marketId) {
    return 'https://api.coingecko.com/api/v3/simple/price?ids=' +
        encodeURIComponent(marketId) + '&vs_currencies=brl';
}

// Lê a lista de últimos preços (por ativo). Vazia se ausente/ inválida.
function loadLastPriceList() {
    const raw = localStorage.getItem(PRICE_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
    } catch (e) {
        console.warn('Falha ao ler lastPrice do LocalStorage:', e);
    }
    return [];
}

// Último preço conhecido de um ativo: { assetId, price, updatedAt } ou null.
function loadLastPrice(assetId) {
    const rec = loadLastPriceList().find(p =>
        p && p.assetId === assetId &&
        typeof p.price === 'number' && isFinite(p.price) && p.updatedAt
    );
    return rec || null;
}

// Salva/atualiza (upsert) o preço de um ativo e devolve o registro salvo.
function saveLastPrice(assetId, price) {
    const list = loadLastPriceList();
    const record = { assetId: assetId, price: price, updatedAt: new Date().toISOString() };
    const i = list.findIndex(p => p && p.assetId === assetId);
    if (i >= 0) list[i] = record; else list.push(record);
    localStorage.setItem(PRICE_KEY, JSON.stringify(list));
    return record;
}

// Consulta o preço atual (BRL) de um ativo pelo seu marketId.
async function fetchAssetPriceBRL(marketId) {
    const res = await fetch(coingeckoUrl(marketId), { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
        throw new Error('HTTP ' + res.status);
    }
    const data = await res.json();
    const entry = data && data[marketId];
    const price = entry && entry.brl;
    if (typeof price !== 'number' || !isFinite(price)) {
        throw new Error('Resposta inesperada da API');
    }
    return price;
}
