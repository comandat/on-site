// scripts/product-detail.js
import { AppState, syncStateWithServer, sendStockUpdate, fetchProductDetailsInBulk } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null;
    let currentProduct = null;
    let swiper = null;

    // Stocăm starea din modal separat pentru a calcula diferența la salvare
    let stockStateInModal = {};

    const pageElements = {
        title: document.getElementById('product-detail-title'),
        expectedStock: document.getElementById('expected-stock'),
        totalFound: document.getElementById('total-found'),
        imageWrapper: document.getElementById('product-image-wrapper'),
        stockModal: document.getElementById('stock-modal'),
        openModalButton: document.getElementById('open-stock-modal-button')
    };

    /**
     * Afișează detaliile produsului (nume, imagini). Rulează o singură dată.
     */
    async function renderProductShell() {
        const details = await fetchProductDetailsInBulk([currentProduct.asin]);
        const productDetails = details[currentProduct.asin];

        pageElements.title.textContent = productDetails.title || 'Nume indisponibil';
        
        // Setup Swiper/Gallery
        const images = productDetails.images || [];
        pageElements.imageWrapper.innerHTML = '';
        if (images.length === 0) {
            pageElements.imageWrapper.innerHTML = `<div class="swiper-slide bg-gray-200 flex items-center justify-center"><span class="material-symbols-outlined text-gray-400 text-6xl">hide_image</span></div>`;
        } else {
            images.forEach(imageUrl => {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                slide.style.backgroundImage = `url('${imageUrl}')`;
                pageElements.imageWrapper.appendChild(slide);
            });
        }
        if (swiper) swiper.update();
        else swiper = new Swiper('#image-swiper-container', { pagination: { el: '.swiper-pagination' } });
    }

    /**
     * Afișează stocurile. Poate fi chemată de mai multe ori pentru a reîmprospăta UI-ul.
     */
    function renderStockLevels() {
        // Preluăm cea mai recentă versiune a produsului din starea centralizată
        currentProduct = AppState.getProductById(currentCommandId, currentProductId);
        if (!currentProduct) return; // Produsul a fost cumva eliminat

        pageElements.expectedStock.textContent = currentProduct.expected;

        let totalFound = 0;
        for (const condition in currentProduct.state) {
            const count = currentProduct.state[condition];
            document.querySelector(`[data-summary="${condition}"]`).textContent = count;
            totalFound += count;
        }
        pageElements.totalFound.textContent = totalFound;
    }

    /**
     * Logica pentru salvarea modificărilor din modal.
     */
    async function handleSaveChanges() {
        const originalState = currentProduct.state;
        const newState = stockStateInModal;
        const delta = {};
        let hasChanges = false;

        // 1. Calculăm delta (diferența)
        for (const condition in originalState) {
            const difference = newState[condition] - originalState[condition];
            if (difference !== 0) {
                delta[condition] = difference;
                hasChanges = true;
            }
        }

        if (!hasChanges) {
            hideModal();
            return;
        }

        // 2. Actualizare optimistă a UI-ului
        AppState.updateProductState(currentCommandId, currentProductId, newState);
        renderStockLevels(); // Re-afișează stocurile instantaneu
        hideModal();

        // 3. Trimite la server în fundal
        const success = await sendStockUpdate(currentCommandId, currentProduct.asin, delta);

        // 4. Dacă serverul a eșuat, anulăm modificarea și notificăm utilizatorul
        if (!success) {
            alert('Eroare de server! Modificarea a fost anulată. Vă rugăm încercați din nou.');
            // Anulează modificarea (revert)
            AppState.updateProductState(currentCommandId, currentProductId, originalState);
            renderStockLevels(); // Re-afișează starea corectă
        }
    }

    // --- Logica pentru Modala de Stoc ---

    function showModal() {
        // Creăm o copie a stării curente pentru a o putea modifica în siguranță
        stockStateInModal = { ...currentProduct.state };
        pageElements.stockModal.innerHTML = `
            <div class="absolute bottom-0 w-full max-w-md mx-auto left-0 right-0 bg-white rounded-t-2xl shadow-lg p-4 animate-slide-down">
                <h3 class="text-xl font-bold text-center mb-4">Adaugă / Modifică Stoc</h3>
                ${createCounter('new', 'Ca Nou', stockStateInModal['new'])}
                ${createCounter('very-good', 'Foarte Bun', stockStateInModal['very-good'])}
                ${createCounter('good', 'Bun', stockStateInModal['good'])}
                ${createCounter('broken', 'Defect', stockStateInModal['broken'], true)}
                <div class="flex gap-3 mt-6">
                    <button id="close-modal-btn" class="w-1/2 rounded-lg bg-gray-200 py-3 font-bold text-gray-700">Anulează</button>
                    <button id="save-btn" class="w-1/2 rounded-lg bg-[var(--primary-color)] py-3 font-bold text-white">Salvează</button>
                </div>
            </div>`;
        addModalEventListeners();
        pageElements.stockModal.classList.remove('hidden');
    }
    
    function hideModal() {
        const modalContent = pageElements.stockModal.querySelector('div.animate-slide-down, div.animate-slide-up');
        if (modalContent) {
            modalContent.classList.remove('animate-slide-down');
            modalContent.classList.add('animate-slide-up');
            setTimeout(() => pageElements.stockModal.classList.add('hidden'), 300);
        }
    }

    function createCounter(id, label, value, isDanger = false) {
        const colorClass = isDanger ? 'text-red-600' : 'text-gray-800';
        return `
            <div class="flex items-center justify-between py-3 border-b">
                <span class="text-lg font-medium ${colorClass}">${label}</span>
                <div class="flex items-center gap-3">
                    <button data-action="minus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold">-</button>
                    <span id="count-${id}" class="text-xl font-bold w-8 text-center">${value}</span>
                    <button data-action="plus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold">+</button>
                </div>
            </div>`;
    }

    function addModalEventListeners() {
        document.querySelectorAll('.control-btn').forEach(button => {
            button.addEventListener('click', () => {
                const target = button.dataset.target;
                if (button.dataset.action === 'plus') {
                    stockStateInModal[target]++;
                } else if (stockStateInModal[target] > 0) {
                    stockStateInModal[target]--;
                }
                document.getElementById(`count-${target}`).textContent = stockStateInModal[target];
            });
        });
        document.getElementById('save-btn').addEventListener('click', handleSaveChanges);
        document.getElementById('close-modal-btn').addEventListener('click', hideModal);
    }
    
    /**
     * Funcția de inițializare a paginii
     */
    async function initializePage() {
        currentCommandId = sessionStorage.getItem('currentCommandId');
        currentProductId = sessionStorage.getItem('currentProductId');
        if (!currentCommandId || !currentProductId) {
            alert("Eroare: Lipsesc ID-ul comenzii sau al produsului.");
            window.location.href = 'main.html';
            return;
        }

        // Sincronizăm datele cu serverul LA FIECARE INTRARE PE PAGINĂ
        // pentru a fi siguri că avem cea mai nouă stare.
        await syncStateWithServer();

        currentProduct = AppState.getProductById(currentCommandId, currentProductId);
        if (!currentProduct) {
            alert("Eroare: Produsul nu a fost găsit în starea curentă a aplicației.");
            window.location.href = 'products.html';
            return;
        }

        renderStockLevels();
        renderProductShell();

        // Adaugă event listenere la elementele principale
        pageElements.openModalButton.addEventListener('click', showModal);
        pageElements.stockModal.addEventListener('click', (e) => e.target === pageElements.stockModal && hideModal());
    }

    initializePage();
});
