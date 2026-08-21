// Método de cálculo do portfólio AAVE.
// IMPORTANTE: esta lógica é o coração da ferramenta e não deve ser alterada.
// Usa identificação específica de lotes: ao vender, consome primeiro os lotes
// de menor preço unitário para calcular o custo base e o lucro realizado.

const formatCurrency = (value) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCrypto = (value) => {
    return value.toFixed(8);
};

function processPortfolio() {
    let lots = [];
    let totalRealizedProfit = 0;
    let tableData = [];

    const currentPrice = parseFloat(document.getElementById('currentPriceInput').value) || 0;

    transactions.forEach((tx, index) => {
        const unitPrice = tx.brl / tx.aave;
        let realizedProfit = 0;
        let status = 'open';

        if (tx.type === 'buy') {
            lots.push({
                id: index + 1,
                originalAave: tx.aave,
                availableAave: tx.aave,
                unitPrice: unitPrice
            });
        } else if (tx.type === 'sell') {
            let remainingToSell = tx.aave;
            let costBasis = 0;

            // Specific Identification: Sort lots by cheapest unit price
            let availableLots = lots.filter(l => l.availableAave > 0).sort((a, b) => a.unitPrice - b.unitPrice);

            for (let lot of availableLots) {
                if (remainingToSell <= 0) break;

                let amountTaken = Math.min(remainingToSell, lot.availableAave);
                lot.availableAave -= amountTaken;
                remainingToSell -= amountTaken;
                costBasis += (amountTaken * lot.unitPrice);
            }

            realizedProfit = tx.brl - costBasis;
            totalRealizedProfit += realizedProfit;
            status = 'closed';
        }

        // Calculate potential for this row
        let potential = null;
        if (tx.type === 'buy') {
            let activeLot = lots.find(l => l.id === (index + 1));
            if (activeLot && activeLot.availableAave > 0) {
                potential = currentPrice - unitPrice;
            } else {
                status = 'closed';
            }
        }

        tableData.push({
            id: index + 1,
            type: tx.type === 'buy' ? 'Compra' : 'Venda',
            aave: tx.aave,
            brl: tx.brl,
            unitPrice: unitPrice,
            realizedProfit: tx.type === 'sell' ? realizedProfit : null,
            potential: potential,
            status: status
        });
    });

    // Calculate current totals from active lots
    let totalInvested = 0;
    let totalCoins = 0;

    lots.forEach(lot => {
        if (lot.availableAave > 0) {
            totalCoins += lot.availableAave;
            totalInvested += (lot.availableAave * lot.unitPrice);
        }
    });

    const avgPrice = totalCoins > 0 ? totalInvested / totalCoins : 0;
    const marketValue = totalCoins * currentPrice;

    return {
        totalInvested,
        totalCoins,
        avgPrice,
        marketValue,
        totalRealizedProfit,
        tableData
    };
}
