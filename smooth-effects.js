/**
 * CC-GEN Smooth Effects Engine
 * Handles:
 * 1. Material click ripple animations on interactive elements
 * 2. Smooth anchor scrolling with dynamic header offset
 * 3. Viewport scroll-reveal animations via IntersectionObserver
 * 4. Micro-press tactile feedback
 */

(function () {
    // --- 1. Material Click Ripple Effect ---
    function createRipple(event) {
        const target = event.currentTarget;
        
        // Ensure element has relative positioning and overflow hidden for clipping
        const style = window.getComputedStyle(target);
        if (style.position === 'static') {
            target.style.position = 'relative';
        }
        target.style.overflow = 'hidden';

        const rect = target.getBoundingClientRect();
        const circle = document.createElement('span');
        const diameter = Math.max(rect.width, rect.height) * 2;
        const radius = diameter / 2;

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - rect.left - radius}px`;
        circle.style.top = `${event.clientY - rect.top - radius}px`;
        circle.classList.add('ripple-wave');

        // Choose wave color based on background or theme
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const isPrimary = target.classList.contains('btn-primary') || target.classList.contains('btn-auth-submit') || target.classList.contains('active');
        
        if (isPrimary) {
            circle.style.background = 'rgba(255, 255, 255, 0.45)';
        } else if (isDark) {
            circle.style.background = 'rgba(255, 255, 255, 0.2)';
        } else {
            circle.style.background = 'rgba(235, 0, 27, 0.2)';
        }

        // Remove previous ripples if any
        const existingRipple = target.querySelector('.ripple-wave');
        if (existingRipple) {
            existingRipple.remove();
        }

        target.appendChild(circle);

        setTimeout(() => {
            circle.remove();
        }, 500);
    }

    function initRipples() {
        const selector = `
            button,
            .btn-primary,
            .btn-secondary,
            .btn-link,
            .btn-social,
            .btn-light,
            .btn-white,
            .btn-copy,
            .theme-toggle-btn,
            .mobile-menu-toggle,
            .gallery-filter-btn,
            .category-chip,
            .theme-swatch,
            .faq-question-btn,
            .faq-mini-question,
            .nav-link
        `;

        document.querySelectorAll(selector).forEach(el => {
            el.removeEventListener('click', createRipple);
            el.addEventListener('click', createRipple);
        });
    }

    // --- 2. Smooth In-Page Anchor Scrolling ---
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#' || targetId === '') return;

                const targetEl = document.querySelector(targetId);
                if (targetEl) {
                    e.preventDefault();
                    const headerOffset = 90;
                    const elementPosition = targetEl.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });

                    // Close mobile nav drawer if open
                    const mainNav = document.getElementById('main-navigation');
                    if (mainNav && mainNav.classList.contains('mobile-open')) {
                        mainNav.classList.remove('mobile-open');
                    }
                }
            });
        });
    }

    // --- 3. Viewport Scroll-Reveal Observer ---
    function initScrollReveals() {
        const revealTargets = document.querySelectorAll(`
            .hero-left-column,
            .hero-right-column,
            .hero-visual-card,
            .studio-customizer-box,
            .card-3d-wrapper,
            .stat-item,
            .doc-portal-card,
            .gallery-card-item,
            .faq-item,
            .faq-mini-item,
            .auth-card-wrapper,
            .auth-showcase-col,
            .support-cta-box,
            .cta-box,
            .table-wrapper,
            .disclaimer-card
        `);

        revealTargets.forEach(el => {
            el.classList.add('scroll-reveal');
        });

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries, obs) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('revealed');
                        obs.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -40px 0px'
            });

            revealTargets.forEach(el => observer.observe(el));
        } else {
            // Fallback for older browsers
            revealTargets.forEach(el => el.classList.add('revealed'));
        }
    }

    // Initialize all smooth interactions on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        initRipples();
        initSmoothScroll();
        initScrollReveals();
    });

    // Re-bind when dynamic DOM updates occur
    window.refreshSmoothEffects = function () {
        initRipples();
        initScrollReveals();
    };
})();
