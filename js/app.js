// Camada de UI: dashboard, modal de nova operação, menu lateral, preço e
// backup/restore. O motor de cálculo (portfolio.js) permanece intocado.

let transactions = loadTransactions();

// Formata a data/hora de uma string ISO no padrão pt-BR (usado no preço).
function formatDateTime(iso) {
    return new Date(iso).toLocaleString('pt-BR');
}

// Valor "YYYY-MM-DD" (fuso local) para inputs type="date".
function toLocalDateValue(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// Exibe a data da operação como dd/mm/aaaa, sem sofrer deslocamento de fuso
// (usa a parte YYYY-MM-DD diretamente, seja ela date-only ou ISO completa).
function formatDate(value) {
    const parts = String(value).slice(0, 10).split('-');
    if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
    return String(value);
}

function updateDashboard() {
    const data = processPortfolio();

    // Update Summary Cards
    document.getElementById('valTotalInvested').innerText = formatCurrency(data.totalInvested);
    document.getElementById('valTotalCoins').innerText = formatCrypto(data.totalCoins).replace('.', ',') + ' AAVE';
    document.getElementById('valAvgPrice').innerText = formatCurrency(data.avgPrice);
    document.getElementById('valMarketValue').innerText = formatCurrency(data.marketValue);

    const elProfit = document.getElementById('valRealizedProfit');
    elProfit.innerText = formatCurrency(data.totalRealizedProfit);
    elProfit.className = 'summary-value ' + (data.totalRealizedProfit >= 0 ? 'positive' : 'negative');

    // Saldo = Lucro Realizado - Total Investido (seta no fim; cor indica o sinal)
    const balance = data.totalRealizedProfit - data.totalInvested;
    const elBalance = document.getElementById('valBalance');
    const arrow = balance >= 0 ? '▲' : '▼';
    elBalance.innerText = formatCurrency(Math.abs(balance)) + ' ' + arrow;
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

        const dateHtml = row.date ? formatDate(row.date) : '—';

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
            <td>
                <button class="btn-edit" data-edit="${row.realId}" title="Editar">✏️</button>
                <button class="btn-remove" data-remove="${row.realId}" title="Remover">✕</button>
            </td>
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

// Salva a operação do modal: se estiver editando, atualiza a transação de
// mesmo id; caso contrário, cria uma nova. Depois reordena por data.
function addTransaction() {
    const type = document.getElementById('opType').dataset.type;
    const brl = parseFloat(document.getElementById('opBrl').value);
    const aave = parseFloat(document.getElementById('opAave').value);
    const dateInput = document.getElementById('opDate').value;

    if (!brl || !aave || brl <= 0 || aave <= 0) {
        alert('Por favor, insira valores válidos.');
        return;
    }

    // Guarda a data apenas como "YYYY-MM-DD" (sem hora).
    const dateTransaction = dateInput || toLocalDateValue(new Date());

    if (editingId !== null) {
        // Edição: mantém o mesmo id, atualiza os demais campos.
        const tx = transactions.find(t => t.id === editingId);
        if (tx) {
            tx.type = type;
            tx.brl = brl;
            tx.aave = aave;
            tx.dateTransaction = dateTransaction;
        }
        transactions = sortTransactionsByDate(transactions);
        saveTransactions(transactions);
    } else {
        // Nova operação.
        const newId = computeNextTransactionId(transactions);
        transactions.push({ id: newId, dateTransaction, type, brl, aave });
        transactions = sortTransactionsByDate(transactions);
        saveTransactions(transactions);
        recalcNextTransactionId(transactions);
    }

    closeModal();
    updateDashboard();
}

// ----- Modal de nova/edição de operação -----

// id da transação em edição (null = nova operação).
let editingId = null;

// Abre o modal. Sem argumento = nova operação; com uma transação = edição.
function openModal(tx) {
    const btnEl = document.getElementById('btnAdd');

    if (tx) {
        editingId = tx.id;
        btnEl.textContent = 'Salvar';
        setOpType(tx.type);
        document.getElementById('opBrl').value = tx.brl;
        document.getElementById('opAave').value = tx.aave;
        document.getElementById('opDate').value = tx.dateTransaction
            ? String(tx.dateTransaction).slice(0, 10)
            : toLocalDateValue(new Date());
    } else {
        editingId = null;
        btnEl.textContent = 'Adicionar';
        setOpType('buy');
        document.getElementById('opBrl').value = '';
        document.getElementById('opAave').value = '';
        document.getElementById('opDate').value = toLocalDateValue(new Date());
    }
    document.getElementById('opModal').classList.add('open');
}

// Abre o modal em modo edição para a transação de id informado.
function editTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (tx) openModal(tx);
}

// Atualiza o título do modal com o modo e o tipo atuais
// (ex.: "Nova Operação - Compra" / "Editar Operação - Venda").
function updateModalTitle() {
    const base = editingId !== null ? 'Editar Operação' : 'Nova Operação';
    const type = document.getElementById('opType').dataset.type;
    const label = type === 'buy' ? 'Compra' : 'Venda';
    document.getElementById('opModalTitle').textContent = base + ' - ' + label;
}

// Define o tipo no toggle deslizante (texto, cor e valor em data-type) e
// reflete a mudança no título do modal.
function setOpType(type) {
    const el = document.getElementById('opType');
    el.dataset.type = type;
    el.querySelector('.op-toggle-text').textContent = type === 'buy' ? 'Compra' : 'Venda';
    el.classList.toggle('toggle-buy', type === 'buy');
    el.classList.toggle('toggle-sell', type === 'sell');
    updateModalTitle();
}

// Alterna entre Compra e Venda.
function toggleOpType() {
    const current = document.getElementById('opType').dataset.type;
    setOpType(current === 'buy' ? 'sell' : 'buy');
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

    // Editar/Remover linha do histórico (listener delegado)
    document.querySelector('#txTable tbody').addEventListener('click', (e) => {
        const editBtn = e.target.closest('button[data-edit]');
        if (editBtn) {
            editTransaction(Number(editBtn.getAttribute('data-edit')));
            return;
        }
        const removeBtn = e.target.closest('button[data-remove]');
        if (removeBtn) {
            removeTransaction(Number(removeBtn.getAttribute('data-remove')));
        }
    });

    // Cotação
    document.getElementById('currentPriceInput').addEventListener('input', updateDashboard);
    document.getElementById('btnRefreshPrice').addEventListener('click', refreshPrice);

    // Modal de nova operação
    document.getElementById('btnOpenModal').addEventListener('click', () => openModal());
    document.getElementById('opType').addEventListener('click', toggleOpType);
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
