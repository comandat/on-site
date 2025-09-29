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

        // --- ADAUGAT PENTRU DIAGNOSTICARE ---
        console.log("Produsul curent la momentul salvării:", currentProduct);
        const productAsinForPrinting = currentProduct.asin;
        console.log("ASIN capturat pentru printare:", productAsinForPrinting);
        // --- FINAL DIAGNOSTICARE ---

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

        const success = await sendStockUpdate(currentCommandId, productAsinForPrinting, delta);
        
        if (success) {
            await fetchDataAndSyncState();
            renderPageContent();

            // --- ADAUGAT PENTRU DIAGNOSTICARE ---
            console.log("Creare coadă de printare folosind ASIN:", productAsinForPrinting);
            // --- FINAL DIAGNOSTICARE ---

            const conditionMap = { 'new': 'CN', 'very-good': 'FB', 'good': 'B' };
            const queue = [];
            for (const condition in delta) {
                if (delta[condition] > 0 && conditionMap[condition]) {
                    for (let i = 0; i < delta[condition]; i++) {
                        queue.push({ code: productAsinForPrinting, conditionLabel: conditionMap[condition] });
                    }
                }
            }
            
            // --- ADAUGAT PENTRU DIAGNOSTICARE ---
            console.log("Coada de printare finală trimisă către serviciu:", queue);
            // --- FINAL DIAGNOSTICARE ---

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
        const modalContent = pageElements.stockModal.querySelector('div');
        if (modalContent) {
            modalContent.classList.replace('animate-slide-down', 'animate-slide-up');
            setTimeout(() => {
                pageElements.stockModal.classList.add('hidden');
                pageElements.stockModal.innerHTML = '';
            }, 300);
        }
    }

    function createCounter(id, label, value, isDanger = false) {
        return `
            <div class="flex items-center justify-between py-3 border-b">
                <span class="text-lg font-medium ${isDanger ? 'text-red-600' : 'text-gray-800'}">${label}</span>
                <div class="flex items-center gap-3">
                    <button data-action="minus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold select-none">-</button>
                    <input type="number" id="count-${id}" value="${value}" class="text-xl font-bold w-16 text-center border-gray-300 rounded-md shadow-sm">
                    <button data-action="plus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold select-none">+</button>
                </div>
            </div>`;
    }

    function updateValue(target, newValue) {
        const cleanValue = Math.max(0, parseInt(newValue, 10) || 0);
        stockStateInModal[target] = cleanValue;
        document.getElementById(`count-${target}`).value = cleanValue;
    }

    function addModalEventListeners() {
        pageElements.stockModal.querySelectorAll('.control-btn').forEach(button => {
            const action = button.dataset.action;
            const target = button.dataset.target;
            clickHandler = () => {
                const currentValue = Number(stockStateInModal[target]) || 0;
                if (action === 'plus') updateValue(target, currentValue + 1);
                else updateValue(target, currentValue - 1);
            };
            const startPress = (e) => {
                e.preventDefault();
                button.removeEventListener('click', clickHandler);
                pressTimer = setTimeout(() => {
                    if (action === 'minus') updateValue(target, 0);
                    else if (action === 'plus') updateValue(target, currentProduct.expected);
                }, 3000);
            };
            const endPress = () => {
                clearTimeout(pressTimer);
                setTimeout(() => button.addEventListener('click', clickHandler), 50);
            };
            button.addEventListener('mousedown', startPress);
            button.addEventListener('mouseup', endPress);
            button.addEventListener('mouseleave', endPress);
            button.addEventListener('touchstart', startPress, { passive: false });
            button.addEventListener('touchend', endPress);
            button.addEventListener('click', clickHandler);
        });
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
        currentCommandId = sessionStorage.getItem('currentCommandId');
        currentProductId = sessionStorage.getItem('currentProductId');
        if (!currentCommandId || !currentProductId) {
            window.location.href = 'main.html';
            return;
        }
        await fetchDataAndSyncState();
        currentProduct = getLatestProductData();
        if (!currentProduct) {
            alert('Produsul nu a fost gasit');
            window.location.href = 'products.html';
            return;
        }
        renderPageContent();
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
        
        pageElements.openModalButton.addEventListener('click', () => {
            if (!isPrinterConnected()) {
                showPrinterModal();
            } else {
                showModal();
            }
        });
    }
    initializePage();
});
