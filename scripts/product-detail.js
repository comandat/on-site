// comandat/on-site/on-site-1b65a8316a69f921dd9b05878875f6e2772ab5a4/scripts/product-detail.js

// Pas 1: Importam TOATE functiile necesare, inclusiv fetchProductDetails
import { getProductById, updateProductState, fetchProductDetails } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null;
    let currentProduct = null;
    // Starea initiala a contorului de stoc din pagina de detaliu
    const detailPageState = { 'new': 0, 'very-good': 0, 'good': 0, 'broken': 0 };
    
    // --- Functii principale ---
    async function loadProductDetails() {
        currentCommandId = sessionStorage.getItem('currentCommandId');
        currentProductId = sessionStorage.getItem('currentProductId');

        if (!currentCommandId || !currentProductId) {
            alert("Lipsesc informații despre comandă sau produs!");
            window.location.href = 'main.html';
            return;
        }
        
        // Preluam datele salvate local (stoc, cantitati)
        currentProduct = getProductById(currentCommandId, currentProductId);
        
        if (!currentProduct) {
            alert("Produsul nu a fost găsit în această comandă!");
            window.location.href = `products.html`;
            return;
        }
        
        // Preluam detaliile proaspete de la server (titlu, imagine) folosind ASIN-ul
        const freshDetails = await fetchProductDetails(currentProduct.asin);
        
        // Actualizam interfata cu datele corecte
        document.getElementById('product-detail-title').textContent = freshDetails.title || 'Detaliile nu au putut fi încărcate';
        document.getElementById('product-detail-image').style.backgroundImage = `url('${freshDetails.images?.[0] || ''}')`;
        document.getElementById('expected-stock').textContent = currentProduct.expected;
        
        // Sincronizam starea paginii cu starea salvata a produsului
        Object.assign(detailPageState, currentProduct.state);
        updateMainUI();
    }

    // Functie pentru a actualiza Sumarul de Stoc de pe pagina
    const updateMainUI = () => {
        let totalFound = Object.values(detailPageState).reduce((a, b) => a + b, 0);
        for (const condition in detailPageState) {
            const count = detailPageState[condition];
            const summaryEl = document.querySelector(`[data-summary="${condition}"]`);
            if (summaryEl) summaryEl.textContent = count;
        }
        document.getElementById('total-found').textContent = totalFound;
    };

    // Functie pentru a salva starea curenta in memoria browser-ului
    function saveCurrentProductState() {
        updateProductState(currentCommandId, currentProductId, detailPageState);
    }
    
    // Aici ar veni restul codului pentru modale si butoane, care ramane neschimbat...
    
    // --- Initializare ---
    loadProductDetails();
});
