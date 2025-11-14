// scripts/app-router.js
import { autoConnectToPrinter } from './printer-handler.js';
import { initCommandsPage } from './main.js';
import { initPalletsPage } from './pallets.js';
import { initProductsPage } from './products.js';
import { initProductDetailPage } from './product-detail.js';
import { initAddProductPage } from './add-product.js';

// --- START FIX: Am adăugat la loc import-urile ---
import { initSearchHandler } from './search-handler.js';
import { AppState } from './data.js';
import { showToast } from './printer-handler.js';
// --- FINAL FIX ---

// --- START FIX: Am adăugat la loc openSearchFunction ---
let openSearchFunction = () => {};
// --- FINAL FIX ---
let pages = {};

/**
 * Funcția centrală de navigare.
 * @param {string} pageId - ID-ul paginii (ex: 'commands', 'pallets')
 * @param {object} context - Date suplimentare de trimis paginii (ex: { search: true })
 */
function navigateTo(pageId, context = {}) {
    // Ascunde toate paginile
    Object.values(pages).forEach(page => page.classList.add('hidden'));

    // Găsește și afișează pagina țintă
    const targetPage = pages[pageId];
    if (targetPage) {
        targetPage.classList.remove('hidden');
        window.scrollTo(0, 0); // Resetează scroll-ul
        
        // Setează hash-ul pentru a permite navigarea back/forward
        window.location.hash = pageId;

        // Rulează funcția de inițializare specifică paginii
        switch (pageId) {
            case 'commands':
                initCommandsPage();
                break;
            case 'pallets':
                initPalletsPage();
                break;
            case 'products':
                initProductsPage();
                break;
            case 'product-detail':
                // --- START FIX: Am adăugat la loc parametrul openSearchFunction ---
                initProductDetailPage(context, openSearchFunction);
                // --- FINAL FIX ---
                break;
            case 'add-product':
                initAddProductPage();
                break;
        }
        
        // Actualizează starea activă a footer-ului
        updateFooterActiveState(pageId);

    } else {
        console.warn(`Pagina cu ID-ul '${pageId}' nu a fost găsită.`);
    }
}

/**
 * Actualizează care buton din footer este marcat ca "activ".
 */
function updateFooterActiveState(activePageId) {
    document.querySelectorAll('footer [data-nav]').forEach(button => {
        const page = button.dataset.nav;

        // Reset
        button.classList.remove('text-[var(--primary-color)]');
        button.classList.add('text-gray-500', 'hover:text-[var(--primary-color)]');

        // Set active
        if (page === activePageId || (activePageId.includes('product') && page === 'products')) {
             button.classList.add('text-[var(--primary-color)]');
             button.classList.remove('text-gray-500', 'hover:text-[var(--primary-color)]');
        }
        if (['commands', 'pallets', 'products', 'product-detail'].includes(activePageId) && page === 'commands') {
             button.classList.add('text-[var(--primary-color)]');
             button.classList.remove('text-gray-500', 'hover:text-[var(--primary-color)]');
        }
    });
    
    document.querySelectorAll('#footer-scan-trigger').forEach(button => {
        button.classList.remove('text-[var(--primary-color)]');
        button.classList.add('text-gray-500', 'hover:text-[var(--primary-color)]');
    });
}


/**
 * Gestionează încărcarea paginii pe baza hash-ului din URL.
 */
function handleHashChange() {
    const pageId = window.location.hash.substring(1);
    if (pageId && pages[pageId]) {
        navigateTo(pageId);
    } else {
        // Pagină implicită
        navigateTo('commands');
    }
}

// Expune router-ul pentru a fi folosit de alte module
export const router = {
    navigateTo
};

// --- Logica Scanner-ului LPN (Rămâne neschimbată) ---

const SCAN_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/find-product-by-lpn';
let html5QrCode = null;

async function onScanSuccess(decodedText, decodedResult) {
    stopScanner();
    showToast('Cod scanat. Se caută produsul...');
    try {
        const response = await fetch(`${SCAN_WEBHOOK_URL}?lpn=${decodedText}`, {
            method: 'GET',
        });
        if (!response.ok) throw new Error('Eroare de rețea sau LPN negăsit.');
        const productsData = await response.json();
        
        let productInfo = null;
        if (Array.isArray(productsData) && productsData.length > 0 && productsData[0]["Product SKU"]) {
            productInfo = productsData[0];
        } else if (typeof productsData === 'object' && productsData !== null && !Array.isArray(productsData) && productsData["Product SKU"]) {
            productInfo = productsData;
        }

        if (!productInfo) {
            console.error("Produsul nu a fost găsit în răspunsul API (LPN invalid?):", productsData);
            throw new Error('Produsul nu a fost găsit în API (LPN invalid?).');
        }

        const productSku = productInfo["Product SKU"];
        const allCommands = AppState.getCommands();
        let foundProduct = null;
        let foundCommandId = null;

        for (const command of allCommands) {
            const product = command.products.find(p => p.id === productSku);
            if (product) {
                foundProduct = product;
                foundCommandId = command.id;
                break;
            }
        }

        if (foundProduct && foundCommandId) {
            sessionStorage.setItem('currentCommandId', foundCommandId);
            sessionStorage.setItem('currentProductId', foundProduct.id);
            sessionStorage.setItem('currentManifestSku', foundProduct.manifestsku || 'No ManifestSKU');
            showToast('Produs găsit! Se deschide...');
            router.navigateTo('product-detail');
        } else {
            showToast(`Produsul (SKU: ...${productSku.slice(-6)}) nu e în comenzile curente.`, 5000);
            console.error('Produsul (SKU: ' + productSku + ') a fost găsit în API, dar nu există în comenzile încărcate în AppState.');
        }
    } catch (error) {
        console.error('Eroare la procesarea LPN:', error);
        showToast(error.message, 5000);
    }
}

function onScanFailure(error) { /* Nu face nimic */ }

// --- ÎNCEPUT MODIFICARE ---
// Am înlocuit funcția startScanner cu versiunea async
// care include logica de selecție a camerei "ultra".

async function startScanner() {
    const scannerContainer = document.getElementById('scanner-container');
    if (!scannerContainer) return;
    scannerContainer.classList.remove('hidden');
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    // --- Logică Selectare Cameră (adaptată din "storage") ---
    let preferredCamId = { facingMode: "environment" }; // Fallback-ul default
    const targetLabelUltra = "ultra";
    const targetLabelSuper = "superangurlar"; // Păstrăm ortografia din celălalt repo

    try {
        // Folosim metoda specifică acestei biblioteci
        const cameras = await Html5Qrcode.getCameras(); 
        
        console.log("--- Camere Disponibile (on-site) ---");
        cameras.forEach((cam, index) => {
            console.log(`[${index}]: ${cam.label} (ID: ${cam.id})`);
        });
        console.log("---------------------------");

        if (cameras.length > 0) {
            // 1. Căutăm "ultra"
            let targetCamera = cameras.find(cam => 
                cam.label.toLowerCase().includes(targetLabelUltra)
            );

            if (targetCamera) {
                preferredCamId = targetCamera.id; // Folosim ID-ul camerei
                console.log(`Găsit camera "ultra". Se folosește: ${targetCamera.label}`);
            } else {
                // 2. Căutăm "superangurlar"
                targetCamera = cameras.find(cam => 
                    cam.label.toLowerCase().includes(targetLabelSuper)
                );
                if (targetCamera) {
                    preferredCamId = targetCamera.id; // Folosim ID-ul camerei
                    console.log(`Găsit camera "superangurlar". Se folosește: ${targetCamera.label}`);
                } else {
                    // 3. Fallback: Căutăm ultima cameră de SPATE
                    const rearCameras = cameras.filter(cam => 
                        /rear|back|environment/i.test(cam.label) && 
                        !/front|user/i.test(cam.label)
                    );
                    
                    if (rearCameras.length > 0) {
                        targetCamera = rearCameras[rearCameras.length - 1]; // Folosim ultima
                        preferredCamId = targetCamera.id; // Folosim ID-ul camerei
                        console.log(`Nicio cameră "ultra" sau "superangurlar" găsită. Fallback la ultima cameră spate: ${targetCamera.label}`);
                    } else {
                        // 4. Fallback final (se va folosi { facingMode: "environment" })
                        console.log("Nicio cameră specifică găsită. Se folosește default 'environment'.");
                    }
                }
            }
        } else {
             console.warn("Nicio cameră nu a fost găsită. Se folosește default 'environment'.");
        }
        
    } catch (e) {
        console.error("Eroare la listarea camerelor, se folosește default 'environment'.", e);
    }
    // --- Sfârșit Logică Selectare Cameră ---

    const config = { fps: 10 };
    
    // Folosim ID-ul camerei preferate (string) sau obiectul de fallback
    html5QrCode.start(preferredCamId, config, onScanSuccess, onScanFailure)
        .catch(err => {
            console.warn(`Camera preferată (${JSON.stringify(preferredCamId)}) nu a putut fi pornită, se încearcă camera default:`, err);
            // Fallback la camera default (undefined)
            html5QrCode.start(undefined, config, onScanSuccess, onScanFailure)
                .catch(err2 => {
                    console.error("Eroare la pornirea scannerului (și pe default):", err2);
                    showToast("Nu s-a putut porni camera.", 3000);
                    stopScanner();
                });
        });
}
// --- FINAL MODIFICARE ---

function stopScanner() {
    const scannerContainer = document.getElementById('scanner-container');
    if (scannerContainer) scannerContainer.classList.add('hidden');
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Eroare la oprirea scannerului:", err));
    }
}

function initScannerHandler() {
    const closeScannerButton = document.getElementById('close-scanner-button');
    if (closeScannerButton) {
        closeScannerButton.addEventListener('click', stopScanner);
    }
    document.body.addEventListener('click', (e) => {
        const scanButton = e.target.closest('#footer-scan-trigger');
        if (scanButton) {
            e.preventDefault();
            startScanner();
        }
    });
}
// --- Final Logica Scanner-ului ---


// --- Inițializarea aplicației ---
document.addEventListener('DOMContentLoaded', () => {
    // Colectează toate elementele paginii
    document.querySelectorAll('[data-page]').forEach(page => {
        pages[page.dataset.page] = page;
    });

    // Încearcă reconectarea automată la imprimantă
    autoConnectToPrinter();
    
    // --- START FIX: Inițializează AMBELE handlere ---
    openSearchFunction = initSearchHandler(navigateTo); // Pentru Căutarea manuală
    initScannerHandler(); // Pentru Scanner-ul LPN
    // --- FINAL FIX ---

    // Adaugă listener global pentru butoanele de navigație [data-nav] (ex: footere)
    document.body.addEventListener('click', (e) => {
        const navButton = e.target.closest('[data-nav]');
        if (navButton) {
            e.preventDefault();
            const targetPage = navButton.dataset.nav;
            navigateTo(targetPage);
        }
    });

    // Gestionează navigarea prin butoanele back/forward ale browser-ului
    window.addEventListener('hashchange', handleHashChange);
    
    // Încarcă pagina inițială
    handleHashChange();
});
