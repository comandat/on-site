// scripts/printer-redirect.js
import { getProductById } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    const printButton = document.getElementById('go-to-print-button');
    
    if (printButton) {
        printButton.addEventListener('click', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const currentProductId = urlParams.get('id');
            
            if (currentProductId) {
                const currentProduct = getProductById(currentProductId);
                if (currentProduct) {
                    // Preia ID-ul produsului pentru a-l trimite la pagina de imprimare
                    const productCode = currentProduct.id; 
                    
                    // Deschide pagina printer.html și trimite codul produsului ca parametru URL
                    window.open(`printer.html?text=${encodeURIComponent(productCode)}`, '_blank');
                } else {
                    alert("Produsul nu a fost găsit.");
                }
            } else {
                alert("ID-ul produsului lipsește din URL.");
            }
        });
    }
});
