// scripts/product-detail.js
import { AppState, fetchDataAndSyncState, sendStockUpdate, fetchProductDetailsInBulk } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null;
    let currentProduct = null;
    let swiper = null;

    let stockStateAtModalOpen = {};
    let stockStateInModal = {};
    
    // Variabilă pentru a gestiona apăsarea lungă
    let pressTimer = null;

    const pageElements = {
        title: document.getElementById('product-detail-title'),
        expectedStock: document.getElementById('expected-stock'),
        suggestedCondition: document.getElementById('suggested-condition'),
        totalFound: document.getElementById('total-found'),
        imageWrapper: document.getElementById('product-image-wrapper'),
        stockModal: document.getElementById('stock-modal'),
        openModalButton: document.getElementById('open-stock-modal-button')
    };
    
    function renderStockLevels() {
        const command = AppState.getCommands().find(c => c.id === currentCommandId);
        currentProduct = command ? command.products.find(p => p.id === currentProductId) : null;
        if (!currentProduct) return;

        pageElements.expectedStock.textContent = currentProduct.expected;
        pageElements.suggestedCondition.textContent = currentProduct.suggestedcondition;
        pageElements.totalFound.textContent = currentProduct.found;
        for (const condition in currentProduct.state) {
            document.querySelector(`[data-summary="${condition}"]`).textContent = currentProduct.state[condition];
        }
    }

    async function handleSaveChanges() {
        // ... (această funcție rămâne neschimbată)
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
        
        const success = await sendStockUpdate(currentCommandId, currentProductId, delta);
        hideModal();

        if (success) {
            await fetchDataAndSyncState();
            renderStockLevels();
        } else {
            alert('Eroare la salvare! Vă rugăm încercați din nou.');
        }
    }

    function showModal() {
        // ... (această funcție rămâne neschimbată)
        const command = AppState.getCommands().find(c => c.id === currentCommandId);
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
        // Am înlocuit span-ul cu un input de tip number
        return `
            <div class="flex items-center justify-between py-3 border-b">
                <span class="text-lg font-medium ${isDanger ? 'text-red-600' : 'text-gray-800'}">${label}</span>
                <div class="flex items-center gap-3">
                    <button data-action="minus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold select-none">-</button>
                    <input type="number" id="count-${id}" value="${value}" class="text-xl font-bold w-16 text-center border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50">
                    <button data-action="plus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold select-none">+</button>
                </div>
            </div>`;
    }
    
    // Funcție pentru a actualiza valoarea în UI și în starea internă
    function updateValue(target, newValue) {
        newValue = Math.max(0, parseInt(newValue, 10) || 0); // Asigură-te că valoarea e un număr pozitiv
        stockStateInModal[target] = newValue;
        document.getElementById(`count-${target}`).value = newValue;
    }

    function addModalEventListeners() {
        // Logica pentru click pe butoane
        pageElements.stockModal.querySelectorAll('.control-btn').forEach(button => {
            const action = button.dataset.action;
            const target = button.dataset.target;
            
            const startPress = (e) => {
                e.preventDefault(); // Previne comportamente nedorite (ex: selectare text)
                
                // Setează un timer care se va declanșa după 3 secunde
                pressTimer = setTimeout(() => {
                    if (action === 'minus') {
                        updateValue(target, 0);
                    } else if (action === 'plus') {
                        updateValue(target, currentProduct.expected);
                    }
                }, 3000); // 3000 milisecunde = 3 secunde
            };
            
            const endPress = (e) => {
                e.preventDefault();
                // Anulează timer-ul dacă butonul este eliberat înainte de 3 secunde
                clearTimeout(pressTimer);
            };
            
            const shortClick = (e) => {
                 e.preventDefault();
                // Execută un click normal dacă a fost o apăsare scurtă
                if (action === 'plus') {
                    updateValue(target, stockStateInModal[target] + 1);
                } else if (action === 'minus') {
                    updateValue(target, stockStateInModal[target] - 1);
                }
            };

            // Adaugă event listener-e pentru mouse și touch
            button.addEventListener('mousedown', startPress);
            button.addEventListener('mouseup', endPress);
            button.addEventListener('mouseleave', endPress);
            button.addEventListener('touchstart', startPress);
            button.addEventListener('touchend', endPress);
            button.addEventListener('click', shortClick);
        });
        
        // Logica pentru modificarea manuală a input-ului
        pageElements.stockModal.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', () => {
                const target = input.id.replace('count-', '');
                updateValue(target, input.value);
            });
        });
        
        pageElements.stockModal.querySelector('#save-btn').addEventListener('click', handleSaveChanges);
        pageElements.stockModal.querySelector('#close-modal-btn').addEventListener('click', hideModal);
    }
    
    async function initializePage() {
        // ... (restul funcției rămâne neschimbată)
        currentCommandId = sessionStorage.getItem('currentCommandId');
        currentProductId = sessionStorage.getItem('currentProductId');
        if (!currentCommandId || !currentProductId) {
            window.location.href = 'main.html';
            return;
        }

        await fetchDataAndSyncState();
        
        const command = AppState.getCommands().find(c => c.id === currentCommandId);
        currentProduct = command ? command.products.find(p => p.id === currentProductId) : null;
       
        if (!currentProduct) {
            alert('Produsul nu a fost gasit');
            window.location.href = 'products.html';
            return;
        }

        renderStockLevels();
        
        const details = await fetchProductDetailsInBulk([currentProduct.asin]);
        const productDetails = details[currentProduct.asin];
        pageElements.title.textContent = productDetails?.title || 'Nume indisponibil';
        const images = productDetails?.images || [];
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
        
        pageElements.openModalButton.addEventListener('click', showModal);
    }

    initializePage();
});
