// scripts/products.js
import { getCommandById, fetchProductDetailsInBulk, fetchAndSyncAllCommandsData } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    let refreshInterval = null;
    const POLLING_INTERVAL = 60000; // 1 minut

    async function renderProductsList() {
        // NOU: Sincronizăm datele de bază înainte de a le afișa (rezolvă Scenario 1)
        const syncSuccess = await fetchAndSyncAllCommandsData();
        
        const container = document.getElementById('products-list-container');
        if (!container) return;

        const commandId = sessionStorage.getItem('currentCommandId');
        if (!commandId) {
            container.innerHTML = '<p class="p-4 text-center text-red-500">ID-ul comenzii nu a fost găsit.</p>';
            return;
        }
        
        // Reîncărcăm comanda după sincronizare
        const command = getCommandById(commandId);
        if (!command || !command.products || command.products.length === 0) {
             container.innerHTML = '<p class="p-4 text-center text-gray-500">Comanda nu are produse.</p>';
            return;
        }

        // Dacă nu este prima randare, păstrăm mesajul de așteptare până la final
        if (container.innerHTML === '') {
            container.innerHTML = '<p class="p-4 text-center text-gray-500">Se încarcă produsele...</p>'; 
        }

        // Pas 1: Colectam toate ASIN-urile din produsele comenzii
        const asins = command.products.map(p => p.asin);
        
        // Pas 2: Facem un singur request pentru a prelua toate detaliile
        const allProductDetails = await fetchProductDetailsInBulk(asins);
        
        container.innerHTML = ''; // Golim containerul de mesajul de asteptare

        // Pas 3: Construim elementele HTML folosind detaliile primite
        command.products.forEach(product => {
            const details = allProductDetails[product.asin];
            const productName = details?.title || 'Nume indisponibil';
            const imageUrl = details?.images?.[0] || '';

            const productEl = document.createElement('a');
            productEl.href = `product-detail.html`;
            productEl.className = 'flex items-center gap-4 bg-white p-4 transition-colors hover:bg-gray-50';
            
            // product.found vine acum din localStorage, care a fost actualizat
            productEl.innerHTML = `
                <img alt="${productName}" class="h-14 w-14 rounded-md object-cover bg-gray-200" src="${imageUrl}" />
                <div class="flex-1">
                    <p class="font-medium text-gray-900 line-clamp-2">${productName}</p>
                    <p class="text-sm text-gray-500">${product.found} din ${product.expected}</p>
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
