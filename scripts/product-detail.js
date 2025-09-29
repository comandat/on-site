// scripts/product-detail.js
import { AppState, fetchDataAndSyncState, sendStockUpdate, fetchProductDetailsInBulk } from './data.js';
import { isPrinterConnected, connectToPrinter, printLabelQueue } from './printer-service.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null; // Acesta este productsku
    let currentProduct = null;   // Acesta conține toate detaliile, inclusiv .asin
    let swiper = null;

    let stockStateAtModalOpen = {};
    let stockStateInModal = {};
    let pressTimer = null;
    let clickHandler = null;

    const pageElements = {
        title: document.getElementById('product-detail-title'),
        expectedStock: document.getElementById('expected-stock'),
        suggestedCondition: document.getElementById('suggested-condition'),
        totalFound: document.getElementById('total-found'),
        imageWrapper: document.getElementById('product-image-wrapper'),
        stockModal: document.getElementById('stock-modal'),
        printerModal: document.getElementById('printer-modal'),
        openModalButton: document.getElementById('open-stock-modal-button')
    };

    function showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, duration);
    }

    function getLatestProductData() {
        const command = AppState.getCommands().find(c => c.id === currentCommandId);
        return command ? command.products.find(p => p.id === currentProductId) : null;
    }

    function renderPageContent() {
        currentProduct = getLatestProductData();
        if (!currentProduct) return;
        pageElements.expectedStock.textContent = currentProduct.expected;
        pageElements.suggestedCondition.textContent = currentProduct.suggestedcondition;
        pageElements.totalFound.textContent = currentProduct.found;
        for (const condition in currentProduct.state) {
            const element = document.querySelector(`[data-summary="${condition}"]`);
            if (element) element.textContent = currentProduct.state[condition];
        }
    }

    async function handleSaveChanges() {
        const saveButton = document.getElementById('save-btn');
        saveButton.disabled = true;
        saveButton.textContent = 'Se salvează...';

        const delta = {};
        let hasChanges = false;
        for (const condition in stockStateAtModalOpen) {
            const before = Number(stockStateAtModalOpen[condition]) || 0;
            const after = Number(stockStateInModal[condition]) || 0;
            const difference = after - before;
            if (difference !== 0) {
                delta[condition] = difference;
                hasChanges = true;
            }
        }

        if (!hasChanges) {
            hideModal();
            return;
        }

        const success = await sendStockUpdate(currentCommandId, currentProduct.asin, delta);
        
        if (success) {
            await fetchDataAndSyncState();
            renderPageContent();

            const conditionMap = { 'new': 'CN', 'very-good': 'FB', 'good': 'B' };
            const queue = [];
            for (const condition in delta) {
                if (delta[condition] > 0 && conditionMap[condition]) {
                    for (let i = 0; i < delta[condition]; i++) {
                        queue.push({ code: currentProduct.asin, conditionLabel: conditionMap[condition] });
                    }
                }
            }
            
            hideModal();

            if (queue.length > 0) {
                await printLabelQueue(queue, (status) => showToast(status, 4000));
            }

        } else {
            alert('Eroare la salvare! Vă rugăm încercați din nou.');
            saveButton.disabled = false;
            saveButton.textContent = 'Salvează';
        }
    }
    
    function showPrinterModal() {
        pageElements.printerModal.classList.remove('hidden');
        pageElements.printerModal.innerHTML = `
            <div class="absolute bottom-0 w-full max-w-md mx-auto left-0 right-0 bg-white rounded-t-2xl shadow-lg p-4 animate-slide-down">
                <div class="text-center mb-4">
                    <span class="material-symbols-outlined text-6xl text-blue-600">print</span>
                    <h2 id="printer-status" class="text-gray-500 mt-2">Apasă pentru a te conecta</h2>
                </div>
                <div class="mt-6 space-y-3">
                    <button id="connect-btn" class="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-base font-bold text-white shadow-md hover:bg-blue-700">
                        <span class="material-symbols-outlined">bluetooth_searching</span>
                        Caută Imprimantă
                    </button>
                    <button id="close-printer-modal-btn" class="w-full mt-2 rounded-lg bg-gray-200 py-3 font-bold text-gray-700">Anulează</button>
                </div>
            </div>`;

        const connectBtn = document.getElementById('connect-btn');
        const closeBtn = document.getElementById('close-printer-modal-btn');
        const printerStatus = document.getElementById('printer-status');

        const statusCallback = (message) => {
            printerStatus.textContent = message;
            if (isPrinterConnected()) {
                hidePrinterModal();
                showModal();
            }
        };

        connectBtn.addEventListener('click', async () => {
            connectBtn.disabled = true;
            connectBtn.textContent = 'Se conectează...';
            await connectToPrinter(statusCallback);
            connectBtn.disabled = false;
            connectBtn.textContent = 'Caută Imprimantă';
        });
        
        closeBtn.addEventListener('click', hidePrinterModal);
    }

    function hidePrinterModal() {
        const modalContent = pageElements.printerModal.querySelector('div');
        if (modalContent) {
            modalContent.classList.replace('animate-slide-down', 'animate-slide-up');
            setTimeout(() => {
                pageElements.printerModal.classList.add('hidden');
                pageElements.printerModal.innerHTML = '';
            }, 300);
        }
    }

    function showModal() {
        currentProduct = getLatestProductData();
        if (!currentProduct) return;
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
        const modalContent = pageElements.stockModal.querySelector('
