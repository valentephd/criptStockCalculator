// Formatação/parse compartilhados (usados no painel do ativo e na lista de ativos).

// Formata um número com N casas fixas em pt-BR (milhar "." e vírgula decimal).
function formatAmount(num, decimals) {
    return Number(num).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

// Formata o preço da cotação (2 a 8 casas) em pt-BR.
function formatPrice(value) {
    return Number(value).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8
    });
}

// Preço unitário em R$ com casas variáveis (2 a 8): mantém 2 casas nos valores
// "redondos" e expande só o necessário (ex.: provento de R$ 0,083 por cota).
function formatUnitPrice(value) {
    return 'R$ ' + Number(value).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8
    });
}

// Formata uma razão (0,017) como porcentagem pt-BR (ex.: "1,70%").
function formatPct(ratio) {
    return (Number(ratio) * 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + '%';
}

// Lê o preço aceitando pt-BR ("1.234,56") ou número cru ("1234.56").
function parsePrice(str) {
    str = String(str).trim();
    if (str.indexOf(',') >= 0) {
        return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return parseFloat(str) || 0;
}
