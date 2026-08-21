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

    updateDashboard();
});
