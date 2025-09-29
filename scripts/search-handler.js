// comandat/on-site/on-site-main/scripts/search-handler.js

document.addEventListener('DOMContentLoaded', () => {
    // Închide scanner-ul de coduri de bare dacă este deschis, pentru a evita interferențele
    if (typeof Html5QrcodeScanner !== 'undefined') {
        try {
            const scannerContainer = document.getElementById('scanner-container');
            if (scannerContainer && !scannerContainer.classList.contains('hidden')) {
                document.getElementById('close-scanner-button')?.click();
            }
        } catch (e) {
            console.warn("Could not access scanner elements:", e);
        }
    }
    
    // Logica pentru butoanele de căutare din subsol pe paginile principale
    const footerSearchButton = document.getElementById('footer-search-trigger');
    const searchOverlay = document.getElementById('search-overlay');
    
    // Dacă nu există elementul #search-overlay, presupunem că suntem pe o pagină care doar redirecționează (main.html, products.html, printer.html)
    if (footerSearchButton && !searchOverlay) {
        footerSearchButton.addEventListener('click', () => {
            // Redirecționare către product-detail.html pentru a efectua căutarea
            window.location.href = 'product-detail.html?search=true';
        });
    }
});
