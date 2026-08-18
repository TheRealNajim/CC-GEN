/**
 * CC-GEN Page Transition Engine
 * Provides buttery smooth page entry and exit animations across the platform.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Ensure clean state on page load
    document.body.classList.remove('page-leaving');

    // Intercept internal page link clicks for smooth fade-out
    document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');

        // Ignore non-navigation or external links
        if (
            !href ||
            href.startsWith('#') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('javascript:') ||
            link.getAttribute('target') === '_blank' ||
            href.startsWith('http://') ||
            href.startsWith('https://')
        ) {
            return;
        }

        link.addEventListener('click', (e) => {
            // Allow default behavior for modifier clicks (Ctrl+Click, Command+Click, etc.)
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
                return;
            }

            const currentUrl = window.location.pathname.split('/').pop() || 'index.html';
            const targetUrl = href.split('#')[0].split('?')[0];

            // If it's an in-page anchor link on the same page, do not trigger page exit
            if (targetUrl === '' || (targetUrl === currentUrl && href.includes('#'))) {
                return;
            }

            e.preventDefault();
            document.body.classList.add('page-leaving');

            setTimeout(() => {
                window.location.href = href;
            }, 180);
        });
    });
});

// Handle browser back/forward cache restoration (BFCache)
window.addEventListener('pageshow', (event) => {
    document.body.classList.remove('page-leaving');
});
