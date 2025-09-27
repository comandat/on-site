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

// NOU: Functia transformData mutata din login.js
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
    // URL-ul real al webhook-ului de citire delta (GET)
    const deltaWebhookUrl = 'https://automatizare.comandat.ro/webhook/07cb7f77-1737-4345-b840-3c610100a34b'; 
    
    try {
        // Folosim GET, dar trimitem parametrii în URL pentru filtrare pe server, deși nodul Postgres 
        // returnează toate datele. Vom menține logica de filtrare/agregare în frontend.
        const response = await fetch(deltaWebhookUrl, {
            method: 'GET', 
            headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`Delta Webhook response was not ok: ${response.statusText}`);
        }

        const responseData = await response.json();
        
        const deltas = {};
        if (Array.isArray(responseData)) {
            responseData
                .filter(item => item.command_id === commandId && item.asin === asin) // Filtrare pe comandă/produs
                .forEach(item => {
                    const condition = item.condition;
                    const changeValue = parseInt(item.change_value, 10);
                    
                    // Agregare locală
                    deltas[condition] = (deltas[condition] || 0) + changeValue;
                });
        }
        
        return deltas;

    } catch (error) {
        console.error('Eroare la preluarea delta-urilor:', error);
        return {};
    }
}

/**
 * Sincronizează datele de bază (inclusiv stocul) cu serverul folosind noul webhook.
 * REVENIM LA METODA POST pentru a rezolva Eroarea 500.
 */
export async function fetchAndSyncAllCommandsData() {
    // URL-ul noului webhook de extragere date
    const dataFetchWebhookUrl = 'https://automatizare.comandat.ro/webhook/5a447557-8d52-463e-8a26-5902ccee8177';
    const accessCode = sessionStorage.getItem('lastAccessCode');
    
    if (!accessCode) return false;

    try {
        // NOU: Revenim la POST, trimițând codul în corpul JSON.
        const response = await fetch(dataFetchWebhookUrl, {
            method: 'POST', // <-- MODIFICAT: POST
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: accessCode }), // <-- MODIFICAT: Corup JSON
        });
        
        // Dacă serverul are nevoie de 'text/plain', schimbați 'application/json' în 'text/plain'
        // și păstrați `body: JSON.stringify({ code: accessCode })`

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

// ... (fetchProductDetailsInBulk și fetchProductDetails rămân neschimbate) ...
// ... (restul codului) ...
