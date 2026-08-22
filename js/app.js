// Camada de UI: dashboard, modal de nova operação, menu lateral, preço e
// backup/restore. O motor de cálculo (portfolio.js) permanece intocado.

let transactions = loadTransactions();

// Formata a data/hora de uma string ISO no padrão pt-BR.
function formatDateTime(iso) {
    return new Date(iso).toLocaleString('pt-BR');
}

// Valor "YYYY-MM-DDTHH:mm" (fuso local) para inputs datetime-local.
function toLocalDatetimeValue(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function updateDashboard() {
    const data = processPortfolio();

    // Update Summary Cards
    document.getElementById('valTotalInvested').innerText = formatCurrency(data.totalInvested);
    document.getElementById('valTotalCoins').innerText = formatCrypto(data.totalCoins) + ' AAVE';
    document.getElementById('valAvgPrice').innerText = formatCurrency(data.avgPrice);
    document.getElementById('valMarketValue').innerText = formatCurrency(data.marketValue);

    const elProfit = document.getElementById('valRealizedProfit');
    elProfit.innerText = formatCurrency(data.totalRealizedProfit);
    elProfit.className = 'summary-value ' + (data.totalRealizedProfit >= 0 ? 'positive' : 'negative');

    // Saldo = Lucro Realizado - Total Investido (com seta e sinal)
    const balance = data.totalRealizedProfit - data.totalInvested;
    const elBalance = document.getElementById('valBalance');
    const arrow = balance >= 0 ? '▲' : '▼';
    const sign = balance >= 0 ? '+' : '-';
    elBalance.innerText = arrow + ' ' + sign + formatCurrency(Math.abs(balance));
    elBalance.className = 'summary-value ' + (balance >= 0 ? 'positive' : 'negative');

    // Monta as linhas: # = posição cronológica (array por data asc), ID e Data
    // vêm da própria transação (mesma ordem de data.tableData).
    const rows = data.tableData.map((row, i) => ({
        seq: i + 1,
        realId: transactions[i] ? transactions[i].id : row.id,
        date: transactions[i] ? transactions[i].dateTransaction : null,
        ...row
    }));

    // Exibição do mais recente para o mais antigo (apenas na renderização).
    rows.reverse();

    const tbody = document.querySelector('#txTable tbody');
    tbody.innerHTML = '';

    rows.forEach(row => {
        const tr = document.createElement('tr');

        let profitHtml = '-';
        if (row.realizedProfit !== null) {
            const pClass = row.realizedProfit >= 0 ? 'positive' : 'negative';
            profitHtml = `<span class="${pClass}">${row.realizedProfit > 0 ? '+' : ''}${formatCurrency(row.realizedProfit)}</span>`;
        }

        let potentialHtml = '- (Fechada)';
        if (row.status === 'open' && row.type === 'Compra') {
            const pClass = row.potential >= 0 ? 'positive' : 'negative';
            potentialHtml = `<span class="${pClass}">${row.potential > 0 ? '+' : ''}${formatCurrency(row.potential)}</span>`;
        } else if (row.type === 'Venda') {
            potentialHtml = '-';
        }

        const dateHtml = row.date ? formatDateTime(row.date) : '—';

        tr.innerHTML = `
            <td>${row.seq}</td>
            <td>${row.realId}</td>
            <td>${dateHtml}</td>
            <td>${row.type}</td>
            <td>${formatCrypto(row.aave)}</td>
            <td>${formatCurrency(row.brl)}</td>
            <td>${formatCurrency(row.unitPrice)}</td>
            <td>${profitHtml}</td>
            <td>${potentialHtml}</td>
            <td><button class="btn-remove" data-remove="${row.realId}">Remover</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// Remove a transação de id informado, após confirmação do usuário.
function removeTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    openConfirm('Deseja realmente remover a operação ID ' + id + '?', () => {
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions(transactions);
        // Recalcula o próximo ID considerando maior ID e tamanho do array.
        recalcNextTransactionId(transactions);
        updateDashboard();
    });
}

function addTransaction() {
    const type = document.getElementById('opType').value;
    const brl = parseFloat(document.getElementById('opBrl').value);
    const aave = parseFloat(document.getElementById('opAave').value);
    const dateInput = document.getElementById('opDate').value;

    if (!brl || !aave || brl <= 0 || aave <= 0) {
        alert('Por favor, insira valores válidos.');
        return;
    }

    const dateTransaction = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();

    const newId = computeNextTransactionId(transactions);
    transactions.push({ id: newId, dateTransaction, type, brl, aave });
    transactions = sortTransactionsByDate(transactions);
    saveTransactions(transactions);
    recalcNextTransactionId(transactions);

    closeModal();
    updateDashboard();
}

// ----- Modal de nova operação -----

function openModal() {
    document.getElementById('opType').value = 'buy';
    document.getElementById('opBrl').value = '';
    document.getElementById('opAave').value = '';
    document.getElementById('opDate').value = toLocalDatetimeValue(new Date());
    document.getElementById('opModal').classList.add('open');
}

function closeModal() {
    document.getElementById('opModal').classList.remove('open');
}

// ----- Modal de confirmação (genérico) -----

let confirmCallback = null;

function openConfirm(message, onYes) {
    document.getElementById('confirmMessage').innerText = message;
    confirmCallback = onYes;
    document.getElementById('confirmModal').classList.add('open');
}

function closeConfirm() {
    document.getElementById('confirmModal').classList.remove('open');
    confirmCallback = null;
}

// ----- Menu lateral -----

function applyMenuState(expanded) {
    document.getElementById('app').classList.toggle('menu-open', expanded);
}

function toggleMenu() {
    const expanded = !document.getElementById('app').classList.contains('menu-open');
    applyMenuState(expanded);
    setConfig('menuExpanded', expanded);
}

// ----- Preço -----

function setPriceStatus(text, cls) {
    const el = document.getElementById('priceStatus');
    el.innerText = text;
    el.className = 'price-status' + (cls ? ' ' + cls : '');
}

async function refreshPrice() {
    setPriceStatus('Atualizando preço…');
    try {
        const price = await fetchAavePriceBRL();
        const record = saveLastPrice(price);
        document.getElementById('currentPriceInput').value = price;
        updateDashboard();
        setPriceStatus('Atualizado em ' + formatDateTime(record.updatedAt), 'ok');
    } catch (e) {
        const last = loadLastPrice();
        if (last) {
            setPriceStatus('Falha ao atualizar — usando preço de ' + formatDateTime(last.updatedAt), 'error');
        } else {
            setPriceStatus('Falha ao buscar o preço (' + e.message + ')', 'error');
        }
    }
}

// ----- Inicialização e eventos -----

window.addEventListener('load', () => {
    // Menu lateral
    document.getElementById('btnMenuToggle').addEventListener('click', toggleMenu);
    applyMenuState(getConfig('menuExpanded', false));

    // Remoção de linha do histórico (listener delegado)
    document.querySelector('#txTable tbody').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-remove]');
        if (!btn) return;
        removeTransaction(Number(btn.getAttribute('data-remove')));
    });

    // Cotação
    document.getElementById('currentPriceInput').addEventListener('input', updateDashboard);
    document.getElementById('btnRefreshPrice').addEventListener('click', refreshPrice);

    // Modal de nova operação
    document.getElementById('btnOpenModal').addEventListener('click', openModal);
    document.getElementById('btnAdd').addEventListener('click', addTransaction);
    document.getElementById('btnCancelModal').addEventListener('click', closeModal);
    document.getElementById('opModalBackdrop').addEventListener('click', closeModal);

    // Modal de confirmação
    document.getElementById('btnConfirmCancel').addEventListener('click', closeConfirm);
    document.getElementById('confirmBackdrop').addEventListener('click', closeConfirm);
    document.getElementById('btnConfirmYes').addEventListener('click', () => {
        const cb = confirmCallback;
        closeConfirm();
        if (cb) cb();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeModal(); closeConfirm(); }
    });

    // Backup / Restore (dump completo do LocalStorage)
    document.getElementById('btnBackup').addEventListener('click', () => exportBackup());
    const restoreInput = document.getElementById('restoreInput');
    document.getElementById('btnRestore').addEventListener('click', () => restoreInput.click());
    restoreInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        importBackup(file, () => {
            transactions = loadTransactions();
            applyMenuState(getConfig('menuExpanded', false));
            const restored = loadLastPrice();
            if (restored) {
                document.getElementById('currentPriceInput').value = restored.price;
                setPriceStatus('Último preço de ' + formatDateTime(restored.updatedAt));
            }
            updateDashboard();
        });
        e.target.value = '';
    });

    // Preço: começa com o último preço conhecido (mesmo offline), depois atualiza.
    const last = loadLastPrice();
    if (last) {
        document.getElementById('currentPriceInput').value = last.price;
        setPriceStatus('Último preço de ' + formatDateTime(last.updatedAt));
    }

    updateDashboard();

    // Atualiza na inicialização e depois a cada 10 minutos.
    refreshPrice();
    setInterval(refreshPrice, PRICE_REFRESH_MS);
});
