// Persistência das operações no LocalStorage, além de backup (exportar) e
// restauração (importar) de um arquivo backup_transactions.json.

const STORAGE_KEY = 'transactions';

// Valida que o dado é um array de operações no formato { type, aave, brl }.
function isValidTransactions(data) {
    return Array.isArray(data) && data.every(tx =>
        tx && (tx.type === 'buy' || tx.type === 'sell') &&
        typeof tx.aave === 'number' && isFinite(tx.aave) &&
        typeof tx.brl === 'number' && isFinite(tx.brl)
    );
}

// Carrega as operações do LocalStorage. Se não houver nada salvo (ou o
// conteúdo for inválido), começa em branco — sem forçar valores iniciais.
function loadTransactions() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (isValidTransactions(parsed)) {
            return parsed;
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

// Exporta o conteúdo atual do LocalStorage para backup_transactions.json.
function exportBackup(txs) {
    const blob = new Blob([JSON.stringify(txs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup_transactions.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Importa um arquivo de backup. Valida o conteúdo antes de sobrescrever;
// em caso de erro, avisa o usuário e mantém os dados atuais intactos.
// onDone(novasTransacoes) é chamado após salvar com sucesso.
function importBackup(file, onDone) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);
            if (!isValidTransactions(parsed)) {
                alert('Arquivo de backup inválido: esperado uma lista de operações { type, aave, brl }.');
                return;
            }
            saveTransactions(parsed);
            if (typeof onDone === 'function') {
                onDone(parsed);
            }
            alert('Backup restaurado com sucesso: ' + parsed.length + ' operações.');
        } catch (e) {
            alert('Não foi possível ler o arquivo de backup: ' + e.message);
        }
    };
    reader.onerror = () => {
        alert('Erro ao abrir o arquivo de backup.');
    };
    reader.readAsText(file);
}
