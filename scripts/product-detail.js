// scripts/product-detail.js
import { AppState, syncStateWithServer, sendStockUpdate, fetchProductDetailsInBulk } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null;
    let currentProduct = null;
    let swiper = null;

    // Aici vom stoca o "fotografie" a stării exact la deschiderea ferestrei
    let stockStateAtModalOpen = {};
    // Starea pe care o modifici în fereastră
    let stockStateInModal = {};

    const pageElements = {
        title: document.getElementById('product-detail-title'),
        expectedStock: document.getElementById('expected-stock'),
        totalFound: document.getElementById('total-found'),
        imageWrapper: document.getElementById('product-image-wrapper'),
        stockModal: document.getElementById('stock-modal'),
        openModalButton: document.getElementById('open-stock-modal-button')
    };

    async function renderProductShell() {
        const details = await fetchProductDetailsInBulk([currentProduct.asin]);
        const productDetails = details[currentProduct.asin];

        pageElements.title.textContent = productDetails.title || 'Nume indisponibil';
        
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

    function renderStockLevels() {
        currentProduct = AppState.getProductById(currentCommandId, currentProductId);
        if (!currentProduct) return;

        pageElements.expectedStock.textContent = currentProduct.expected;
        let totalFound = 0;
        for (const condition in currentProduct.state) {
            const count = currentProduct.state[condition];
            document.querySelector(`[data-summary="${condition}"]`).textContent = count;
            totalFound += count;
        }
        pageElements.totalFound.textContent = totalFound;
    }

    async function handleSaveChanges() {
        // Logica de calcul a fost refăcută aici
        const newState = stockStateInModal;
        const delta = {};
        let hasChanges = false;

        // 1. Calculăm delta (diferența) comparând cu starea de la deschiderea ferestrei
        for (const condition in stockStateAtModalOpen) {
            const difference = newState[condition] - stockStateAtModalOpen[condition];
            if (difference !== 0) {
                delta[condition] = difference;
                hasChanges = true;
            }
        }

        if (!hasChanges) {
            hideModal();
            return;
        }

        // 2. Calculăm starea finală corectă pentru actualizarea optimistă
        const finalState = { ...currentProduct.state };
        for(const condition in delta){
            finalState[condition] = (finalState[condition] || 0) + delta[condition];
        }

        // 3. Actualizare optimistă a UI-ului
        AppState.updateProductState(currentCommandId, currentProductId, finalState);
        renderStockLevels();
        hideModal();

        // 4. Trimite la server în fundal
        const success = await sendStockUpdate(currentCommandId, currentProduct.asin, delta);

        if (!success) {
            alert('Eroare de server! Modificarea a fost anulată. Se reîncarcă starea corectă.');
            // Dacă serverul eșuează, forțăm o resincronizare completă pentru a preveni coruperea datelor
            await syncStateWithServer();
            renderStockLevels();
        }
    }

    // --- Logica pentru Modala de Stoc ---

    function showModal() {
        // Facem o "poză" stocului LIVE exact când deschidem fereastra
        stockStateAtModalOpen = { ...currentProduct.state };
        // Creăm o copie separată pentru a o modifica
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
    
    async function initializePage() {
        currentCommandId = sessionStorage.getItem('currentCommandId');
        currentProductId = sessionStorage.getItem('currentProductId');
        if (!currentCommandId || !currentProductId) {
            alert("Eroare: Lipsesc ID-ul comenzii sau al produsului.");
            window.location.href = 'main.html';
            return;
        }

        await syncStateWithServer();

        currentProduct = AppState.getProductById(currentCommandId, currentProductId);
        if (!currentProduct) {
            alert("Eroare: Produsul nu a fost găsit.");
            window.location.href = 'products.html';
            return;
        }

        renderStockLevels();
        renderProductShell();

        pageElements.openModalButton.addEventListener('click', showModal);
        pageElements.stockModal.addEventListener('click', (e) => e.target === pageElements.stockModal && hideModal());
    }

    initializePage();
});
