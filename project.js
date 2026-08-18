/**
 * CC-GEN FAQ & Help Center Interactivity
 * Handles Accordion toggles, real-time live search, and category filtering.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Select DOM elements
    const faqItems = document.querySelectorAll('.faq-item');
    const searchInput = document.getElementById('faq-search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const categoryChips = document.querySelectorAll('.category-chip');
    const resultsCountEl = document.getElementById('faq-results-count');
    const emptyStateEl = document.getElementById('faq-empty-state');
    const mobileToggle = document.getElementById('mobile-toggle');
    const mainNav = document.getElementById('main-navigation');

    let currentCategory = 'all';
    let searchQuery = '';

    // ==========================================
    // 1. Accordion Expand/Collapse Logic
    // ==========================================
    faqItems.forEach(item => {
        const questionBtn = item.querySelector('.faq-question-btn');
        const collapseBody = item.querySelector('.faq-answer-collapse');

        questionBtn.addEventListener('click', () => {
            const isCurrentlyActive = item.classList.contains('active');

            // Optional: Close other open FAQs if single accordion mode desired
            // faqItems.forEach(otherItem => {
            //     if (otherItem !== item && otherItem.classList.contains('active')) {
            //         otherItem.classList.remove('active');
            //         otherItem.querySelector('.faq-answer-collapse').style.maxHeight = null;
            //     }
            // });

            if (isCurrentlyActive) {
                item.classList.remove('active');
                collapseBody.style.maxHeight = null;
            } else {
                item.classList.add('active');
                collapseBody.style.maxHeight = collapseBody.scrollHeight + 'px';
            }
        });
    });

    // ==========================================
    // 2. Filter & Live Search Handler
    // ==========================================
    function filterFaqItems() {
        let visibleCount = 0;
        const normalizedQuery = searchQuery.trim().toLowerCase();

        faqItems.forEach(item => {
            const category = item.getAttribute('data-category') || '';
            const titleText = item.querySelector('.faq-question-title').textContent.toLowerCase();
            const answerText = item.querySelector('.faq-answer-content').textContent.toLowerCase();

            const matchesCategory = (currentCategory === 'all' || category === currentCategory);
            const matchesSearch = normalizedQuery === '' || 
                                  titleText.includes(normalizedQuery) || 
                                  answerText.includes(normalizedQuery);

            if (matchesCategory && matchesSearch) {
                item.style.display = 'block';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        // Update results counter
        if (resultsCountEl) {
            resultsCountEl.textContent = `Showing ${visibleCount} article${visibleCount === 1 ? '' : 's'}`;
        }

        // Show/hide empty state
        if (emptyStateEl) {
            emptyStateEl.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }

    // ==========================================
    // 3. Search Input Event Listeners
    // ==========================================
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            if (searchClearBtn) {
                searchClearBtn.style.display = searchQuery ? 'flex' : 'none';
            }
            filterFaqItems();
        });
    }

    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchQuery = '';
                searchInput.focus();
            }
            searchClearBtn.style.display = 'none';
            filterFaqItems();
        });
    }

    // ==========================================
    // 4. Category Filter Chips
    // ==========================================
    categoryChips.forEach(chip => {
        chip.addEventListener('click', () => {
            categoryChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.getAttribute('data-filter') || 'all';
            filterFaqItems();
        });
    });

    // ==========================================
    // 5. Mobile Navigation Menu Toggle
    // ==========================================
    if (mobileToggle && mainNav) {
        mobileToggle.addEventListener('click', () => {
            mainNav.classList.toggle('mobile-open');
        });
    }

    // Initial filter run
    filterFaqItems();
});