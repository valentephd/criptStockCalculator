// Página do ativo (asset.html?id=): dashboard, modal de operação, cotação.
// O menu, backup/restore e toggle são responsabilidade do shell.js.
// O motor (portfolio.js) processa o global `transactions` = visão do ativo da rota.

let allTransactions = loadTransactions();   // completo (todos os ativos)
let transactions = [];                       // visão do ativo da rota (motor + tabela)
let assetSymbol = '';                        // símbolo do ativo (rótulos dinâmicos)
let currentAsset = null;                     // ativo da rota (?id=)
let assetDecimals = 8;                       // casas decimais da quantidade do ativo

// Recalcula a visão do ativo da rota a partir da lista completa.
function setActiveView() {
    transactions = currentAsset
        ? allTransactions.filter(t => t.assetId === currentAsset.id)
        : [];
}

// Formata a data/hora de uma string ISO no padrão pt-BR (usado no preço).
function formatDateTime(iso) {
    return new Date(iso).toLocaleString('pt-BR');
}

// Valor "YYYY-MM-DD" (fuso local) para inputs type="date".
function toLocalDateValue(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// Exibe a data da operação como dd/mm/aaaa, sem sofrer deslocamento de fuso.
function formatDate(value) {
    const parts = String(value).slice(0, 10).split('-');
    if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
    return String(value);
}

// Máscara caixa eletrônico: só dígitos, preenchendo da direita, casas fixas.
function maskAmount(rawValue, decimals) {
    const digits = String(rawValue).replace(/\D/g, '');
    if (!digits) return '';
    const num = parseInt(digits, 10) / Math.pow(10, decimals);
    return num.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

// Converte o texto mascarado ("1.234,55") de volta em número (1234.55).
function unmaskAmount(str) {
    const n = parseFloat(String(str).replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : NaN;
}

// Monta uma "tag" (pílula) de resultado, colorida pelo sinal, com um rótulo curto.
function resultTag(label, value, kind) {
    const cls = value >= 0 ? 'positive' : 'negative';
    const sign = value > 0 ? '+' : '';
    return `<span class="tag ${kind} ${cls}"><span class="tag-label">${label}</span>${sign}${formatCurrency(value)}</span>`;
}

// Entrada livre: dígitos e UMA vírgula, com no máximo `decimals` casas.
function sanitizeDecimalInput(value, decimals) {
    let v = String(value).replace(/[^\d,]/g, '');
    if (decimals <= 0) {
        return v.replace(/,/g, ''); // sem casas decimais: só dígitos
    }
    const i = v.indexOf(',');
    if (i !== -1) {
        const intPart = v.slice(0, i);
        const decPart = v.slice(i + 1).replace(/,/g, '').slice(0, decimals);
        v = intPart + ',' + decPart;
    }
    return v;
}

function updateDashboard() {
    const data = processPortfolio();

    document.getElementById('valTotalInvested').innerText = formatCurrency(data.totalInvested);
    document.getElementById('valTotalCoins').innerText = formatAmount(data.totalCoins, assetDecimals) + ' ' + assetSymbol;
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

        // Coluna "Resultado": venda mostra o Lucro Realizado; compra mostra o
        // Potencial da operação (preço atual × qtd − valor gasto).
        let resultHtml = '—';
        if (row.type === 'Venda' && row.realizedProfit !== null) {
            resultHtml = resultTag('Realizado', row.realizedProfit, 'realizado');
        } else if (row.type === 'Compra' && row.status === 'open') {
            resultHtml = resultTag('Potencial', row.potential * row.assetQuantity, 'potencial');
        }

        const dateHtml = row.date ? formatDate(row.date) : '—';

        tr.innerHTML = `
            <td>${row.seq}</td>
            <td>${row.realId}</td>
            <td>${dateHtml}</td>
            <td>${row.type}</td>
            <td>${formatAmount(row.assetQuantity, assetDecimals)}</td>
            <td>${formatCurrency(row.brl)}</td>
            <td>${formatCurrency(row.unitPrice)}</td>
            <td>${resultHtml}</td>
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
    const tx = allTransactions.find(t => t.id === id);
    if (!tx) return;

    openConfirm('Deseja realmente remover a operação ID ' + id + '?', () => {
        allTransactions = allTransactions.filter(t => t.id !== id);
        saveTransactions(allTransactions);
        recalcNextTransactionId(allTransactions);
        setActiveView();
        updateDashboard();
    });
}

// Salva a operação do modal: edição (mesmo id) ou nova. Depois reordena por data.
function addTransaction() {
    const type = document.getElementById('opType').dataset.type;
    const brl = unmaskAmount(document.getElementById('opBrl').value);
    const assetQuantity = unmaskAmount(document.getElementById('opAave').value);
    const dateInput = document.getElementById('opDate').value;

    if (!brl || !assetQuantity || brl <= 0 || assetQuantity <= 0) {
        alert('Por favor, insira valores válidos.');
        return;
    }

    if (!currentAsset) {
        alert('Nenhum ativo selecionado.');
        return;
    }

    const dateTransaction = dateInput || toLocalDateValue(new Date());

    if (editingId !== null) {
        const tx = allTransactions.find(t => t.id === editingId);
        if (tx) {
            tx.type = type;
            tx.brl = brl;
            tx.assetQuantity = assetQuantity;
            tx.dateTransaction = dateTransaction;
        }
        allTransactions = sortTransactionsByDate(allTransactions);
        saveTransactions(allTransactions);
    } else {
        const newId = computeNextTransactionId(allTransactions);
        allTransactions.push({ id: newId, assetId: currentAsset.id, dateTransaction, type, brl, assetQuantity });
        allTransactions = sortTransactionsByDate(allTransactions);
        saveTransactions(allTransactions);
        recalcNextTransactionId(allTransactions);
    }

    closeModal();
    setActiveView();
    updateDashboard();
}

// ----- Modal de nova/edição de operação -----

let editingId = null;

function openModal(tx) {
    const btnEl = document.getElementById('btnAdd');

    if (tx) {
        editingId = tx.id;
        btnEl.textContent = 'Salvar';
        setOpType(tx.type);
        document.getElementById('opBrl').value = formatAmount(tx.brl, 2);
        document.getElementById('opAave').value = formatAmount(tx.assetQuantity, assetDecimals);
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

function editTransaction(id) {
    const tx = allTransactions.find(t => t.id === id);
    if (tx) openModal(tx);
}

// Atualiza o título do modal com o modo e o tipo atuais.
function updateModalTitle() {
    const base = editingId !== null ? 'Editar Operação' : 'Nova Operação';
    const type = document.getElementById('opType').dataset.type;
    const label = type === 'buy' ? 'Compra' : 'Venda';
    document.getElementById('opModalTitle').textContent = base + ' - ' + label;
}

// Define o tipo no toggle deslizante e reflete no título do modal.
function setOpType(type) {
    const el = document.getElementById('opType');
    el.dataset.type = type;
    el.querySelector('.op-toggle-text').textContent = type === 'buy' ? 'Compra' : 'Venda';
    el.classList.toggle('toggle-buy', type === 'buy');
    el.classList.toggle('toggle-sell', type === 'sell');
    updateModalTitle();
}

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

// ----- Preço -----

function setPriceStatus(text, cls) {
    const el = document.getElementById('priceStatus');
    el.innerText = text;
    el.className = 'price-status' + (cls ? ' ' + cls : '');
}

async function refreshPrice() {
    const asset = currentAsset;
    if (!asset) {
        setPriceStatus('Nenhum ativo selecionado.');
        return;
    }
    setPriceStatus('Atualizando preço…');
    try {
        const price = await fetchAssetPriceBRL(asset.marketId);
        const record = saveLastPrice(asset.id, price);
        document.getElementById('currentPriceInput').value = formatPrice(price);
        updateDashboard();
        setPriceStatus('Atualizado em ' + formatDateTime(record.updatedAt), 'ok');
    } catch (e) {
        const last = loadLastPrice(asset.id);
        if (last) {
            setPriceStatus('Falha ao atualizar — usando preço de ' + formatDateTime(last.updatedAt), 'error');
        } else {
            setPriceStatus('Falha ao buscar o preço (' + e.message + ')', 'error');
        }
    }
}

// ----- Inicialização e eventos -----

window.addEventListener('load', () => {
    // Resolve o ativo da rota (?id=). Sem ativo válido -> aviso e para.
    const routeAssetId = Number(new URLSearchParams(location.search).get('id'));
    const asset = getAssetById(routeAssetId);
    if (!asset) {
        document.getElementById('assetNotFound').style.display = '';
        document.getElementById('assetPanel').style.display = 'none';
        document.getElementById('btnOpenModal').style.display = 'none';
        return;
    }

    currentAsset = asset; // fonte da verdade = URL
    assetSymbol = asset.symbol;
    assetDecimals = (typeof asset.quantityDecimals === 'number' ? asset.quantityDecimals : 8);
    document.getElementById('assetTitle').textContent = asset.symbol;
    document.getElementById('opModalAsset').textContent = asset.symbol;
    document.getElementById('lblTotalCoins').textContent = 'Total ' + asset.symbol;
    document.getElementById('thQtd').textContent = 'Qtd (' + asset.symbol + ')';
    document.getElementById('opAave').placeholder = assetDecimals > 0 ? '0,' + '0'.repeat(assetDecimals) : '0';
    setActiveView();

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

    // Cotação (input/status/botão vêm do menu injetado pelo shell)
    const priceEl = document.getElementById('currentPriceInput');
    priceEl.addEventListener('input', updateDashboard);
    priceEl.addEventListener('blur', () => {
        if (priceEl.value.trim() === '') return;
        priceEl.value = formatPrice(parsePrice(priceEl.value));
    });
    document.getElementById('btnRefreshPrice').addEventListener('click', refreshPrice);

    // Modal de nova operação
    document.getElementById('btnOpenModal').addEventListener('click', () => openModal());
    document.getElementById('opType').addEventListener('click', toggleOpType);

    // Valor (R$): máscara caixa eletrônico (2 casas, preenche da direita).
    const opBrlEl = document.getElementById('opBrl');
    opBrlEl.addEventListener('input', () => { opBrlEl.value = maskAmount(opBrlEl.value, 2); });

    // Quantidade: entrada livre com vírgula; completa as casas do ativo ao sair.
    const opAaveEl = document.getElementById('opAave');
    opAaveEl.addEventListener('input', () => { opAaveEl.value = sanitizeDecimalInput(opAaveEl.value, assetDecimals); });
    opAaveEl.addEventListener('blur', () => {
        if (!opAaveEl.value) return;
        const num = unmaskAmount(opAaveEl.value);
        opAaveEl.value = isFinite(num) ? formatAmount(num, assetDecimals) : '';
    });
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

    // Preço: começa com o último preço conhecido do ativo (mesmo offline).
    const last = loadLastPrice(asset.id);
    if (last) {
        document.getElementById('currentPriceInput').value = formatPrice(last.price);
        setPriceStatus('Último preço de ' + formatDateTime(last.updatedAt));
    }

    updateDashboard();

    // Atualiza na inicialização e depois no intervalo configurado (minutos).
    refreshPrice();
    const refreshMinutes = Number(getConfig('priceRefreshMinutes', 10)) || 10;
    setInterval(refreshPrice, refreshMinutes * 60 * 1000);
});
