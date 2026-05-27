/**
 * 底部 Dock 栏与页面切换
 */

(function() {
    const dockItems = document.querySelectorAll('.dock-item');
    const pages = {
        datamanage: document.getElementById('page-datamanage'),
        workbench: document.getElementById('page-workbench'),
        subfigure: document.getElementById('page-subfigure'),
        mainfigure: document.getElementById('page-mainfigure'),
    };

    function switchPage(pageName) {
        if (AppState.currentPage === pageName) return;
        
        AppState.currentPage = pageName;

        dockItems.forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });

        Object.keys(pages).forEach(key => {
            if (pages[key]) {
                pages[key].classList.toggle('hidden', key !== pageName);
            }
        });

        window.dispatchEvent(new CustomEvent('pagechange', { detail: { page: pageName } }));

        if (pageName === 'mainfigure' && AppState.mainfigure.fabricCanvas) {
            AppState.mainfigure.fabricCanvas.requestRenderAll();
        }
        if (pageName === 'subfigure' && AppState.subfigure.chartInstance) {
            AppState.subfigure.chartInstance.resize();
        }
    }

    dockItems.forEach(item => {
        item.addEventListener('click', () => switchPage(item.dataset.page));
    });

    window.switchPage = switchPage;
})();
