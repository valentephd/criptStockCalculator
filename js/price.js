// Busca do preço atual de um ativo em BRL (CoinGecko) e persistência do último
// preço conhecido por ativo (chave "lastPrice", uma lista por assetId).

const PRICE_KEY = 'lastPrice';

// Proxy CORS público usado apenas para os FIIs (o Yahoo não envia header CORS).
// Isolado numa constante para troca fácil caso o proxy fique indisponível.
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// Monta a URL da CoinGecko para um identificador de mercado (marketId).
function coingeckoUrl(marketId) {
    return 'https://api.coingecko.com/api/v3/simple/price?ids=' +
        encodeURIComponent(marketId) + '&vs_currencies=brl';
}

// Ticker do FII para o Yahoo: usa marketId (ou symbol) em maiúsculas e garante
// o sufixo ".SA" da B3. Ex.: "gare11" -> "GARE11.SA".
function fiiTicker(asset) {
    let t = String((asset && (asset.marketId || asset.symbol)) || '').trim().toUpperCase();
    if (t && !t.endsWith('.SA')) t += '.SA';
    return t;
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
// `manual` = true quando o valor foi digitado pelo usuário (cotação não obtida
// pela API); registra também a data/hora (updatedAt).
function saveLastPrice(assetId, price, manual) {
    const list = loadLastPriceList();
    const record = {
        assetId: assetId,
        price: price,
        updatedAt: new Date().toISOString(),
        manual: !!manual
    };
    const i = list.findIndex(p => p && p.assetId === assetId);
    if (i >= 0) list[i] = record; else list.push(record);
    localStorage.setItem(PRICE_KEY, JSON.stringify(list));
    return record;
}

// Consulta o preço atual (BRL) via CoinGecko pelo marketId (usado por crypto).
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

// Consulta o preço atual (BRL) de um FII via Yahoo Finance, através do proxy
// CORS. Lê chart.result[0].meta.regularMarketPrice.
async function fetchFiiPriceBRL(ticker) {
    const yahoo = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker);
    const res = await fetch(CORS_PROXY + encodeURIComponent(yahoo), { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
        throw new Error('HTTP ' + res.status);
    }
    const data = await res.json();
    const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
    const price = meta && meta.regularMarketPrice;
    if (typeof price !== 'number' || !isFinite(price)) {
        throw new Error('Resposta inesperada da API (Yahoo)');
    }
    return price;
}

// Dispatcher por tipo de ativo: FII -> Yahoo (proxy); demais -> CoinGecko.
async function fetchAssetPrice(asset) {
    if (asset && asset.type === 'FII') {
        return fetchFiiPriceBRL(fiiTicker(asset));
    }
    return fetchAssetPriceBRL(asset.marketId);
}
