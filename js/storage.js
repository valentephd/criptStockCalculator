// Persistência das operações no LocalStorage, migração da estrutura (id/date),
// ordenação cronológica e backup/restore de TODO o LocalStorage (dump completo).

const STORAGE_KEY = 'transactions';

// Valida que o dado é um array de operações no formato novo
// { type, assetId, assetQuantity, brl }. id/dateTransaction são preenchidos
// pela normalização se faltarem.
function isValidTransactions(data) {
    return Array.isArray(data) && data.every(tx =>
        tx && (tx.type === 'buy' || tx.type === 'sell') &&
        typeof tx.assetId === 'number' &&
        typeof tx.assetQuantity === 'number' && isFinite(tx.assetQuantity) &&
        typeof tx.brl === 'number' && isFinite(tx.brl)
    );
}

// Ordena as transações por data ascendente (estável). Registros sem data
// (legados) são tratados como os mais antigos, mantendo a ordem original.
// IMPORTANTE: mantém o array em ordem cronológica para o motor de cálculo.
function sortTransactionsByDate(txs) {
    return txs
        .map((tx, i) => [tx, i])
        .sort((a, b) => {
            const ta = a[0].dateTransaction ? new Date(a[0].dateTransaction).getTime() : -Infinity;
            const tb = b[0].dateTransaction ? new Date(b[0].dateTransaction).getTime() : -Infinity;
            if (ta !== tb) return ta - tb;
            return a[1] - b[1]; // desempate estável pela posição original
        })
        .map(pair => pair[0]);
}

// Calcula qual deve ser o próximo ID: considera tanto o maior ID existente
// quanto o tamanho do array, e soma 1. Evita colisões após exclusões.
function computeNextTransactionId(txs) {
    const maxId = txs.reduce((m, t) => (typeof t.id === 'number' && t.id > m ? t.id : m), 0);
    return Math.max(maxId, txs.length) + 1;
}

// Recalcula e persiste o nextTransactionId a partir do estado atual do array.
// Deve ser chamado após adicionar ou remover uma transação.
function recalcNextTransactionId(txs) {
    const next = computeNextTransactionId(txs);
    setConfig('nextTransactionId', next);
    return next;
}

// Garante que toda transação tenha `id` e a propriedade `dateTransaction`,
// ajusta o contador de IDs e deixa o array ordenado por data.
function normalizeTransactions(txs) {
    let changed = false;

    // Ajusta o contador para acima do maior id já existente.
    const maxId = txs.reduce((m, tx) => (typeof tx.id === 'number' && tx.id > m ? tx.id : m), 0);
    const cfg = loadSystemConfigs();
    if ((cfg.nextTransactionId || 1) <= maxId) {
        cfg.nextTransactionId = maxId + 1;
        saveSystemConfigs(cfg);
    }

    txs.forEach(tx => {
        if (typeof tx.id !== 'number') {
            tx.id = nextId();
            changed = true;
        }
        if (!('dateTransaction' in tx)) {
            tx.dateTransaction = null;
            changed = true;
        }
    });

    const sorted = sortTransactionsByDate(txs);
    recalcNextTransactionId(sorted);
    if (changed) {
        saveTransactions(sorted);
    }
    return sorted;
}

// Carrega TODAS as operações do LocalStorage (de todos os ativos) e normaliza.
// Se não houver nada salvo (ou o conteúdo for inválido/formato antigo), começa
// em branco — o sistema aceita apenas o formato novo.
function loadTransactions() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (isValidTransactions(parsed)) {
            return normalizeTransactions(parsed);
        }
        console.warn('Dados de transações inválidos no LocalStorage; começando em branco.');
    } catch (e) {
        console.warn('Falha ao ler transações do LocalStorage:', e);
    }
    return [];
}

// Salva as operações no LocalStorage.
function saveTransactions(txs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
}

// Nome do arquivo de backup: backup_criptstock_AAMMDD_HHmm.json (hora local).
function backupFileName() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const yy = pad(d.getFullYear() % 100);
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `backup_criptstock_${yy}${mm}${dd}_${hh}${mi}.json`;
}

// Monta o objeto de backup: TODAS as chaves do LocalStorage, com cada valor
// como JSON real (objeto/array), sem virar string escapada.
function buildBackupObject() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const raw = localStorage.getItem(key);
        try {
            data[key] = JSON.parse(raw); // objeto/array real
        } catch (e) {
            data[key] = raw; // valor não-JSON: mantém a string
        }
    }
    return data;
}

// Texto JSON (identado) do backup — usado na página de Backup e no download.
function backupToText() {
    return JSON.stringify(buildBackupObject(), null, 2);
}

// Baixa um arquivo com o backup atual.
function exportBackup() {
    const blob = new Blob([backupToText()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Grava um mapa { chave: valor } no LocalStorage (valor objeto -> JSON string).
function restoreDataMap(map) {
    Object.keys(map).forEach(key => {
        const value = map[key];
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
}

// Restaura a partir de um objeto já parseado (mapa { chave: conteúdo }).
// Retorna true se restaurou; false se o formato for inválido.
function restoreBackupObject(parsed) {
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        restoreDataMap(parsed);
        return true;
    }
    return false;
}

// Importa um arquivo de backup (formato novo: objeto { chave: conteúdo }) e
// restaura o LocalStorage. Em erro, mantém os dados atuais e avisa.
// onDone() é chamado após restaurar com sucesso.
function importBackup(file, onDone) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);
            if (restoreBackupObject(parsed)) {
                if (typeof onDone === 'function') onDone();
                alert('Backup restaurado com sucesso.');
                return;
            }
            alert('Arquivo de backup inválido.');
        } catch (e) {
            alert('Não foi possível ler o arquivo de backup: ' + e.message);
        }
    };
    reader.onerror = () => {
        alert('Erro ao abrir o arquivo de backup.');
    };
    reader.readAsText(file);
}

// Apaga TODOS os dados do sistema no LocalStorage (reset).
function clearAllData() {
    localStorage.clear();
}
