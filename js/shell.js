// Shell compartilhado por todas as páginas: injeta o menu lateral em #app e liga
// navegação, backup/restore, toggle do menu e a cotação contextual.
// Deve ser carregado APÓS config.js, assets.js e storage.js, e ANTES da lógica
// específica da página (ex.: asset-page.js).
(function () {
    const app = document.getElementById('app');
    if (!app) return;

    const page = document.body.dataset.page || '';
    const isAssetPage = page === 'asset';

    // Na página de ativo, descobre o ativo da rota para rotular a cotação.
    let routeAsset = null;
    if (isAssetPage) {
        const id = Number(new URLSearchParams(location.search).get('id'));
        routeAsset = getAssetById(id);
    }
    const cotacaoLabel = routeAsset
        ? 'Cotação Atual ' + routeAsset.symbol + ' (R$)'
        : 'Cotação Atual (R$)';

    // Monta e injeta o menu como primeiro filho de #app.
    const aside = document.createElement('aside');
    aside.className = 'sidebar';
    aside.innerHTML =
        '<div class="sidebar-inner">' +
            '<h2 class="sidebar-title">Menu</h2>' +
            '<nav class="sidebar-nav">' +
                '<a href="index.html" class="nav-link" data-nav="home">Início</a>' +
                '<a href="assets.html" class="nav-link" data-nav="assets">Cadastro de Ativos</a>' +
                '<a href="config.html" class="nav-link" data-nav="config">Configurações do Sistema</a>' +
                '<a href="backup.html" class="nav-link" data-nav="backup">Backup</a>' +
                '<a href="restore.html" class="nav-link" data-nav="restore">Restaurar</a>' +
            '</nav>' +
            '<div class="sidebar-section sidebar-bottom" id="cotacaoBlock"' + (isAssetPage ? '' : ' style="display:none;"') + '>' +
                '<h3 id="cotacaoLabel">' + cotacaoLabel + '</h3>' +
                '<div class="price-box">' +
                    '<input type="number" id="currentPriceInput" step="0.01" value="0">' +
                    '<button id="btnRefreshPrice" class="btn-secondary">Atualizar Preço</button>' +
                    '<span id="priceStatus" class="price-status">—</span>' +
                '</div>' +
            '</div>' +
        '</div>';
    app.insertBefore(aside, app.firstChild);

    // Realça o item de navegação da página atual.
    const activeNav = aside.querySelector('.nav-link[data-nav="' + page + '"]');
    if (activeNav) activeNav.classList.add('active');

    // Toggle do menu (o botão fica no header de cada página) + estado persistido.
    const toggleBtn = document.getElementById('btnMenuToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const expanded = !app.classList.contains('menu-open');
            app.classList.toggle('menu-open', expanded);
            setConfig('menuExpanded', expanded);
        });
    }
    app.classList.toggle('menu-open', getConfig('menuExpanded', false));
})();
