// Página do ativo (asset.html?id=): dashboard, modal de operação, cotação.
// O menu, backup/restore e toggle são responsabilidade do shell.js.
// O motor (portfolio.js) processa o global `transactions` = visão do ativo da rota.

let allTransactions = loadTransactions();   // completo (todos os ativos)
let transactions = [];                       // buy/sell do ativo da rota (motor + tabela)
let proventos = [];                          // proventos (income) do ativo da rota
let assetSymbol = '';                        // símbolo do ativo (rótulos dinâmicos)
let currentAsset = null;                     // ativo da rota (?id=)
let assetDecimals = 8;                       // casas decimais da quantidade do ativo
let isFii = false;                           // ativo do tipo FII (habilita proventos)

// Recalcula a visão do ativo da rota a partir da lista completa.
// IMPORTANTE: `transactions` (que alimenta o motor) contém APENAS buy/sell;
// os proventos ficam à parte, tratados na camada da página, deixando o
// motor (portfolio.js) intocado.
function setActiveView() {
    const view = currentAsset
        ? allTransactions.filter(t => t.assetId === currentAsset.id)
        : [];
    transactions = view.filter(t => t.type === 'buy' || t.type === 'sell');
    proventos = view.filter(t => t.type === 'income');
}

// Quantidade de papéis em carteira até (e incluindo) uma data — soma de compras
// menos vendas com dateTransaction <= data. Base para o "R$ por ação" do provento
// e a validação de lançamento. Datas comparadas como texto "YYYY-MM-DD".
// Custo/posição do ativo em (e até) uma data, reaproveitando o MOTOR: troca
// temporariamente o global `transactions` pelas compras/vendas até a data e lê
// o resultado (identificação específica de lotes idêntica ao painel). Restaura
// `transactions` ao final. O preço atual não afeta invested/coins/avg.
function costBasisOn(dateStr) {
    const cut = String(dateStr || '').slice(0, 10);
    const saved = transactions;
    transactions = (currentAsset ? allTransactions.filter(t => t.assetId === currentAsset.id) : [])
        .filter(t => (t.type === 'buy' || t.type === 'sell') &&
            String(t.dateTransaction || '').slice(0, 10) <= cut);
    const d = processPortfolio();
    transactions = saved;
    return { invested: d.totalInvested, coins: d.totalCoins, avg: d.avgPrice };
}

function qtyHeldOn(dateStr, excludeId) {
    const cut = String(dateStr || '').slice(0, 10);
    let held = 0;
    (currentAsset ? allTransactions.filter(t => t.assetId === currentAsset.id) : []).forEach(t => {
        if (excludeId != null && t.id === excludeId) return; // ignora a própria (edição)
        if (t.type !== 'buy' && t.type !== 'sell') return;
        const d = String(t.dateTransaction || '').slice(0, 10);
        if (d <= cut) held += (t.type === 'buy' ? t.assetQuantity : -t.assetQuantity);
    });
    return held;
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

    // Total de proventos recebidos no ativo (camada da página; fora do motor).
    const proventosTotal = proventos.reduce((s, p) => s + (isFinite(p.brl) ? p.brl : 0), 0);

    document.getElementById('valTotalInvested').innerText = formatCurrency(data.totalInvested);
    document.getElementById('valTotalCoins').innerText = formatAmount(data.totalCoins, assetDecimals) + ' ' + assetSymbol;
    document.getElementById('valAvgPrice').innerText = formatUnitPrice(data.avgPrice);
    document.getElementById('valMarketValue').innerText = formatCurrency(data.marketValue);

    const elProfit = document.getElementById('valRealizedProfit');
    elProfit.innerText = formatCurrency(data.totalRealizedProfit);
    elProfit.className = 'summary-value ' + (data.totalRealizedProfit >= 0 ? 'positive' : 'negative');

    // Proventos recebidos (linha exibida só para FII; sempre "ganho" -> verde).
    const elProventos = document.getElementById('valProventos');
    if (elProventos) {
        elProventos.innerText = formatCurrency(proventosTotal);
        elProventos.className = 'summary-value positive';
    }

    // Payback de Proventos = Proventos Recebidos ÷ Total Investido ATUAL.
    // Dinâmico: mede quanto do custo da posição que você AINDA tem já voltou em
    // proventos. Com 0 cotas (posição zerada) não há o que calcular -> "—".
    const elProvYoC = document.getElementById('valProventosYoC');
    if (elProvYoC) {
        if (data.totalInvested > 0) {
            elProvYoC.innerText = formatPct(proventosTotal / data.totalInvested);
            elProvYoC.className = 'summary-value positive';
        } else {
            elProvYoC.innerText = '—';
            elProvYoC.className = 'summary-value';
        }
    }

    // Balão de ajuda do Payback: composição do cálculo com os valores atuais.
    const elYocTip = document.getElementById('yocHelpTip');
    if (elYocTip) {
        elYocTip.textContent = 'Payback de Proventos = Proventos Recebidos (' + formatCurrency(proventosTotal) +
            ') ÷ Total Investido atual (' + formatCurrency(data.totalInvested) +
            '). Quanto do custo da posição que você ainda tem já voltou em proventos. Sem posição, não há o que calcular.';
    }

    // Preço Médio Ajustado (com proventos) = (Investido - Proventos) / Qtd.
    // Exceções: sem posição em carteira (Qtd = 0) -> "—" (evita divisão por
    // zero); se Proventos > Investido, o ajustado fica NEGATIVO de propósito
    // (custo efetivo já recuperado) e é exibido como negativo/verde.
    const elAvgAdj = document.getElementById('valAvgPriceAdj');
    if (elAvgAdj) {
        if (data.totalCoins > 0) {
            // Trava em zero: proventos reduzem o custo efetivo até no máximo R$ 0
            // (nunca negativo). Seta ▼ (verde) quando caiu vs. preço médio atual.
            const adj = Math.max(0, (data.totalInvested - proventosTotal) / data.totalCoins);
            const dropped = adj < data.avgPrice;
            elAvgAdj.innerText = formatUnitPrice(adj) + (dropped ? ' ▼' : '');
            elAvgAdj.className = 'summary-value ' + (dropped ? 'positive' : '');
        } else {
            elAvgAdj.innerText = '—';
            elAvgAdj.className = 'summary-value';
        }
    }

    // Saldo = Lucro Realizado (trading) + Proventos - Total Investido.
    // (seta no fim; cor indica o sinal). Para não-FII, proventosTotal = 0 e a
    // fórmula recai no comportamento anterior.
    const balance = data.totalRealizedProfit + proventosTotal - data.totalInvested;
    const elBalance = document.getElementById('valBalance');
    const arrow = balance >= 0 ? '▲' : '▼';
    elBalance.innerText = formatCurrency(Math.abs(balance)) + ' ' + arrow;
    elBalance.className = 'summary-value ' + (balance >= 0 ? 'positive' : 'negative');

    // Linhas de trading (buy/sell), vindas do motor e alinhadas com `transactions`.
    const tradeRows = data.tableData.map((row, i) => ({
        realId: transactions[i] ? transactions[i].id : row.id,
        date: transactions[i] ? transactions[i].dateTransaction : null,
        kind: 'trade',
        ...row
    }));

    // Linhas de proventos. Para cada um (em ordem cronológica):
    // - "R$ por cota" = valor / posição na data;
    // - YoC do provento = valor / custo AJUSTADO na data, onde
    //   custo ajustado = custo das cotas na data − proventos recebidos ANTES
    //   deste. À medida que os proventos se acumulam, o custo ajustado cai (e o
    //   % tende a subir). `accProv` acumula os proventos anteriores.
    let accProv = 0;
    const proventoRows = proventos.map(p => {
        const cb = costBasisOn(p.dateTransaction);
        const held = cb.coins;
        const adjustedCost = cb.invested - accProv;
        const yoc = adjustedCost > 0 ? p.brl / adjustedCost : null;
        accProv += p.brl; // passa a contar este provento para os próximos
        return {
            realId: p.id,
            date: p.dateTransaction,
            kind: 'income',
            type: 'Provento',
            assetQuantity: 0,
            heldQty: held,          // posição na data (calculada em tela, não persistida)
            brl: p.brl,
            unitPrice: held > 0 ? p.brl / held : null,
            yoc: yoc,               // Yield on Cost do provento (custo ajustado)
            realizedProfit: null,
            potential: null,
            status: 'closed'
        };
    });

    // Ordena tudo por data (asc, desempate por id) e numera; depois inverte
    // para exibir do mais recente ao mais antigo.
    const rows = tradeRows.concat(proventoRows).sort((a, b) => {
        const da = String(a.date || '').slice(0, 10);
        const db = String(b.date || '').slice(0, 10);
        if (da !== db) return da < db ? -1 : 1;
        return a.realId - b.realId;
    });
    rows.forEach((r, i) => { r.seq = i + 1; });
    rows.reverse();

    const tbody = document.querySelector('#txTable tbody');
    tbody.innerHTML = '';

    rows.forEach(row => {
        const tr = document.createElement('tr');

        // Coluna "Resultado": venda mostra o Lucro Realizado; compra mostra o
        // Potencial da operação (preço atual × qtd − valor gasto); provento
        // mostra o valor recebido (verde).
        let resultHtml = '—';
        if (row.kind === 'income') {
            // Provento: valor recebido + YoC do provento (custo ajustado).
            const pct = row.yoc != null ? ' · ' + formatPct(row.yoc) : '';
            resultHtml = `<span class="tag provento positive"><span class="tag-label">Provento</span>+${formatCurrency(row.brl)}${pct}</span>`;
        } else if (row.type === 'Venda' && row.realizedProfit !== null) {
            resultHtml = resultTag('Realizado', row.realizedProfit, 'realizado');
        } else if (row.type === 'Compra' && row.status === 'open') {
            resultHtml = resultTag('Potencial', row.potential * row.assetQuantity, 'potencial');
        }

        const dateHtml = row.date ? formatDate(row.date) : '—';
        // Provento: Qtd = posição em carteira na data do recebimento (base do
        // rateio "R$ por ação"), calculada em tela. Sem posição -> "—".
        const qtyHtml = row.kind === 'income'
            ? (row.heldQty > 0 ? formatAmount(row.heldQty, assetDecimals) : '—')
            : formatAmount(row.assetQuantity, assetDecimals);
        const unitHtml = row.unitPrice === null ? '—' : formatUnitPrice(row.unitPrice);

        // Cor da operação (todos os ativos): compra vermelho, venda verde,
        // provento azul.
        const opClass = row.kind === 'income'
            ? 'op-income'
            : (row.type === 'Compra' ? 'op-buy' : 'op-sell');

        tr.innerHTML = `
            <td>${row.seq}</td>
            <td>${row.realId}</td>
            <td>${dateHtml}</td>
            <td><span class="op-label ${opClass}">${row.type}</span></td>
            <td>${qtyHtml}</td>
            <td>${formatCurrency(row.brl)}</td>
            <td>${unitHtml}</td>
            <td>${resultHtml}</td>
            <td>
                <button class="btn-edit" data-edit="${row.realId}" title="Editar">✏️</button>
                <button class="btn-edit" data-duplicate="${row.realId}" title="Duplicar operação">🔁</button>
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
    const type = currentOpType;
    const brl = unmaskAmount(document.getElementById('opBrl').value);
    const dateInput = document.getElementById('opDate').value;

    if (!currentAsset) {
        alert('Nenhum ativo selecionado.');
        return;
    }

    const dateTransaction = dateInput || toLocalDateValue(new Date());

    // Provento (income): não movimenta papéis; exige valor > 0 e posição > 0
    // na data (não se recebe provento sem ter o papel em carteira).
    let assetQuantity;
    if (type === 'income') {
        if (!brl || brl <= 0) {
            alert('Informe um valor de provento válido.');
            return;
        }
        if (qtyHeldOn(dateTransaction) <= 0) {
            alert('Você não possui posição neste ativo na data informada; não é possível lançar um provento.');
            return;
        }
        assetQuantity = 0;
    } else {
        assetQuantity = unmaskAmount(document.getElementById('opAave').value);
        if (!brl || !assetQuantity || brl <= 0 || assetQuantity <= 0) {
            alert('Por favor, insira valores válidos.');
            return;
        }
        // Venda: não permite vender mais do que a posição na data (exclui a
        // própria operação ao editar). Epsilon evita rejeição por arredondamento.
        if (type === 'sell') {
            const available = qtyHeldOn(dateTransaction, editingId);
            if (assetQuantity > available + 1e-9) {
                alert('Você possui apenas ' + formatAmount(available, assetDecimals) + ' ' + assetSymbol +
                    ' na data informada; não é possível vender ' + formatAmount(assetQuantity, assetDecimals) + '.');
                return;
            }
        }
    }

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
let currentOpType = 'buy';   // tipo selecionado no modal (buy | sell | income)

// Abre o modal. Sem tx = nova operação em branco. Com tx: edição (mesmo id) ou,
// se isDuplicate, uma NOVA operação pré-preenchida com os mesmos valores,
// mantendo a data original da transação duplicada.
function openModal(tx, isDuplicate) {
    const btnEl = document.getElementById('btnAdd');

    if (tx && !isDuplicate) {
        editingId = tx.id;
        btnEl.textContent = 'Salvar';
    } else if (tx && isDuplicate) {
        editingId = null;
        btnEl.textContent = 'Adicionar';
    } else {
        editingId = null;
        btnEl.textContent = 'Adicionar';
        setOpType('buy');
        document.getElementById('opBrl').value = '';
        document.getElementById('opAave').value = '';
        document.getElementById('opDate').value = toLocalDateValue(new Date());
        document.getElementById('opModal').classList.add('open');
        return;
    }

    setOpType(tx.type);
    document.getElementById('opBrl').value = formatAmount(tx.brl, 2);
    document.getElementById('opAave').value = tx.type === 'income'
        ? ''
        : formatAmount(tx.assetQuantity, assetDecimals);
    // Edição e duplicação mantêm a data original da transação.
    document.getElementById('opDate').value = tx.dateTransaction
        ? String(tx.dateTransaction).slice(0, 10)
        : toLocalDateValue(new Date());
    document.getElementById('opModal').classList.add('open');
}

function editTransaction(id) {
    const tx = allTransactions.find(t => t.id === id);
    if (tx) openModal(tx);
}

function duplicateTransaction(id) {
    const tx = allTransactions.find(t => t.id === id);
    if (tx) openModal(tx, true);
}

const OP_TYPE_LABELS = { buy: 'Compra', sell: 'Venda', income: 'Provento' };

// Atualiza o título do modal com o modo e o tipo atuais.
function updateModalTitle() {
    const base = editingId !== null ? 'Editar Operação' : 'Nova Operação';
    document.getElementById('opModalTitle').textContent = base + ' - ' + (OP_TYPE_LABELS[currentOpType] || '');
}

// Define o tipo atual e reflete em todos os controles do modal:
// - toggle deslizante (não-FII) para buy/sell;
// - controle segmentado (FII) para buy/sell/income;
// - visibilidade do campo Quantidade (oculto em provento) e rótulo do Valor.
function setOpType(type) {
    currentOpType = type;

    // Toggle deslizante (usado em ativos não-FII): só representa buy/sell.
    const slide = document.getElementById('opType');
    if (type === 'buy' || type === 'sell') {
        slide.dataset.type = type;
        slide.querySelector('.op-toggle-text').textContent = type === 'buy' ? 'Compra' : 'Venda';
        slide.classList.toggle('toggle-buy', type === 'buy');
        slide.classList.toggle('toggle-sell', type === 'sell');
    }

    // Controle segmentado (FII): destaca o botão do tipo atual.
    document.querySelectorAll('#opTypeSeg .op-seg-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === type);
    });

    // Provento não tem quantidade; esconde o campo e ajusta o rótulo do valor.
    const qtyGroup = document.getElementById('opQtyGroup');
    if (qtyGroup) qtyGroup.style.display = type === 'income' ? 'none' : '';
    const lblBrl = document.getElementById('lblOpBrl');
    if (lblBrl) lblBrl.textContent = type === 'income' ? 'Valor recebido (R$)' : 'Valor (R$)';

    updateModalTitle();
}

// Alterna buy/sell no toggle deslizante (ativos não-FII).
function toggleOpType() {
    setOpType(currentOpType === 'buy' ? 'sell' : 'buy');
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
        const price = await fetchAssetPrice(asset);
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
    isFii = asset.type === 'FII';
    document.getElementById('assetTitle').textContent = asset.symbol;
    document.getElementById('opModalAsset').textContent = asset.symbol;
    document.getElementById('lblTotalCoins').textContent = 'Total ' + asset.symbol;
    document.getElementById('thQtd').textContent = 'Qtd (' + asset.symbol + ')';
    document.getElementById('opAave').placeholder = assetDecimals > 0 ? '0,' + '0'.repeat(assetDecimals) : '0';

    // FII: habilita proventos — troca o toggle pelo controle segmentado de 3
    // opções e revela as linhas de resumo específicas (proventos / ajustado).
    if (isFii) {
        document.getElementById('opType').style.display = 'none';
        document.getElementById('opTypeSeg').style.display = '';
        document.querySelectorAll('.fii-only').forEach(el => { el.style.display = ''; });
    }

    setActiveView();

    // Editar/Remover linha do histórico (listener delegado)
    document.querySelector('#txTable tbody').addEventListener('click', (e) => {
        const editBtn = e.target.closest('button[data-edit]');
        if (editBtn) {
            editTransaction(Number(editBtn.getAttribute('data-edit')));
            return;
        }
        const dupBtn = e.target.closest('button[data-duplicate]');
        if (dupBtn) {
            duplicateTransaction(Number(dupBtn.getAttribute('data-duplicate')));
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

    // Controle segmentado (FII): cada botão define o tipo diretamente.
    document.querySelectorAll('#opTypeSeg .op-seg-btn').forEach(btn => {
        btn.addEventListener('click', () => setOpType(btn.dataset.type));
    });

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
