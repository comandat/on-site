import { getProductById, updateProductState, fetchProductDetails } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null;
    let currentProduct = null;
    let swiper = null;

    const detailPageState = { 'new': 0, 'very-good': 0, 'good': 0, 'broken': 0 };
    // Variabila care va tine minte starea stocului inainte de a deschide fereastra de modificare
    let stockStateBeforeEdit = {};

    // --- Functii pentru Webhook ---
    async function sendStockUpdateToWebhook(commandId, productAsin, stockDelta) {
        const webhookUrl = 'https://automatizare.comandat.ro/webhook/147557e0-e23d-470c-af50-ddc3c724dff8';
        
        const payload = {
            commandId: commandId,
            asin: productAsin,
            ...stockDelta // Trimitem doar diferenta, ex: { new: 1, good: -1 }
        };

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Webhook response was not ok: ${response.statusText}`);
            }
            
            console.log("Webhook update successful:", await response.json());
            return true; // Returneaza succes
        } catch (error) {
            console.error('Failed to send update to webhook:', error);
            alert('Eroare la salvarea datelor pe server. Modificările nu au fost salvate. Vă rugăm încercați din nou.');
            return false; // Returneaza eroare
        }
    }
    
    // --- Functii pentru UI ---
    
    async function loadProductDetails() {
        currentCommandId = sessionStorage.getItem('currentCommandId');
        currentProductId = sessionStorage.getItem('currentProductId');
        if (!currentCommandId || !currentProductId) {
            alert("Lipsesc informații!");
            window.location.href = 'main.html';
            return;
        }
        currentProduct = getProductById(currentCommandId, currentProductId);
        if (!currentProduct) {
            alert("Produsul nu a fost găsit!");
            window.location.href = 'products.html';
            return;
        }
        
        const freshDetails = await fetchProductDetails(currentProduct.asin);
        document.getElementById('product-detail-title').textContent = freshDetails.title || 'Nume indisponibil';
        document.getElementById('expected-stock').textContent = currentProduct.expected;
        setupImageGallery(freshDetails.images || []);
        Object.assign(detailPageState, currentProduct.state);
        updateMainUI();
    }

    function setupImageGallery(images) {
        const wrapper = document.getElementById('product-image-wrapper');
        wrapper.innerHTML = '';
        if (images.length === 0) {
            wrapper.innerHTML = `<div class="swiper-slide bg-gray-200 flex items-center justify-center"><span class="material-symbols-outlined text-gray-400 text-6xl">hide_image</span></div>`;
        } else {
            images.forEach(imageUrl => {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                slide.style.backgroundImage = `url('${imageUrl}')`;
                wrapper.appendChild(slide);
            });
        }
        if (swiper) {
            swiper.update();
        } else {
            swiper = new Swiper('#image-swiper-container', {
                loop: false,
                pagination: { el: '.swiper-pagination', clickable: true },
            });
        }
    }

    const updateMainUI = () => {
        let totalFound = Object.values(detailPageState).reduce((a, b) => a + b, 0);
        for (const condition in detailPageState) {
            const count = detailPageState[condition];
            document.querySelector(`[data-summary="${condition}"]`).textContent = count;
        }
        document.getElementById('total-found').textContent = totalFound;
    };

    function saveCurrentProductState() {
        updateProductState(currentCommandId, currentProductId, detailPageState);
        updateMainUI();
    }

    // --- Logica pentru Modala "Adauga in Stoc" ---
    
    const stockModal = document.getElementById('stock-modal');
    
    function createStockModal() {
        stockModal.innerHTML = `
            <div class="absolute bottom-0 w-full max-w-md mx-auto left-0 right-0 bg-white rounded-t-2xl shadow-lg p-4 animate-slide-down">
                <h3 class="text-xl font-bold text-center mb-4">Adaugă în Stoc</h3>
                ${createCounter('new', 'Ca Nou')}
                ${createCounter('very-good', 'Foarte Bun')}
                ${createCounter('good', 'Bun')}
                ${createCounter('broken', 'Defect', true)}
                <div class="flex gap-3 mt-6">
                    <button id="close-modal-btn" class="w-1/2 rounded-lg bg-gray-200 py-3 font-bold text-gray-700">Anulează</button>
                    <button id="save-and-print-btn" class="w-1/2 rounded-lg bg-[var(--primary-color)] py-3 font-bold text-white">Salvează și Printează</button>
                </div>
            </div>`;
        addModalEventListeners();
    }
    
    function createCounter(id, label, isDanger = false) {
        const colorClass = isDanger ? 'text-red-600' : 'text-gray-800';
        return `
            <div class="flex items-center justify-between py-3 border-b">
                <span class="text-lg font-medium ${colorClass}">${label}</span>
                <div class="flex items-center gap-3">
                    <button data-action="minus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold">-</button>
                    <span id="count-${id}" class="text-xl font-bold w-8 text-center">${detailPageState[id]}</span>
                    <button data-action="plus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold">+</button>
                </div>
            </div>`;
    }

    function addModalEventListeners() {
        document.querySelectorAll('.control-btn').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                const target = button.dataset.target;
                if (action === 'plus') {
                    detailPageState[target]++;
                } else if (action === 'minus' && detailPageState[target] > 0) {
                    detailPageState[target]--;
                }
                document.getElementById(`count-${target}`).textContent = detailPageState[target];
            });
        });

        document.getElementById('save-and-print-btn').addEventListener('click', async () => {
            const stockStateAfterEdit = detailPageState;
            const stockDelta = {};
            let hasChanges = false;
            const conditions = ['new', 'very-good', 'good', 'broken'];

            for (const condition of conditions) {
                const countBefore = stockStateBeforeEdit[condition] || 0;
                const countAfter = stockStateAfterEdit[condition] || 0;
                const difference = countAfter - countBefore;

                if (difference !== 0) {
                    stockDelta[condition] = difference;
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                const success = await sendStockUpdateToWebhook(currentCommandId, currentProduct.asin, stockDelta);
                if (success) {
                    // Daca serverul a confirmat, salvam si local starea NOUA, COMPLETA
                    saveCurrentProductState();
                    hideModal();
                    
                    // Aici vom adauga logica de printare doar pentru diferentele pozitive
                    const labelsToPrint = {};
                    for(const condition in stockDelta){
                        if(stockDelta[condition] > 0){
                            labelsToPrint[condition] = stockDelta[condition];
                        }
                    }
                    if (Object.keys(labelsToPrint).length > 0) {
                        console.log("TODO: Implement printing for these labels:", labelsToPrint);
                        // triggerPrintingProcess(labelsToPrint);
                    }
                }
                // Daca nu e succes, alerta este afisata in functia `sendStockUpdateToWebhook` si fereastra ramane deschisa
            } else {
                // Nu sunt modificari, doar inchidem fereastra
                hideModal();
            }
        });

        document.getElementById('close-modal-btn').addEventListener('click', hideModal);
    }

    function showModal() {
        // Facem o "poză" stocului exact cand deschidem fereastra
        stockStateBeforeEdit = { ...detailPageState };
        createStockModal();
        stockModal.classList.remove('hidden');
    }

    function hideModal() {
        const modalContent = stockModal.querySelector('.animate-slide-down');
        if (modalContent) {
            modalContent.classList.remove('animate-slide-down');
            modalContent.classList.add('animate-slide-up');
            setTimeout(() => stockModal.classList.add('hidden'), 300);
        }
    }

    // --- Initializare & Event Listeners Pagina ---
    
    document.getElementById('open-stock-modal-button').addEventListener('click', showModal);

    stockModal.addEventListener('click', (event) => {
        if (event.target === stockModal) {
            hideModal();
        }
    });

    loadProductDetails();
});
