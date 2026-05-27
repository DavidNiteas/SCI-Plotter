/**
 * Toast 通知系统
 * 支持 success / error / warning / info 四种类型
 */

(function() {
    const ICONS = {
        success: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        warning: '<svg viewBox="0 0 24 24"><line x1="12" y1="9" x2="12" y2="13"/><circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none"/></svg>',
        info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none"/><line x1="12" y1="12" x2="12" y2="17"/></svg>',
    };

    const CLOSE_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    let container = null;

    function ensureContainer() {
        if (container && document.body.contains(container)) return container;
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    function show(message, type, duration) {
        type = type || 'info';
        duration = duration || 3000;

        const el = document.createElement('div');
        el.className = 'toast toast--' + type;

        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.innerHTML = ICONS[type] || ICONS.info;

        const msg = document.createElement('span');
        msg.className = 'toast-message';
        msg.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.innerHTML = CLOSE_ICON;
        closeBtn.title = '关闭';

        el.appendChild(icon);
        el.appendChild(msg);
        el.appendChild(closeBtn);

        const box = ensureContainer();
        box.appendChild(el);

        let timer = null;

        function dismiss() {
            if (timer) clearTimeout(timer);
            el.classList.add('toast-out');
            el.addEventListener('animationend', () => {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, { once: true });
        }

        closeBtn.addEventListener('click', dismiss);

        timer = setTimeout(dismiss, duration);

        el.addEventListener('mouseenter', () => {
            if (timer) clearTimeout(timer);
        });
        el.addEventListener('mouseleave', () => {
            timer = setTimeout(dismiss, 1500);
        });

        return dismiss;
    }

    function success(message, duration) { return show(message, 'success', duration); }
    function error(message, duration) { return show(message, 'error', duration || 4000); }
    function warning(message, duration) { return show(message, 'warning', duration || 4000); }
    function info(message, duration) { return show(message, 'info', duration); }

    window.Toast = { show, success, error, warning, info };
})();
