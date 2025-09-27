import { getProductById, fetchProductDetails, fetchPendingDeltas, fetchAndSyncAllCommandsData } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null;
    let currentProduct = null;
    let swiper = null;

    // Acum stocheaza starea LIVE (Base + Deltas)
    let liveStockState = { 'new': 0, 'very-good': 0, 'good': 0, 'broken': 0 }; 
    // Aceasta va stoca o copie a starii live la deschiderea modalului, pentru calculul diferentei.
    let stockStateAtModalOpen = {}; 
    
    let refreshInterval = null; 
    const POLLING_INTERVAL = 60000; // 1 minut

    // --- Functii pentru Webhook ---
    async function sendStockUpdateToWebhook(commandId, productAsin, stockDelta) {
        const webhookUrl = 'https://automatizare.comandat.ro/webhook/147557e0-e23d-470c-af50-ddc3c724dff8';
        
        const payload = {
            commandId: commandId,
            asin: productAsin,
            ...stockDelta 
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
            return true; 
        } catch (error) {
            console.error('Failed to send update to webhook:', error);
            alert('Eroare la salvarea datelor pe server. Modificările nu au fost salvate. Vă rugăm încercați din nou.');
            return false; 
        }
    }
    
    // NOU: Funcție pentru a calcula și afișa stocul "live"
    async function updateLiveStockUI() {
        if (!currentCommandId || !currentProduct) return;
        
        // PAS 1: Preluăm starea de bază din localStorage
        const baseProduct = getProductById(currentCommandId, currentProductId);
        if (!baseProduct) return;
        const baseState = baseProduct.state;
        
        document.getElementById('expected-stock').textContent = baseProduct.expected;

        // PAS 2: Preluăm delta-urile pendinte de pe server
        try {
            const deltas = await fetchPendingDeltas(currentCommandId, currentProduct.asin);
            
            // PAS 3: Calculăm starea 'live' (Base State + Deltas)
            const calculatedLiveState = { ...baseState };
            let totalFound = 0;

            for (const condition in calculatedLiveState) {
                const delta = deltas[condition] || 0;
                // Aplicăm delta-ul peste stocul de bază
                calculatedLiveState[condition] = baseState[condition] + delta; 
                totalFound += calculatedLiveState[condition];
            }
            
            // Actualizăm starea locală live
            Object.assign(liveStockState, calculatedLiveState);

            // PAS 4: Actualizăm UI-ul cu liveState
            for (const condition in liveStockState) {
                document.querySelector(`[data-summary="${condition}"]`).textContent = liveStockState[condition];
            }
            document.getElementById('total-found').textContent = totalFound;
            
        } catch (e) {
            console.warn("Polling Delta Failed, UI state not updated.", e);
        }
    };
    
    // --- Functii pentru UI ---
    
    async function loadProductDetails() {
        currentCommandId = sessionStorage.getItem('currentCommandId');
        currentProductId = sessionStorage.getItem('currentProductId');
        if (!currentCommandId || !currentProductId) {
            alert("Lipsesc informații!");
            window.location.href = 'main.html';
            return;
        }
        
        // Sincronizam Base State inainte de a incarca produsul (esential)
        await fetchAndSyncAllCommandsData(); 

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
        
        // Pornim Polling-ul
        if (refreshInterval) clearInterval(refreshInterval); 
        refreshInterval = setInterval(updateLiveStockUI, POLLING_INTERVAL);
        await updateLiveStockUI(); // Apel inițial
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
            // Se presupune că Swiper este încărcat în product-detail.html
            swiper = new Swiper('#image-swiper-container', {
                loop: false,
                pagination: { el: '.swiper-pagination', clickable: true },
            });
        }
    }


    // --- Logica pentru Modala "Adauga in Stoc" ---
    
    const stockModal = document.getElementById('stock-modal');
    
    // Functia care populeaza modalul cu starea live curenta
    function createStockModal(currentState) {
        // Cream o copie a starii curente in care vom face modificarile
        const modalState = { ...currentState };
        
        stockModal.innerHTML = `
            <div class="absolute bottom-0 w-full max-w-md mx-auto left-0 right-0 bg-white rounded-t-2xl shadow-lg p-4 animate-slide-down">
                <h3 class="text-xl font-bold text-center mb-4">Adaugă în Stoc</h3>
                ${createCounter('new', 'Ca Nou', modalState)}
                ${createCounter('very-good', 'Foarte Bun', modalState)}
                ${createCounter('good', 'Bun', modalState)}
                ${createCounter('broken', 'Defect', modalState, true)}
                <div class="flex gap-3 mt-6">
                    <button id="close-modal-btn" class="w-1/2 rounded-lg bg-gray-200 py-3 font-bold text-gray-700">Anulează</button>
                    <button id="save-and-print-btn" class="w-1/2 rounded-lg bg-[var(--primary-color)] py-3 font-bold text-white">Salvează și Printează</button>
                </div>
            </div>`;
        addModalEventListeners(modalState);
        return modalState; 
    }
    
    // Modificam createCounter sa primeasca starea
    function createCounter(id, label, state, isDanger = false) {
        const colorClass = isDanger ? 'text-red-600' : 'text-gray-800';
        return `
            <div class="flex items-center justify-between py-3 border-b">
                <span class="text-lg font-medium ${colorClass}">${label}</span>
                <div class="flex items-center gap-3">
                    <button data-action="minus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold">-</button>
                    <span id="count-${id}" class="text-xl font-bold w-8 text-center">${state[id]}</span>
                    <button data-action="plus" data-target="${id}" class="control-btn rounded-full bg-gray-200 w-8 h-8 flex items-center justify-center text-lg font-bold">+</button>
                </div>
            </div>`;
    }

    // Modificam addModalEventListeners sa primeasca starea modalului
    function addModalEventListeners(modalState) {
        document.querySelectorAll('.control-btn').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                const target = button.dataset.target;
                if (action === 'plus') {
                    modalState[target]++;
                } else if (action === 'minus' && modalState[target] > 0) {
                    modalState[target]--;
                }
                document.getElementById(`count-${target}`).textContent = modalState[target];
            });
        });

        document.getElementById('save-and-print-btn').addEventListener('click', async () => {
            const stockStateAfterEdit = modalState; 
            const stockDelta = {};
            let hasChanges = false;
            const conditions = ['new', 'very-good', 'good', 'broken'];

            // Calculam Delta: (Starea Noua din Modal) - (Starea Live de la deschiderea Modalului)
            for (const condition of conditions) {
                const countBefore = stockStateAtModalOpen[condition] || 0;
                const countAfter = stockStateAfterEdit[condition] || 0;
                const difference = countAfter - countBefore;

                if (difference !== 0) {
                    stockDelta[condition] = difference;
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                // Trimitem delta la server
                const success = await sendStockUpdateToWebhook(currentCommandId, currentProduct.asin, stockDelta);
                
                if (success) {
                    // Daca serverul a confirmat, inchidem modalul si Fortam un Polling Delta imediat
                    hideModal();
                    await updateLiveStockUI(); 
                    
                    // Aici vom adauga logica de printare
                    const labelsToPrint = {};
                    for(const condition in stockDelta){
                        if(stockDelta[condition] > 0){
                            // Numarul de etichete de printat este egal cu diferenta pozitiva
                            labelsToPrint[condition] = stockDelta[condition]; 
                        }
                    }
                    if (Object.keys(labelsToPrint).length > 0) {
                        triggerPrintingProcess(labelsToPrint);
                    }
                }
                // Daca nu e succes, alerta este afisata si fereastra ramane deschisa
            } else {
                // Nu sunt modificari, doar inchidem fereastra
                hideModal();
            }
        });

        document.getElementById('close-modal-btn').addEventListener('click', hideModal);
    }
    
    // Functie noua de printare (folosind logica existenta in printer-redirect.js)
    function triggerPrintingProcess(labelsToPrint) {
        const productCode = currentProduct.id;
        // Trimit toate detaliile de printat ca JSON in URL
        const printDetails = JSON.stringify({ code: productCode, quantities: labelsToPrint });
        
        // Deschide pagina printer.html și trimite detaliile ca parametru URL
        window.open(`printer.html?print=${encodeURIComponent(printDetails)}`, '_blank');
    }
    
    function showModal() {
        // Facem o "poză" stocului LIVE exact cand deschidem fereastra
        stockStateAtModalOpen = { ...liveStockState };
        // Creaza modalul cu starea LIVE si seteaza event listenerii pentru a modifica starea temporara
        createStockModal(stockStateAtModalOpen); 
        stockModal.classList.remove('hidden');
    }

    function hideModal() {
        const modalContent = stockModal.querySelector('div.animate-slide-down, div.animate-slide-up');
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
    
    window.addEventListener('beforeunload', () => {
        if (refreshInterval) clearInterval(refreshInterval);
    });
});
