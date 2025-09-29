// comandat/on-site/on-site-main/scripts/product-detail.js
import { AppState, fetchDataAndSyncState, sendStockUpdate, fetchProductDetailsInBulk } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let currentCommandId = null;
    let currentProductId = null; // Acesta este productsku
    let currentProduct = null;   // Acesta conține toate detaliile, inclusiv .asin
    let swiper = null;

    let stockStateAtModalOpen = {};
    let stockStateInModal = {};
    let pressTimer = null;
    let clickHandler = null;

    let allProducts = []; // NOU: Toate produsele din toate comenzile
    let allProductDetails = {}; // NOU: Detalii (titlu, imagini) pentru toate produsele

    const pageElements = {
        title: document.getElementById('product-detail-title'),
        expectedStock: document.getElementById('expected-stock'),
        suggestedCondition: document.getElementById('suggested-condition'),
        totalFound: document.getElementById('total-found'),
        imageWrapper: document.getElementById('product-image-wrapper'),
        stockModal: document.getElementById('stock-modal'),
        openModalButton: document.getElementById('open-stock-modal-button'),
        
        // NOU: Elemente de căutare
        searchOverlay: document.getElementById('search-overlay'),
        searchTriggerHeader: document.getElementById('search-trigger-button'),
        searchTriggerFooter: document.getElementById('footer-search-trigger'),
        closeSearchButton: document.getElementById('close-search-button'),
        searchInput: document.getElementById('search-input'),
        searchResultsContainer: document.getElementById('search-results-container'),
    };

    function getLatestProductData() {
        const command = AppState.getCommands().find(c => c.id === currentCommandId);
        // Căutăm produsul după ID-ul intern (productsku)
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
        hideModal();

        if (success) {
            await fetchDataAndSyncState();
            renderPageContent();
        } else {
            alert('Eroare la salvare! Vă rugăm încercați din nou.');
        }
    }
    
    // ... (restul funcțiilor showModal, hideModal, createCounter, updateValue, addModalEventListeners rămân neschimbate) ...
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
                if (action === 'plus') {
                    updateValue(target, currentValue + 1);
                } else {
                    updateValue(target, currentValue - 1);
                }
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
    // ... (Sfârșitul funcțiilor neschimbate) ...


    // NOU: Funcții pentru Căutare

    function openSearch() {
        document.body.classList.add('overflow-hidden');
        pageElements.searchOverlay.classList.remove('hidden');
        pageElements.searchInput.focus();
    }

    function closeSearch() {
        document.body.classList.remove('overflow-hidden');
        pageElements.searchOverlay.classList.add('hidden');
        pageElements.searchInput.value = '';
        pageElements.searchResultsContainer.innerHTML = '';
    }

    function navigateToProduct(commandId, productId) {
        sessionStorage.setItem('currentCommandId', commandId);
        sessionStorage.setItem('currentProductId', productId);
        window.location.href = 'product-detail.html';
    }

    function renderSearchResults(results) {
        pageElements.searchResultsContainer.innerHTML = '';
        if (results.length === 0) {
            pageElements.searchResultsContainer.innerHTML = '<p class="p-4 text-center text-gray-500">Niciun rezultat găsit. Încercați cu alte cuvinte cheie (Titlu, ASIN sau SKU).</p>';
            return;
        }

        results.forEach(product => {
            const details = allProductDetails[product.asin] || { title: 'Nume indisponibil', images: [] };
            const productName = details?.title || 'Nume indisponibil';
            const imageUrl = details?.images?.[0] || '';

            const resultEl = document.createElement('a');
            resultEl.href = '#';
            resultEl.className = 'flex items-center gap-4 bg-white p-4 transition-colors hover:bg-gray-50';
            
            resultEl.innerHTML = `
                <img alt="${productName}" class="h-14 w-14 rounded-md object-cover bg-gray-200" src="${imageUrl}" />
                <div class="flex-1">
                    <p class="font-medium text-gray-900 line-clamp-2">${productName}</p>
                    <p class="text-sm text-gray-500">ASIN: ${product.asin} | SKU: ${product.id} | Comanda: ${product.commandName}</p>
                    <p class="text-sm text-gray-500">${product.found} din ${product.expected}</p>
                </div>`;

            resultEl.addEventListener('click', (event) => {
                event.preventDefault();
                navigateToProduct(product.commandId, product.id);
            });
            pageElements.searchResultsContainer.appendChild(resultEl);
        });
    }

    // Funcție simplă de normalizare pentru o căutare "fuzzy"
    function normalizeText(text) {
        if (!text) return '';
        // Elimină diacritice, trece la minuscule și elimină caractere non-alphanumerice
        return text.toLowerCase()
                   .normalize("NFD")
                   .replace(/[\u0300-\u036f]/g, "")
                   .replace(/[^a-z0-9]/g, ''); 
    }

    function performSearch(query) {
        const normalizedQuery = normalizeText(query);
        if (normalizedQuery.length < 2) {
            pageElements.searchResultsContainer.innerHTML = '<p class="p-4 text-center text-gray-500">Introduceți cel puțin 2 caractere pentru a căuta.</p>';
            return;
        }

        const results = allProducts.filter(product => {
            const details = allProductDetails[product.asin] || {};
            const title = normalizeText(details.title);
            const asin = normalizeText(product.asin);
            const sku = normalizeText(product.id);

            // Căutare parțială (conține) pe titlu, ASIN sau SKU
            return title.includes(normalizedQuery) || 
                   asin.includes(normalizedQuery) || 
                   sku.includes(normalizedQuery);
        });

        renderSearchResults(results);
    }
    
    async function setupSearchLogic() {
        await fetchDataAndSyncState();
        const commands = AppState.getCommands();
        const allAsins = new Set();
        allProducts = [];

        commands.forEach(command => {
            command.products.forEach(product => {
                // Adaugă informațiile comenzii la produs pentru navigare
                allProducts.push({
                    ...product, 
                    commandId: command.id,
                    commandName: command.name.replace('Comanda #', '')
                });
                allAsins.add(product.asin);
            });
        });
        
        // Pre-încarcă toate detaliile produselor pentru căutare rapidă
        allProductDetails = await fetchProductDetailsInBulk(Array.from(allAsins));
        
        // Adaugă Event Listeners pentru căutare
        if (pageElements.searchTriggerHeader) pageElements.searchTriggerHeader.addEventListener('click', openSearch);
        if (pageElements.searchTriggerFooter) pageElements.searchTriggerFooter.addEventListener('click', openSearch);
        if (pageElements.closeSearchButton) pageElements.closeSearchButton.addEventListener('click', closeSearch);
        if (pageElements.searchInput) {
            pageElements.searchInput.addEventListener('input', () => {
                performSearch(pageElements.searchInput.value);
            });
        }
        
        // Verifică dacă pagina a fost redirecționată pentru căutare
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('search') === 'true') {
            openSearch();
        }
    }


    async function initializePage() {
        currentCommandId = sessionStorage.getItem('currentCommandId');
        currentProductId = sessionStorage.getItem('currentProductId');
        
        // Setează logica de căutare întotdeauna
        await setupSearchLogic();

        // Continuă cu randarea paginii de detaliu doar dacă avem context de produs
        if (!currentCommandId || !currentProductId) {
             // Dacă suntem pe product-detail.html fără context (dar nu pentru căutare), redirecționăm
             if (window.location.search.indexOf('search') === -1) {
                window.location.href = 'main.html';
             }
             return;
        }

        currentProduct = getLatestProductData();
        if (!currentProduct) {
            alert('Produsul nu a fost gasit');
            window.location.href = 'products.html';
            return;
        }

        renderPageContent();

        const productDetails = allProductDetails[currentProduct.asin]; 

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
