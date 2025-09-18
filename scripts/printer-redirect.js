// scripts/printer-redirect.js
import { getProductById } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    const printButton = document.getElementById('go-to-print-button');
    
    if (printButton) {
        printButton.addEventListener('click', () => {
            // Preluam ID-urile din sessionStorage
            const currentCommandId = sessionStorage.getItem('currentCommandId');
            const currentProductId = sessionStorage.getItem('currentProductId');
            
            if (currentCommandId && currentProductId) {
                const currentProduct = getProductById(currentCommandId, currentProductId);
                if (currentProduct) {
                    // Preia ID-ul produsului pentru a-l trimite la pagina de imprimare
                    const productCode = currentProduct.id; 
                    
                    // Deschide pagina printer.html și trimite codul produsului ca parametru URL
                    // Aici URL-ul cu parametru este OK, deoarece se deschide intr-un tab nou
                    // si este o actiune punctuala, nu tine de starea navigarii.
                    window.open(`printer.html?text=${encodeURIComponent(productCode)}`, '_blank');
                } else {
                    alert("Produsul nu a fost găsit.");
                }
            } else {
                alert("ID-ul produsului sau al comenzii lipsește.");
            }
        });
    }
});
