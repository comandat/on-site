import { getProductById, updateProductState } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null;
    let currentProduct = null;
    const detailPageState = { 'new': 0, 'very-good': 0, 'good': 0, 'broken': 0 };
    
    // --- Functii principale ---
    function loadProductDetails() {
        // Preluam ID-urile din sessionStorage
        currentCommandId = sessionStorage.getItem('currentCommandId');
        currentProductId = sessionStorage.getItem('currentProductId');

        if (!currentCommandId || !currentProductId) {
            alert("Lipsesc informații despre comandă sau produs!");
            window.location.href = 'main.html';
            return;
        }
        
        currentProduct = getProductById(currentCommandId, currentProductId);
        
        if (!currentProduct) {
            alert("Produsul nu a fost găsit în această comandă!");
            window.location.href = `products.html`;
            return;
        }

        document.getElementById('product-detail-title').textContent = currentProduct.name;
        document.getElementById('product-detail-image').style.backgroundImage = `url('${currentProduct.imageUrl}')`;
        document.getElementById('expected-stock').textContent = currentProduct.expected;
        
        Object.assign(detailPageState, currentProduct.state);
        updateMainUI();
    }

    const updateMainUI = () => {
        let totalFound = Object.values(detailPageState).reduce((a, b) => a + b, 0);
        for (const condition in detailPageState) {
            const count = detailPageState[condition];
            const summaryEl = document.querySelector(`[data-summary="${condition}"]`);
            if (summaryEl) summaryEl.textContent = count;
        }
        document.getElementById('total-found').textContent = totalFound;
    };

    function saveCurrentProductState() {
        updateProductState(currentCommandId, currentProductId, detailPageState);
    }
    
    // ... restul codului pentru modale si cautare ramane la fel ...
    // Functiile de salvare vor folosi direct `currentCommandId` si `currentProductId`
    
    // --- Initial Load ---
    loadProductDetails();
});
