// scripts/data.js

// --- CONFIGURARE WEBHOOKS ---
const DATA_FETCH_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/5a447557-8d52-463e-8a26-5902ccee8177';
const PRODUCT_DETAILS_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/f1bb3c1c-3730-4672-b989-b3e73b911043';
const STOCK_UPDATE_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/147557e0-e23d-470c-af50-ddc3c724dff8';
const PENDING_DELTAS_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/07cb7f77-1737-4345-b840-3c610100a34b';

// --- STOCAREA STĂRII APLICAȚIEI ---

// Stocăm datele în `sessionStorage` pentru a persista între pagini, dar a se șterge la închiderea tab-ului.
// `localStorage` este folosit doar pentru datele de bază la login.

const AppState = {
    getCommands: () => JSON.parse(sessionStorage.getItem('liveCommandsData') || '[]'),
    setCommands: (commands) => sessionStorage.setItem('liveCommandsData', JSON.stringify(commands)),
    getCommandById: (commandId) => AppState.getCommands().find(c => c.id === commandId),
    getProductById: (commandId, productId) => {
        const command = AppState.getCommandById(commandId);
        return command ? command.products.find(p => p.id === productId) : null;
    },
    updateProductState: (commandId, productId, newState) => {
        const commands = AppState.getCommands();
        const commandIndex = commands.findIndex(c => c.id === commandId);
        if (commandIndex === -1) return;

        const productIndex = commands[commandIndex].products.findIndex(p => p.id === productId);
        if (productIndex === -1) return;

        commands[commandIndex].products[productIndex].state = newState;
        commands[commandIndex].products[productIndex].found = Object.values(newState).reduce((a, b) => a + b, 0);
        
        AppState.setCommands(commands);
    }
};

// --- FUNCȚII PRIVATE (Logica Internă) ---

/**
 * Transformă datele brute de la server în structura de care avem nevoie în aplicație.
 */
function _transformRawData(rawData) {
    return Object.keys(rawData).map(commandId => {
        const products = rawData[commandId] || [];
        const transformedProducts = products.map(product => ({
            id: product.productsku,
            asin: product.asin,
            name: 'Încărcare...',
            imageUrl: '',
            expected: product.orderedquantity || 0,
            found: (product.bncondition || 0) + (product.vgcondition || 0) + (product.gcondition || 0) + (product.broken || 0),
            state: {
                'new': product.bncondition || 0,
                'very-good': product.vgcondition || 0,
                'good': product.gcondition || 0,
                'broken': product.broken || 0
            }
        }));
        return {
            id: commandId,
            name: `Comanda #${commandId.substring(0, 12)}`,
            date: new Date().toLocaleDateString('ro-RO'),
            status: 'În Pregatire',
            products: transformedProducts
        };
    });
}

/**
 * Prelucrează delta-urile (modificările neînregistrate) de la server.
 * @returns {Object} Un obiect unde cheia este ASIN-ul și valoarea este un obiect cu modificările pe condiții.
 * ex: { "ASIN123": { "new": 1, "good": -1 }, "ASIN456": { "broken": 2 } }
 */
async function _fetchAndProcessDeltas(commandId) {
    try {
        const response = await fetch(PENDING_DELTAS_WEBHOOK_URL, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) throw new Error(`Delta Webhook failed: ${response.status}`);
        
        const rawDeltas = await response.json();
        const processedDeltas = {};

        const relevantDeltas = Array.isArray(rawDeltas) 
            ? rawDeltas.filter(item => item.command_id === commandId) 
            : (rawDeltas && rawDeltas.command_id === commandId ? [rawDeltas] : []);

        for (const item of relevantDeltas) {
            if (!processedDeltas[item.asin]) {
                processedDeltas[item.asin] = {};
            }
            const changeValue = parseInt(item.change_value, 10);
            processedDeltas[item.asin][item.condition] = (processedDeltas[item.asin][item.condition] || 0) + changeValue;
        }
        return processedDeltas;

    } catch (error) {
        console.error('Error fetching or processing deltas:', error);
        return {}; // Returnează un obiect gol în caz de eroare
    }
}


// --- FUNCȚII PUBLICE (Exportate pentru a fi folosite în pagini) ---

/**
 * FUNCȚIA CHEIE: Sincronizează complet starea locală cu serverul.
 * Prelucrează datele de bază, apoi preia modificările (delta) și le aplică pentru a obține starea "live".
 * @returns {boolean} True dacă sincronizarea a reușit, false altfel.
 */
export async function syncStateWithServer() {
    const accessCode = sessionStorage.getItem('lastAccessCode');
    if (!accessCode) {
        console.error("Sync failed: Access code is missing.");
        return false;
    }

    try {
        // Pas 1: Preluarea datelor de bază (din PostgreSQL)
        const baseResponse = await fetch(DATA_FETCH_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ code: accessCode }),
        });
        if (!baseResponse.ok) throw new Error(`Base data fetch failed: ${baseResponse.status}`);
        const baseData = await baseResponse.json();
        if (baseData.status !== 'success' || !baseData.data) throw new Error('Invalid base data response.');
        
        let liveCommands = _transformRawData(baseData.data);

        // Pas 2: Preluarea și aplicarea deltas pentru fiecare comandă
        for (const command of liveCommands) {
            const deltasForCommand = await _fetchAndProcessDeltas(command.id);
            for (const product of command.products) {
                if (deltasForCommand[product.asin]) {
                    const productDeltas = deltasForCommand[product.asin];
                    let totalFound = 0;
                    for (const condition in product.state) {
                        product.state[condition] += (productDeltas[condition] || 0);
                        totalFound += product.state[condition];
                    }
                    product.found = totalFound;
                }
            }
        }
        
        // Pas 3: Salvarea stării "live" finale în sessionStorage
        AppState.setCommands(liveCommands);
        console.log("State synchronized successfully with server.", AppState.getCommands());
        return true;

    } catch (error) {
        console.error('Full state synchronization failed:', error);
        return false;
    }
}

/**
 * Trimite o actualizare de stoc la server (în tabela "unlogged").
 * @param {string} commandId - ID-ul comenzii
 * @param {string} productAsin - ASIN-ul produsului
 * @param {object} stockDelta - Obiect cu modificările. Ex: { "new": 1, "good": -1 }
 * @returns {boolean} True dacă a reușit, false dacă a eșuat.
 */
export async function sendStockUpdate(commandId, productAsin, stockDelta) {
    try {
        const response = await fetch(STOCK_UPDATE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                commandId: commandId,
                asin: productAsin,
                ...stockDelta
            })
        });

        if (!response.ok) {
            throw new Error(`Webhook response was not ok: ${response.statusText}`);
        }
        
        console.log("Webhook update successful:", await response.json());
        return true;
    } catch (error) {
        console.error('Failed to send update to webhook:', error);
        return false;
    }
}

/**
 * Prelucrează detaliile (nume, imagini) pentru o listă de ASIN-uri.
 * Folosește un cache în sessionStorage pentru a minimiza request-urile.
 */
export async function fetchProductDetailsInBulk(asins) {
    const results = {};
    const asinsToFetch = [];

    // Verifică ce avem deja în cache
    for (const asin of asins) {
        const cachedData = sessionStorage.getItem(`product_${asin}`);
        if (cachedData) {
            results[asin] = JSON.parse(cachedData);
        } else {
            asinsToFetch.push(asin);
        }
    }

    if (asinsToFetch.length === 0) return results;

    // Prelucrează ce nu este în cache
    try {
        const response = await fetch(PRODUCT_DETAILS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asins: asinsToFetch }),
        });
        if (!response.ok) throw new Error(`Network response was not ok`);
        
        const responseData = await response.json();
        // Gestionează diverse formate de răspuns de la server
        const bulkData = responseData.products || (Array.isArray(responseData) && responseData[0]?.products) || {};

        for (const asin of asinsToFetch) {
            const productData = bulkData[asin] || { title: 'Nume indisponibil', images: [] };
            sessionStorage.setItem(`product_${asin}`, JSON.stringify(productData));
            results[asin] = productData;
        }
    } catch (error) {
        console.error('Eroare la preluarea detaliilor produselor (bulk):', error);
        for (const asin of asinsToFetch) {
            results[asin] = { title: 'Eroare la încărcare', images: [] }; // Marchează ca eroare
        }
    }
    
    return results;
}

// Exportă obiectul AppState pentru a oferi acces direct la datele live
export { AppState };
