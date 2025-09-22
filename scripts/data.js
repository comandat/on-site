// scripts/data.js

// Functiile getCommandsData, saveCommandsData, etc. raman la fel...
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
 * NOU: Preia detalii pentru mai multe produse printr-un singur request.
 * @param {string[]} asins - Un array de coduri ASIN.
 * @returns {Promise<Object>} Un obiect unde cheile sunt ASIN-urile si valorile sunt detaliile produselor.
 */
export async function fetchProductDetailsInBulk(asins) {
    const webhookUrl = 'https://automatizare.comandat.ro/webhook/f1bb3c1c-3730-4672-b989-b3e73b911043';
    const results = {};
    const asinsToFetch = [];

    // Pas 1: Verificam ce avem deja in cache pentru a fi eficienti
    for (const asin of asins) {
        const cachedData = sessionStorage.getItem(`product_${asin}`);
        if (cachedData) {
            results[asin] = JSON.parse(cachedData);
        } else {
            asinsToFetch.push(asin);
        }
    }

    // Pas 2: Daca avem ASIN-uri noi de preluat, facem un singur request pentru ele
    if (asinsToFetch.length > 0) {
        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // ATENTIE: Trimitem un obiect cu o cheie "asins" care contine array-ul
                body: JSON.stringify({ asins: asinsToFetch }),
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            // Raspunsul de la n8n trebuie sa fie un obiect de tipul: { "ASIN1": {...}, "ASIN2": {...} }
            const bulkData = await response.json();

            // Pas 3: Procesam raspunsul si actualizam cache-ul
            for (const asin of asinsToFetch) {
                const productData = bulkData[asin] || { title: 'Nume indisponibil', images: [''] };
                sessionStorage.setItem(`product_${asin}`, JSON.stringify(productData));
                results[asin] = productData;
            }

        } catch (error) {
            console.error('Eroare la preluarea detaliilor produselor (bulk):', error);
            // Pentru ASIN-urile care au esuat, punem date default pentru a nu bloca interfata
            for (const asin of asinsToFetch) {
                results[asin] = { title: 'Nume indisponibil', images: [''] };
            }
        }
    }
    return results;
}

// Functia veche (fetchProductDetails) nu mai este folosita in products.js,
// dar o lasam aici in cazul in care e necesara pe pagina de detaliu a produsului.
// Daca vrei, o poti sterge sau adapta sa foloseasca noul format.
export async function fetchProductDetails(asin) {
    // Pur si simplu apeleaza noua functie cu un singur element
    const results = await fetchProductDetailsInBulk([asin]);
    return results[asin];
}
