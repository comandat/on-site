// scripts/products.js
import { getCommandById, fetchProductDetailsInBulk, fetchAndSyncAllCommandsData } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let refreshInterval = null;
    const POLLING_INTERVAL = 60000; // 1 minut
    
    // Helper function pentru a prelua si agrega toate delta-urile pendinte
    async function fetchAllLiveDeltas(commandId) {
        // URL-ul de citire Delta
        const deltaWebhookUrl = 'https://automatizare.comandat.ro/webhook/07cb7f77-1737-4345-b840-3c610100a34b'; 
        const deltas = {};
        
        try {
            // Cerem toate delta-urile (serverul nu face filtrare)
            const response = await fetch(deltaWebhookUrl, { method: 'GET', headers: { 'Accept': 'application/json' }});
            if (!response.ok) return {};
            
            const responseData = await response.json();
            
            if (Array.isArray(responseData)) {
                responseData
                    .filter(item => item.command_id === commandId) // Filtrare locala pe comanda curenta
                    .forEach(item => {
                        const asinKey = item.asin;
                        const condition = item.condition;
                        const changeValue = parseInt(item.change_value, 10);
                        
                        // Initializam sau agregam delta-urile pe ASIN si conditie
                        if (!deltas[asinKey]) {
                            deltas[asinKey] = { 'new': 0, 'very-good': 0, 'good': 0, 'broken': 0 };
                        }
                        deltas[asinKey][condition] = (deltas[asinKey][condition] || 0) + changeValue;
                    });
            }
        } catch (error) {
            console.error('Error fetching bulk deltas:', error);
            return {};
        }

        return deltas; // { 'ASIN1': { 'new': 2, 'good': -1 }, ... }
    }


    async function renderProductsList() {
        // PAS 1 (CRITICAL CHANGE): AM ELIMINAT fetchAndSyncAllCommandsData() de aici.
        // Ne bazăm pe Base State din localStorage.
        
        const container = document.getElementById('products-list-container');
        if (!container) return;

        const commandId = sessionStorage.getItem('currentCommandId');
        if (!commandId) {
            container.innerHTML = '<p class="p-4 text-center text-red-500">ID-ul comenzii nu a fost găsit.</p>';
            return;
        }
        
        // Comanda este reîncărcată de aici.
        const command = getCommandById(commandId);
        if (!command || !command.products || command.products.length === 0) {
             container.innerHTML = '<p class="p-4 text-center text-gray-500">Comanda nu are produse.</p>';
            return;
        }

        if (container.innerHTML === '') {
            container.innerHTML = '<p class="p-4 text-center text-gray-500">Se încarcă produsele...</p>'; 
        }

        // PAS 2 (NOU): Preluam toate Delta-urile O SINGURA DATA
        const allLiveDeltas = await fetchAllLiveDeltas(commandId);
        
        // Pas 3: Colectam toate ASIN-urile din produsele comenzii
        const asins = command.products.map(p => p.asin);
        
        // Pas 4: Facem un singur request pentru a prelua toate detaliile
        const allProductDetails = await fetchProductDetailsInBulk(asins);
        
        container.innerHTML = ''; // Golim containerul de mesajul de asteptare

        // Pas 5: Construim elementele HTML
        command.products.forEach(product => {
            const details = allProductDetails[product.asin];
            const productName = details?.title || 'Nume indisponibil';
            const imageUrl = details?.images?.[0] || '';

            // LOGICA NOUĂ: Calculăm stocul LIVE (Base State + Deltas)
            const deltas = allLiveDeltas[product.asin] || {};
            
            let totalDelta = 0;
            for (const condition in deltas) {
                totalDelta += deltas[condition];
            }
            
            // Live Stock = Base State (din localStorage) + Total Delta (din tabela intermediara)
            const liveFoundStock = product.found + totalDelta;


            const productEl = document.createElement('a');
            productEl.href = `product-detail.html`;
            productEl.className = 'flex items-center gap-4 bg-white p-4 transition-colors hover:bg-gray-50';
            
            // Afisam stocul LIVE
            productEl.innerHTML = `
                <img alt="${productName}" class="h-14 w-14 rounded-md object-cover bg-gray-200" src="${imageUrl}" />
                <div class="flex-1">
                    <p class="font-medium text-gray-900 line-clamp-2">${productName}</p>
                    <p class="text-sm text-gray-500">${liveFoundStock} din ${product.expected}</p>
                </div>
                <span class="material-symbols-outlined text-gray-400"> chevron_right </span>`;

            productEl.addEventListener('click', (event) => {
                event.preventDefault();
                sessionStorage.setItem('currentProductId', product.id);
                window.location.href = event.currentTarget.href;
            });

            container.appendChild(productEl);
        });
    }

    // NOU: Funcția care inițiază Polling-ul și apelul inițial
    async function initPolling() {
        // SINCRONIZARE DE BAZĂ (DOAR O DATĂ LA ÎNCĂRCAREA PAGINII)
        await fetchAndSyncAllCommandsData();
        
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(renderProductsList, POLLING_INTERVAL);
        await renderProductsList();
    }

    initPolling();
    
    // NOU: Oprim Polling-ul la ieșirea din pagină
    window.addEventListener('beforeunload', () => {
        if (refreshInterval) clearInterval(refreshInterval);
    });
});
