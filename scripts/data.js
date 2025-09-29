// scripts/data.js

// --- CONFIGURARE WEBHOOKS ---
const DATA_FETCH_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/5a447557-8d52-463e-8a26-5902ccee8177';
const PRODUCT_DETAILS_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/f1bb3c1c-3730-4672-b989-b3e73b911043';
const STOCK_UPDATE_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/147557e0-e23d-470c-af50-ddc3c724dff8';
const PENDING_DELTAS_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/07cb7f77-1737-4345-b840-3c610100a34b';

// --- STOCAREA STĂRII APLICAȚIEI ---
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

// --- FUNCȚII PRIVATE ---
function _transformRawData(rawData) {
    return Object.keys(rawData).map(commandId => {
        const products = rawData[commandId] || [];
        const transformedProducts = products.map(product => ({
            id: product.productsku,
            asin: product.asin,
            name: 'Încărcare...',
            imageUrl: '',
            expected: product.orderedquantity || 0,
            baseFound: (product.bncondition || 0) + (product.vgcondition || 0) + (product.gcondition || 0) + (product.broken || 0),
            baseState: {
                'new': product.bncondition || 0,
                'very-good': product.vgcondition || 0,
                'good': product.gcondition || 0,
                'broken': product.broken || 0
            },
            found: 0,
            state: { 'new': 0, 'very-good': 0, 'good': 0, 'broken': 0 }
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

async function _fetchAndProcessDeltas(commandId) {
    const response = await fetch(PENDING_DELTAS_WEBHOOK_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error(`Delta Webhook failed: ${response.status}`);
    
    const rawDeltas = await response.json();
    
    // =================================================================
    // AICI ESTE MODIFICAREA: AFIȘEAZĂ RĂSPUNSUL BRUT ÎN CONSOLĂ
    console.log("RAW DELTA RESPONSE FROM SERVER:", JSON.stringify(rawDeltas, null, 2));
    // =================================================================

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
}

// --- FUNCȚII PUBLICE ---

export async function syncStateWithServer() {
    const accessCode = sessionStorage.getItem('lastAccessCode');
    if (!accessCode) return false;

    try {
        const baseResponse = await fetch(DATA_FETCH_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ code: accessCode }),
        });
        if (!baseResponse.ok) throw new Error(`Base data fetch failed`);
        const baseData = await baseResponse.json();
        if (baseData.status !== 'success' || !baseData.data) throw new Error('Invalid base data');
        
        let commands = _transformRawData(baseData.data);

        for (const command of commands) {
            const deltasForCommand = await _fetchAndProcessDeltas(command.id);
            for (const product of command.products) {
                const productDeltas = deltasForCommand[product.asin] || {};
                
                let totalFound = 0;
                const finalState = {};
                for (const condition in product.baseState) {
                    const baseValue = product.baseState[condition];
                    const deltaValue = productDeltas[condition] || 0;
                    const finalValue = baseValue + deltaValue;
                    
                    finalState[condition] = finalValue;
                    totalFound += finalValue;
                }
                
                product.state = finalState;
                product.found = totalFound;
            }
        }
        
        AppState.setCommands(commands);
        console.log("State synchronized successfully with server.", AppState.getCommands());
        return true;

    } catch (error) {
        console.error('Full state synchronization failed, keeping existing state:', error);
        return false;
    }
}

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

        if (!response.ok) throw new Error(`Webhook response was not ok`);
        
        console.log("Webhook update successful:", await response.json());
        return true;
    } catch (error) {
        console.error('Failed to send update to webhook:', error);
        return false;
    }
}

export async function fetchProductDetailsInBulk(asins) {
    const results = {};
    const asinsToFetch = [];

    for (const asin of asins) {
        const cachedData = sessionStorage.getItem(`product_${asin}`);
        if (cachedData) {
            results[asin] = JSON.parse(cachedData);
        } else {
            asinsToFetch.push(asin);
        }
    }

    if (asinsToFetch.length === 0) return results;

    try {
        const response = await fetch(PRODUCT_DETAILS_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asins: asinsToFetch }),
        });
        if (!response.ok) throw new Error(`Network response was not ok`);
        
        const responseData = await response.json();
        const bulkData = responseData.products || (Array.isArray(responseData) && responseData[0]?.products) || {};

        for (const asin of asinsToFetch) {
            const productData = bulkData[asin] || { title: 'Nume indisponibil', images: [] };
            sessionStorage.setItem(`product_${asin}`, JSON.stringify(productData));
            results[asin] = productData;
        }
    } catch (error) {
        console.error('Eroare la preluarea detaliilor produselor (bulk):', error);
        for (const asin of asinsToFetch) {
            results[asin] = { title: 'Eroare la încărcare', images: [] };
        }
    }
    
    return results;
}

export { AppState };
