// Camada de UI: renderização do dashboard, adição de operações e wiring dos
// eventos (cotação, adicionar, backup e restauração).

let transactions = loadTransactions();

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

    // Update Table
    const tbody = document.querySelector('#txTable tbody');
    tbody.innerHTML = '';

    data.tableData.forEach(row => {
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

        tr.innerHTML = `
            <td>${row.id}</td>
            <td>${row.type}</td>
            <td>${formatCrypto(row.aave)}</td>
            <td>${formatCurrency(row.brl)}</td>
            <td>${formatCurrency(row.unitPrice)}</td>
            <td>${profitHtml}</td>
            <td>${potentialHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function addTransaction() {
    const type = document.getElementById('opType').value;
    const brl = parseFloat(document.getElementById('opBrl').value);
    const aave = parseFloat(document.getElementById('opAave').value);

    if (!brl || !aave || brl <= 0 || aave <= 0) {
        alert('Por favor, insira valores válidos.');
        return;
    }

    transactions.push({ type, brl, aave });
    saveTransactions(transactions);

    // Clear inputs
    document.getElementById('opBrl').value = '';
    document.getElementById('opAave').value = '';

    updateDashboard();
}

// Formata a data/hora de uma string ISO no padrão pt-BR.
function formatDateTime(iso) {
    return new Date(iso).toLocaleString('pt-BR');
}

// Atualiza o rótulo de status do preço (com classe visual opcional).
function setPriceStatus(text, cls) {
    const el = document.getElementById('priceStatus');
    el.innerText = text;
    el.className = 'price-status' + (cls ? ' ' + cls : '');
}

// Busca o preço atual na API, atualiza o campo/dashboard e persiste o último
// preço conhecido no LocalStorage. Em caso de falha, mantém o último preço.
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

// Wiring dos eventos e inicialização.
window.addEventListener('load', () => {
    document.getElementById('currentPriceInput').addEventListener('input', updateDashboard);
    document.getElementById('btnAdd').addEventListener('click', addTransaction);

    document.getElementById('btnBackup').addEventListener('click', () => exportBackup(transactions));

    const restoreInput = document.getElementById('restoreInput');
    document.getElementById('btnRestore').addEventListener('click', () => restoreInput.click());
    restoreInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        importBackup(file, (newTxs) => {
            transactions = newTxs;
            updateDashboard();
        });
        // Permite reimportar o mesmo arquivo novamente, se necessário.
        e.target.value = '';
    });

    // Preço: começa com o último preço conhecido (mesmo offline), depois atualiza.
    const last = loadLastPrice();
    if (last) {
        document.getElementById('currentPriceInput').value = last.price;
        setPriceStatus('Último preço de ' + formatDateTime(last.updatedAt));
    }

    document.getElementById('btnRefreshPrice').addEventListener('click', refreshPrice);

    updateDashboard();

    // Atualiza na inicialização e depois a cada 10 minutos.
    refreshPrice();
    setInterval(refreshPrice, PRICE_REFRESH_MS);
});
