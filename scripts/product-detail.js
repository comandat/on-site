import { getProductById, updateProductState, fetchProductDetails } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null;
    let currentProduct = null;
    let swiper = null; // Variabila pentru instanta Swiper
    
    // Starea initiala a contorului de stoc din pagina de detaliu
    const detailPageState = { 'new': 0, 'very-good': 0, 'good': 0, 'broken': 0 };
    
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
        wrapper.innerHTML = ''; // Golim galeria existenta

        if (images.length === 0) {
            // Daca nu sunt imagini, afisam un placeholder
            wrapper.innerHTML = `<div class="swiper-slide bg-gray-200 flex items-center justify-center"><span class="material-symbols-outlined text-gray-400 text-6xl">hide_image</span></div>`;
        } else {
            images.forEach(imageUrl => {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                slide.style.backgroundImage = `url('${imageUrl}')`;
                wrapper.appendChild(slide);
            });
        }
        
        // Initializam sau actualizam Swiper
        if (swiper) {
            swiper.update();
        } else {
            swiper = new Swiper('#image-swiper-container', {
                loop: false,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
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
        // La salvare, actualizam si UI-ul principal
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
                    <button id="save-stock-btn" class="w-1/2 rounded-lg bg-[var(--primary-color)] py-3 font-bold text-white">Salvează</button>
                </div>
            </div>`;
        
        // Adaugam event listeners la butoanele din modal
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

        document.getElementById('save-stock-btn').addEventListener('click', () => {
            saveCurrentProductState();
            hideModal();
        });

        document.getElementById('close-modal-btn').addEventListener('click', hideModal);
    }

    function showModal() {
        createStockModal(); // Recreeaza modala cu valorile curente
        stockModal.classList.remove('hidden');
    }

    function hideModal() {
        const modalContent = stockModal.querySelector('.animate-slide-down');
        if (modalContent) {
            modalContent.classList.remove('animate-slide-down');
            modalContent.classList.add('animate-slide-up');
            // Asteptam sa se termine animatia inainte de a ascunde complet
            setTimeout(() => stockModal.classList.add('hidden'), 300);
        }
    }

    // --- Initializare & Event Listeners Pagina ---
    
    document.getElementById('open-stock-modal-button').addEventListener('click', showModal);

    loadProductDetails();
});
