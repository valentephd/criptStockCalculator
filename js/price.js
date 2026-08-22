// Busca do preço atual do AAVE em BRL (CoinGecko) e persistência do último
// preço conhecido no LocalStorage, junto com a data/hora da atualização.

const PRICE_KEY = 'lastPrice';
const PRICE_REFRESH_MS = 10 * 60 * 1000; // 10 minutos
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=aave&vs_currencies=brl';

// Lê o último preço conhecido do LocalStorage: { price, updatedAt } ou null.
function loadLastPrice() {
    const raw = localStorage.getItem(PRICE_KEY);
    if (!raw) return null;
    try {
        const p = JSON.parse(raw);
        if (p && typeof p.price === 'number' && isFinite(p.price) && p.updatedAt) {
            return p;
        }
    } catch (e) {
        console.warn('Falha ao ler o último preço do LocalStorage:', e);
    }
    return null;
}

// Salva o preço com carimbo de data/hora atual e devolve o registro salvo.
function saveLastPrice(price) {
    const record = { price: price, updatedAt: new Date().toISOString() };
    localStorage.setItem(PRICE_KEY, JSON.stringify(record));
    return record;
}

// Consulta o preço atual do AAVE em BRL. Lança erro se a resposta for inesperada.
async function fetchAavePriceBRL() {
    const res = await fetch(COINGECKO_URL, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
        throw new Error('HTTP ' + res.status);
    }
    const data = await res.json();
    const price = data && data.aave && data.aave.brl;
    if (typeof price !== 'number' || !isFinite(price)) {
        throw new Error('Resposta inesperada da API');
    }
    return price;
}
