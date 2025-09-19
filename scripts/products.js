import { getCommandById } from './data.js';
// Importam noua functie
import { fetchProductDetails } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    // Transformam functia in async pentru a putea folosi 'await'
    async function renderProductsList() {
        const container = document.getElementById('products-list-container');
        if (!container) return;

        const commandId = sessionStorage.getItem('currentCommandId');
        if (!commandId) {
            container.innerHTML = '<p class="p-4 text-center text-red-500">ID-ul comenzii nu a fost găsit. Te rugăm să selectezi o comandă.</p>';
            return;
        }
        
        const command = getCommandById(commandId);
        if (!command || !command.products) {
             container.innerHTML = '<p class="p-4 text-center text-gray-500">Comanda nu a fost găsită sau nu are produse.</p>';
            return;
        }

        container.innerHTML = ''; // Golim containerul

        // Folosim Promise.all pentru a astepta toate request-urile sa se termine
        await Promise.all(command.products.map(async (product) => {
            // Preluam dinamic detaliile pentru fiecare produs
            const details = await fetchProductDetails(product.asin);
            const productName = details.title || product.name;
            const imageUrl = details.images && details.images.length > 0 ? details.images[0] : product.imageUrl;

            const productEl = document.createElement('a');
            productEl.href = `product-detail.html`;
            productEl.className = 'flex items-center gap-4 bg-white p-4 transition-colors hover:bg-gray-50';
            
            productEl.innerHTML = `
                <img alt="${productName}" class="h-14 w-14 rounded-md object-cover bg-gray-200" src="${imageUrl}" />
                <div class="flex-1">
                    <p class="font-medium text-gray-900 line-clamp-2">${productName}</p>
                    <p class="text-sm text-gray-500">${product.found} din ${product.expected}</p>
                </div>
                <span class="material-symbols-outlined text-gray-400"> chevron_right </span>`;

            productEl.addEventListener('click', (event) => {
                event.preventDefault();
                // Salvam ID-ul produsului (productsku)
                sessionStorage.setItem('currentProductId', product.id);
                window.location.href = event.currentTarget.href;
            });

            container.appendChild(productEl);
        }));
    }

    renderProductsList();
});
