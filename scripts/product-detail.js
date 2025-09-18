import { getProductById, updateProductState } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null;
    let currentProduct = null;
    const detailPageState = { 'new': 0, 'very-good': 0, 'good': 0, 'broken': 0 };
    
    // --- Functii principale ---
    function loadProductDetails() {
        const urlParams = new URLSearchParams(window.location.search);
        currentCommandId = urlParams.get('commandId');
        currentProductId = urlParams.get('id');

        if (!currentCommandId || !currentProductId) {
            alert("Lipsesc informații despre comandă sau produs!");
            window.location.href = 'main.html';
            return;
        }
        
        currentProduct = getProductById(currentCommandId, currentProductId);
        
        if (!currentProduct) {
            alert("Produsul nu a fost găsit în această comandă!");
            window.location.href = `products.html?commandId=${currentCommandId}`;
            return;
        }

        document.getElementById('product-detail-title').textContent = currentProduct.name;
        document.getElementById('product-detail-image').style.backgroundImage = `url('${currentProduct.imageUrl}')`;
        document.getElementById('expected-stock').textContent = currentProduct.expected;
        
        // Copiem starea produsului pentru a o putea modifica local
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
        // Apelam noua functie din data.js pentru a salva starea
        updateProductState(currentCommandId, currentProductId, detailPageState);
    }
    
    // --- Logica Modala si de Cautare (ramane in mare parte neschimbata) ---
    // ... codul pentru deschiderea/inchiderea modalelor si a cautarii ...
    // Important: Modificarile sunt in functiile de salvare de mai jos

    const stockModal = document.getElementById('stock-modal');
    const editStockModal = document.getElementById('edit-stock-modal');
    // Asigura-te ca ai si panel-urile definite daca animatiile depind de ele
    const stockModalPanel = stockModal.querySelector('.animate-slide-down'); 
    const editStockModalPanel = editStockModal.querySelector('.animate-slide-down');


    // Exemplu de listener actualizat (trebuie sa implementezi si logica interna a modalelor)
    // Acestea sunt doar exemple, logica din interiorul modalelor trebuie adaptata
    // pentru a modifica `detailPageState` si a apela `updateMainUI` si `saveCurrentProductState`.
    
    // Acest cod este un exemplu si presupune ca ai butoane cu aceste ID-uri
    const confirmStockButton = document.getElementById('confirm-stock-button');
    if(confirmStockButton) {
        confirmStockButton.addEventListener('click', () => {
            // Aici ar trebui sa aduni datele din modal si sa le adaugi la `detailPageState`
            // Exemplu: detailPageState['new'] += modalState['new'];
            updateMainUI();
            saveCurrentProductState();
            // hideModal(stockModal, stockModalPanel);
        });
    }

    const confirmEditStockButton = document.getElementById('confirm-edit-stock-button');
     if(confirmEditStockButton) {
        confirmEditStockButton.addEventListener('click', () => {
            // Aici ar trebui sa suprascrii `detailPageState` cu datele din modalul de editare
            // Exemplu: Object.assign(detailPageState, editModalState);
            updateMainUI();
            saveCurrentProductState();
            // hideModal(editStockModal, editStockModalPanel);
        });
    }

    // --- Initial Load ---
    loadProductDetails();
});
