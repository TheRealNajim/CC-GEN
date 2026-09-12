/**
 * CC-GEN Session-Aware Navigation
 * Fetches the current session and swaps the header's Sign In / Register
 * buttons for an account chip (avatar, name, Pro badge) with Sign Out.
 * Loaded on every page that uses the standard site header.
 */

(function () {
    function initialsOf(name) {
        return String(name || 'U')
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w.charAt(0).toUpperCase())
            .join('') || '?';
    }

    function buildAccountChip(user, pro) {
        const chip = document.createElement('a');
        chip.className = 'nav-account-chip';
        chip.href = 'loginsuccessful.html';
        chip.title = 'View your account';

        const avatarHtml = user.avatar
            ? `<span class="nav-account-avatar"><img src="${user.avatar}" alt="" onerror="this.outerHTML='${initialsOf(user.name).replace(/'/g, '')}'"></span>`
            : `<span class="nav-account-avatar">${initialsOf(user.name)}</span>`;

        const proBadge = pro ? '<span class="nav-account-pro">PRO</span>' : '';

        chip.innerHTML = `
            ${avatarHtml}
            <span class="nav-account-name">${user.name || 'Account'}</span>
            ${proBadge}
        `;
        return chip;
    }

    function buildSignOutLink() {
        const link = document.createElement('a');
        link.className = 'nav-signout-link';
        link.href = '/api/auth/logout';
        link.textContent = 'Sign Out';
        return link;
    }

    function applyToAuthContainer(container, user, pro) {
        if (!container) return;
        container.innerHTML = '';
        container.appendChild(buildAccountChip(user, pro));
        container.appendChild(buildSignOutLink());
    }

    function renderSignedInNav(data) {
        const user = data.user;
        const pro = Boolean(data.pro);

        // Desktop header actions + mobile nav auth block (standard header markup)
        document.querySelectorAll('.desktop-auth-actions, .mobile-nav-auth').forEach((container) => {
            applyToAuthContainer(container, user, pro);
        });
    }

    function init() {
        fetch('/api/auth/session', { credentials: 'same-origin' })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data && data.authenticated && data.user) {
                    renderSignedInNav(data);
                }
                // Signed out: leave the default Sign In / Register links untouched.
            })
            .catch(() => {
                // Network failure: keep the default links so the site stays usable.
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
