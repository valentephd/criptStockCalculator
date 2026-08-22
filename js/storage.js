// Persistência das operações no LocalStorage, migração da estrutura (id/date),
// ordenação cronológica e backup/restore de TODO o LocalStorage (dump completo).

const STORAGE_KEY = 'transactions';

// Valida que o dado é um array de operações no formato { type, aave, brl }.
// Os campos id/date são opcionais (registros legados podem não tê-los).
function isValidTransactions(data) {
    return Array.isArray(data) && data.every(tx =>
        tx && (tx.type === 'buy' || tx.type === 'sell') &&
        typeof tx.aave === 'number' && isFinite(tx.aave) &&
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

// Garante que toda transação tenha `id` (sequencial) e a propriedade
// `dateTransaction` (legado -> null). Ajusta o contador de IDs e deixa o
// array ordenado por data.
function migrateTransactions(txs) {
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
        // Compatibilidade: renomeia um eventual campo antigo `date`.
        if (!('dateTransaction' in tx)) {
            tx.dateTransaction = ('date' in tx) ? tx.date : null;
            changed = true;
        }
        if ('date' in tx) {
            delete tx.date;
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

// Carrega as operações do LocalStorage e aplica a migração. Se não houver nada
// salvo (ou o conteúdo for inválido), começa em branco — sem valores iniciais.
function loadTransactions() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (isValidTransactions(parsed)) {
            return migrateTransactions(parsed);
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

// Exporta TODO o conteúdo do LocalStorage (transactions, lastPrice,
// systemConfigs e quaisquer outras chaves). Cada valor é gravado como JSON
// real (objeto/array), sem virar string escapada.
function exportBackup() {
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
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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

// Importa um arquivo de backup e restaura o LocalStorage. Aceita:
//  - o formato novo (objeto { chave: conteúdo });
//  - o envelope antigo ({ app, version, data: {...} });
//  - o formato bem antigo (array puro de transações).
// Em erro, mantém os dados atuais e avisa. onDone() recarrega a UI.
function importBackup(file, onDone) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);

            // Formato bem antigo: array puro de transações.
            if (isValidTransactions(parsed)) {
                saveTransactions(parsed);
                if (typeof onDone === 'function') onDone();
                alert('Backup (formato antigo) restaurado: ' + parsed.length + ' operações.');
                return;
            }

            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                // Envelope antigo tem { data: {...} } + app/version; caso contrário,
                // o próprio objeto já é o mapa de dados (formato novo).
                const isEnvelope = parsed.data && typeof parsed.data === 'object'
                    && (parsed.app || parsed.version || parsed.exportedAt);
                restoreDataMap(isEnvelope ? parsed.data : parsed);
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
