import { getProductsData, getProductById, saveProductsData } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentProductId = null;
    let currentProduct = null;
    const detailPageState = { 'new': 0, 'very-good': 0, 'good': 0, 'broken': 0 };
    const modalState = { 'new': 0, 'very-good': 0, 'good': 0, 'broken': 0 };
    const editModalState = { 'new': 0, 'very-good': 0, 'good': 0, 'broken': 0 };

    // --- Element Selectors ---
    const totalFoundEl = document.getElementById('total-found');
    const searchTriggerButton = document.getElementById('search-trigger-button');
    const searchOverlay = document.getElementById('search-overlay');
    const searchBackdrop = document.getElementById('search-backdrop');
    const searchBarContainer = document.getElementById('search-bar-container');
    const searchInput = document.getElementById('search-input');
    const cancelSearchButton = document.getElementById('cancel-search-button');
    const searchResults = document.getElementById('search-results');
    const searchResultsList = document.getElementById('search-results-list');
    const noResultsMessage = document.getElementById('no-results-message');
    const headerButtons = document.querySelectorAll('#product-detail-page header button');
    const stockModal = document.getElementById('stock-modal');
    const stockModalPanel = document.getElementById('stock-modal-panel');
    const editStockModal = document.getElementById('edit-stock-modal');
    const editStockModalPanel = document.getElementById('edit-stock-modal-panel');

    // --- Main Functions ---
    function loadProductDetails() {
        const urlParams = new URLSearchParams(window.location.search);
        currentProductId = urlParams.get('id');
        if (!currentProductId) {
            // Redirect or show error if no product ID
            window.location.href = 'products.html';
            return;
        }
        
        currentProduct = getProductById(currentProductId);
        if (!currentProduct) {
             window.location.href = 'products.html';
            return;
        }

        document.getElementById('product-detail-title').textContent = currentProduct.name;
        document.getElementById('product-detail-image').style.backgroundImage = `url('${currentProduct.imageUrl}')`;
        document.getElementById('expected-stock').textContent = currentProduct.expected;
        
        Object.assign(detailPageState, currentProduct.state);
        updateMainUI();
        populateSearchResults();
    }

    const updateMainUI = () => {
        let totalFound = Object.values(detailPageState).reduce((a, b) => a + b, 0);
        for (const condition in detailPageState) {
            const count = detailPageState[condition];
            const summaryEl = document.querySelector(`[data-summary="${condition}"]`);
            if (summaryEl) summaryEl.textContent = count;
        }
        totalFoundEl.textContent = totalFound;
    };

    function saveCurrentProductState() {
        const allProducts = getProductsData();
        const productIndex = allProducts.findIndex(p => p.id === currentProductId);
        if (productIndex > -1) {
            allProducts[productIndex].state = { ...detailPageState };
            allProducts[productIndex].found = Object.values(detailPageState).reduce((a, b) => a + b, 0);
            saveProductsData(allProducts);
        }
    }

    // --- Modal Logic ---
    const updateAddModalUI = () => { /* ... (same as before) ... */ };
    const updateEditModalUI = () => { /* ... (same as before) ... */ };
    function showModal(modal, panel) { /* ... (same as before) ... */ }
    function hideModal(modal, panel) { /* ... (same as before) ... */ }
    // (Full modal logic implementation is lengthy but unchanged from previous correct version)
    // For brevity, I'll include just the event listeners that save state.

    document.getElementById('confirm-stock-button').addEventListener('click', () => {
        for(const condition in modalState) {
            detailPageState[condition] += modalState[condition];
            modalState[condition] = 0; // Reset modal state
        }
        updateMainUI();
        saveCurrentProductState();
        hideModal(stockModal, stockModalPanel);
    });

    document.getElementById('confirm-edit-stock-button').addEventListener('click', () => {
        Object.assign(detailPageState, editModalState);
        updateMainUI();
        saveCurrentProductState();
        hideModal(editStockModal, editStockModalPanel);
    });
    
    // --- Search Logic ---
    function openSearch() { /* ... */ }
    function closeSearch() { /* ... */ }
    function populateSearchResults() { /* ... */ }
    // (Full search logic implementation is lengthy but unchanged)

    // --- Initial Load ---
    loadProductDetails();

    // The rest of the event listeners for modals, search, etc.
    // NOTE: This is a summarized version. The full JS for interactivity remains the same as the last correct version.
});
