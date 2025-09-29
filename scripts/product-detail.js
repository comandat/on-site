// scripts/product-detail.js
import { AppState, fetchDataAndSyncState, sendStockUpdate, fetchProductDetailsInBulk } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null;
    let currentProduct = null;
    let swiper = null;

    let stockStateAtModalOpen = {};
    let stockStateInModal = {};

    const pageElements = {
        title: document.getElementById('product-detail-title'),
        expectedStock: document.getElementById('expected-stock'),
        totalFound: document.getElementById('total-found'),
        imageWrapper: document.getElementById('product-image-wrapper'),
        stockModal: document.getElementById('stock-modal'),
        openModalButton: document.getElementById('open-stock-modal-button')
    };
    
    // Funcția care randează stocurile
    function renderStockLevels() {
        const commands = AppState.getCommands();
        const command = commands.find(c => c.id === currentCommandId);
        currentProduct = command ? command.products.find(p => p.id === currentProductId) : null;
        if (!currentProduct) return;

        pageElements.expectedStock.textContent = currentProduct.expected;
        pageElements.totalFound.textContent = currentProduct.found;
        for (const condition in currentProduct.state) {
            document.querySelector(`[data-summary="${condition}"]`).textContent = currentProduct.state[condition];
        }
    }

    async function handleSaveChanges() {
        const saveButton = document.getElementById('save-btn');
        saveButton.disabled = true;
        saveButton.textContent = 'Se salvează...';

        const delta = {};
        let hasChanges = false;
        for (const condition in stockStateAtModalOpen) {
            const difference = stockStateInModal[condition] - stockStateAtModalOpen[condition];
            if (difference !== 0) {
                delta[condition] = difference;
                hasChanges = true;
            }
        }

        if (!hasChanges) {
            hideModal();
            return;
        }
        
        // Pasul 1: Trimite la server și AȘTEAPTĂ confirmarea
        const success = await sendStockUpdate(currentCommandId, currentProductId, delta);
        
        hideModal();

        // Pasul 2: DOAR DUPĂ confirmare, cere datele noi
        if (success) {
            await fetchDataAndSyncState();
            renderStockLevels();
        } else {
            alert('Eroare la salvare! Vă rugăm încercați din nou.');
        }
    }

    // ... (restul funcțiilor din product-detail.js: showModal, hideModal, etc. rămân neschimbate)
    // Le includ aici pentru a fi complet.

    function showModal() {
        const commands = AppState.getCommands();
        const command = commands.find(c => c.id === currentCommandId);
        currentProduct = command ? command.products.find(p => p.id === currentProductId) : null;
        if(!currentProduct) return;
        
        stockStateAtModalOpen = { ...currentProduct.state };
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
        const modalContent = pageElements.stockModal.querySelector('div');
        if (modalContent) {
            modalContent.classList.replace('animate-slide-down', 'animate-slide-up');
            setTimeout(() => pageElements.stockModal.classList.add('hidden'), 300);
        }
    }

    function createCounter(id, label, value, isDanger = false) {
        return `
            <div class="flex items-center justify-between py-3 border-b">
                <span class="text-lg font-medium ${isDanger ? 'text-red-600' : 'text-gray-800'}">${label}</span>
                <div class="flex items-center gap-3">
                    <button data-action="minus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold">-</button>
                    <span id="count-${id}" class="text-xl font-bold w-8 text-center">${value}</span>
                    <button data-action="plus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold">+</button>
                </div>
            </div>`;
    }

    function addModalEventListeners() {
        pageElements.stockModal.querySelectorAll('.control-btn').forEach(button => {
            button.addEventListener('click', () => {
                const target = button.dataset.target;
                if (button.dataset.action === 'plus') stockStateInModal[target]++;
                else if (stockStateInModal[target] > 0) stockStateInModal[target]--;
                pageElements.stockModal.querySelector(`#count-${target}`).textContent = stockStateInModal[target];
            });
        });
        pageElements.stockModal.querySelector('#save-btn').addEventListener('click', handleSaveChanges);
        pageElements.stockModal.querySelector('#close-modal-btn').addEventListener('click', hideModal);
    }
    
    async function initializePage() {
        currentCommandId = sessionStorage.getItem('currentCommandId');
        currentProductId = sessionStorage.getItem('currentProductId');
        if (!currentCommandId || !currentProductId) {
            window.location.href = 'main.html';
            return;
        }

        // Prima încărcare a datelor
        await fetchDataAndSyncState();
        
        const commands = AppState.getCommands();
        const command = commands.find(c => c.id === currentCommandId);
        currentProduct = command ? command.products.find(p => p.id === currentProductId) : null;
       
        if (!currentProduct) {
            alert('Produsul nu a fost gasit');
            window.location.href = 'products.html';
            return;
        }

        renderStockLevels();
        // ... (restul inițializării)
        const details = await fetchProductDetailsInBulk([currentProduct.asin]);
        pageElements.title.textContent = details[currentProduct.asin]?.title || 'Nume indisponibil';
        // etc.
        pageElements.openModalButton.addEventListener('click', showModal);
    }

    initializePage();
});
