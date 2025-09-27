// scripts/products.js
import { AppState, syncStateWithServer, fetchProductDetailsInBulk } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('products-list-container');
    const commandId = sessionStorage.getItem('currentCommandId');

    async function renderProductsList() {
        if (!container || !commandId) return;

        // Afișează un mesaj de încărcare inițial
        container.innerHTML = '<p class="p-4 text-center text-gray-500">Se actualizează lista de produse...</p>';
        
        // Sincronizează datele cu serverul la fiecare afișare a listei
        await syncStateWithServer();

        const command = AppState.getCommandById(commandId);
        if (!command || !command.products || command.products.length === 0) {
            container.innerHTML = '<p class="p-4 text-center text-gray-500">Comanda nu are produse.</p>';
            return;
        }

        // Prelucrează detaliile (nume, imagini) pentru toate produsele vizibile
        const asins = command.products.map(p => p.asin);
        const allProductDetails = await fetchProductDetailsInBulk(asins);
        
        container.innerHTML = ''; // Golește containerul de mesajul de încărcare

        // Construiește elementele HTML
        command.products.forEach(product => {
            const details = allProductDetails[product.asin];
            const productName = details?.title || 'Nume indisponibil';
            const imageUrl = details?.images?.[0] || 'placeholder.jpg'; // Adaugă un placeholder dacă nu există imagine

            const productEl = document.createElement('a');
            productEl.href = `product-detail.html`;
            productEl.className = 'flex items-center gap-4 bg-white p-4 transition-colors hover:bg-gray-50';
            
            // Folosim direct `product.found` din starea noastră "live"
            productEl.innerHTML = `
                <img alt="${productName}" class="h-14 w-14 rounded-md object-cover bg-gray-200" src="${imageUrl}" />
                <div class="flex-1">
                    <p class="font-medium text-gray-900 line-clamp-2">${productName}</p>
                    <p class="text-sm text-gray-500">${product.found} din ${product.expected}</p>
                </div>
                <span class="material-symbols-outlined text-gray-400">chevron_right</span>`;

            productEl.addEventListener('click', (event) => {
                event.preventDefault();
                sessionStorage.setItem('currentProductId', product.id);
                window.location.href = event.currentTarget.href;
            });

            container.appendChild(productEl);
        });
    }

    // Inițializează pagina
    renderProductsList();
});
