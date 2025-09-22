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

/**
 * VERSIUNE DE DEBUG: Preia detalii si afiseaza in consola raspunsul primit.
 * @param {string[]} asins - Un array de coduri ASIN.
 * @returns {Promise<Object>} Un obiect unde cheile sunt ASIN-urile si valorile sunt detaliile produselor.
 */
export async function fetchProductDetailsInBulk(asins) {
    const webhookUrl = 'https://automatizare.comandat.ro/webhook/f1bb3c1c-3730-4672-b989-b3e73b911043';
    const results = {};
    const asinsToFetch = [];

    // Pas 1: Verificam ce avem deja in cache
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
        
        // --- LOGARE PENTRU DEBUG ---
        const rawText = await response.text();
        console.log("--- Răspuns Brut de la Server (Text) ---");
        console.log(rawText);
        // --- SFÂRȘIT LOGARE ---

        const responseData = JSON.parse(rawText); // Parsam textul brut
        
        console.log("--- Răspuns de la Server (Parsat ca JSON) ---");
        console.log(responseData);

        const bulkData = (Array.isArray(responseData) && responseData.length > 0 && responseData[0].products) 
                         ? responseData[0].products 
                         : {};

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
