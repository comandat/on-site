import { getProductsData } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    function renderProductsList() {
        const productsData = getProductsData();
        const container = document.getElementById('products-list-container');
        if (!container) return;
        
        container.innerHTML = '';
        productsData.forEach(product => {
            const productEl = document.createElement('a');
            productEl.href = `product-detail.html?id=${product.id}`;
            productEl.className = 'flex items-center gap-4 bg-white p-4 transition-colors hover:bg-gray-50';
            productEl.innerHTML = `
                <img alt="${product.name}" class="h-14 w-14 rounded-md object-cover" src="${product.imageUrl}" />
                <div class="flex-1">
                    <p class="font-medium text-gray-900 line-clamp-2">${product.name}</p>
                    <p class="text-sm text-gray-500">${product.found} din ${product.expected}</p>
                </div>
                <span class="material-symbols-outlined text-gray-400"> chevron_right </span>`;
            container.appendChild(productEl);
        });
    }

    renderProductsList();
});
