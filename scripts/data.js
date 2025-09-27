// scripts/data.js

// Functiile getCommandsData, saveCommandsData, etc. raman neschimbate.
export function getCommandsData() {
    const data = localStorage.getItem('commandsData');
    return data ? JSON.parse(data) : [];
}
export function saveCommandsData(data) {
    localStorage.setItem('commandsData', JSON.stringify(data));
}
export function getCommandById(commandId) {
    const commands = getCommandsData();
    return commands.find(c => c.id === commandId);
}
export function getProductById(commandId, productId) {
    const command = getCommandById(commandId);
    return command ? command.products.find(p => p.id === productId) : null;
}
export function updateProductState(commandId, productId, newState) {
    const allCommands = getCommandsData();
    const commandIndex = allCommands.findIndex(c => c.id === commandId);
    if (commandIndex > -1) {
        const productIndex = allCommands[commandIndex].products.findIndex(p => p.id === productId);
        if (productIndex > -1) {
            allCommands[commandIndex].products[productIndex].state = newState;
            const totalFound = Object.values(newState).reduce((a, b) => a + b, 0);
            allCommands[commandIndex].products[productIndex].found = totalFound;
        }
    }
    saveCommandsData(allCommands);
}

// NOU: Functia transformData mutata din login.js si exportata
export const transformData = (rawData) => {
    return Object.keys(rawData).map(commandId => {
        const products = rawData[commandId] || [];
        
        const transformedProducts = products.map(product => {
            return {
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
            };
        });

        return {
            id: commandId,
            name: `Comanda #${commandId.substring(0, 12)}`,
            date: new Date().toLocaleDateString('ro-RO'),
            status: 'În Pregatire',
            products: transformedProducts
        };
    });
};

/**
 * Prelucrează delta-urile de stoc pendinte de pe server (GET) și le agreghează local.
 */
export async function fetchPendingDeltas(commandId, asin) {
    const deltaWebhookUrl = 'https://automatizare.comandat.ro/webhook/07cb7f77-1737-4345-b840-3c610100a34b'; 
    
    try {
        const response = await fetch(deltaWebhookUrl, {
            method: 'GET', 
            headers: { 'Accept': 'application/json' },
        });

        // NOU: Logăm statusul răspunsului
        console.log(`Delta Webhook Status: ${response.status} ${response.statusText}`); 

        if (!response.ok) {
             const errorBody = await response.text();
             console.error('Delta Webhook Error Body:', errorBody);
             throw new Error(`Delta Webhook response was not ok: ${response.statusText || response.status}`);
        }

        const responseData = await response.json();
        
        // NOU: Logăm răspunsul primit de la webhook
        console.log('Delta Webhook Response Data:', responseData); 

        const deltas = {};
        if (Array.isArray(responseData)) {
            responseData
                .filter(item => item.command_id === commandId && item.asin === asin) 
                .forEach(item => {
                    const condition = item.condition;
                    const changeValue = parseInt(item.change_value, 10);
                    
                    deltas[condition] = (deltas[condition] || 0) + changeValue;
                });
        }
        
        return deltas;

    } catch (error) {
        console.error('Eroare la preluarea delta-urilor:', error);
        throw error; // Aruncăm eroarea din nou pentru a fi capturată de funcția apelantă
    }
}

/**
 * Sincronizează datele de bază (inclusiv stocul) cu serverul folosind noul webhook POST.
 */
export async function fetchAndSyncAllCommandsData() {
    const dataFetchWebhookUrl = 'https://automatizare.comandat.ro/webhook/5a447557-8d52-463e-8a26-5902ccee8177';
    const accessCode = sessionStorage.getItem('lastAccessCode');
    
    if (!accessCode) return false;

    try {
        // FOLOSIM POST cu text/plain pentru a evita preflight-ul CORS
        const response = await fetch(dataFetchWebhookUrl, {
            method: 'POST', 
            headers: { 'Content-Type': 'text/plain' }, 
            body: JSON.stringify({ code: accessCode }), // Trimitem codul în corpul POST
        });
        
        if (!response.ok) throw new Error(`Eroare de rețea la sincronizare: ${response.status}`);

        const responseData = await response.json();
        
        if (responseData && responseData.status === 'success' && responseData.data) {
            const transformedCommands = transformData(responseData.data);
            localStorage.setItem('commandsData', JSON.stringify(transformedCommands));
            return true;
        } else {
             return false;
        }

    } catch (error) {
        console.error('Eroare la sincronizarea datelor de bază:', error);
        return false;
    }
}

/**
 * VERSIUNEA FINALA SI ROBUSTA: Gestioneaza orice format de raspuns de la server.
 * @param {string[]} asins - Un array de coduri ASIN.
 * @returns {Promise<Object>} Un obiect unde cheile sunt ASIN-urile si valorile sunt detaliile produselor.
 */
export async function fetchProductDetailsInBulk(asins) {
    const webhookUrl = 'https://automatizare.comandat.ro/webhook/f1bb3c1c-3730-4672-b989-b3e73b911043';
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

    if (asinsToFetch.length === 0) {
        return results;
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asins: asinsToFetch }),
        });
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        
        const responseData = await response.json();
        
        // --- LOGICA UNIVERSALA ---
        let bulkData = {}; 
        
        if (Array.isArray(responseData)) {
            if (responseData.length > 0 && responseData[0] && responseData[0].products) {
                bulkData = responseData[0].products;
            }
        } else if (responseData && responseData.products) {
            bulkData = responseData.products;
        }

        // Procesarea finala ramane la fel
        for (const asin of asinsToFetch) {
            const productData = bulkData[asin] || { title: 'Nume indisponibil', images: [''] };
            sessionStorage.setItem(`product_${asin}`, JSON.stringify(productData));
            results[asin] = productData;
        }

    } catch (error) {
        console.error('Eroare la preluarea detaliilor produselor (bulk):', error);
        for (const asin of asinsToFetch) {
            results[asin] = { title: 'Nume indisponibil', images: [''] };
        }
    }
    
    return results;
}

// Functia fetchProductDetails ramane neschimbata
export async function fetchProductDetails(asin) {
    const results = await fetchProductDetailsInBulk([asin]);
    return results[asin];
}
