import { getCommandById } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    function renderProductsList() {
        const container = document.getElementById('products-list-container');
        if (!container) return;

        // Preluam ID-ul comenzii din sessionStorage
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
        command.products.forEach(product => {
            const productEl = document.createElement('a');
            productEl.href = `product-detail.html`; // URL curat
            productEl.className = 'flex items-center gap-4 bg-white p-4 transition-colors hover:bg-gray-50';
            
            productEl.innerHTML = `
                <img alt="${product.name}" class="h-14 w-14 rounded-md object-cover" src="${product.imageUrl}" />
                <div class="flex-1">
                    <p class="font-medium text-gray-900 line-clamp-2">${product.name}</p>
                    <p class="text-sm text-gray-500">${product.found} din ${product.expected}</p>
                </div>
                <span class="material-symbols-outlined text-gray-400"> chevron_right </span>`;

            // Adaugam listener pentru a salva ID-ul produsului si a naviga
            productEl.addEventListener('click', (event) => {
                event.preventDefault();
                sessionStorage.setItem('currentProductId', product.id);
                window.location.href = event.currentTarget.href;
            });

            container.appendChild(productEl);
        });
    }

    renderProductsList();
});
