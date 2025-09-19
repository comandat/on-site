// scripts/data.js

// Functie pentru a prelua datele comenzilor din localStorage
export function getCommandsData() {
    const data = localStorage.getItem('commandsData');
    return data ? JSON.parse(data) : [];
}

// Functie pentru a salva toate datele comenzilor in localStorage
export function saveCommandsData(data) {
    localStorage.setItem('commandsData', JSON.stringify(data));
}

// Functie pentru a prelua o comanda specifica dupa ID
export function getCommandById(commandId) {
    const commands = getCommandsData();
    return commands.find(c => c.id === commandId);
}

// Functie pentru a prelua un produs specific dintr-o comanda
export function getProductById(commandId, productId) {
    const command = getCommandById(commandId);
    return command ? command.products.find(p => p.id === productId) : null;
}

// Functie pentru a actualiza starea unui produs si a salva
export function updateProductState(commandId, productId, newState) {
    const allCommands = getCommandsData();
    const commandIndex = allCommands.findIndex(c => c.id === commandId);
    if (commandIndex > -1) {
        const productIndex = allCommands[commandIndex].products.findIndex(p => p.id === productId);
        if (productIndex > -1) {
            allCommands[commandIndex].products[productIndex].state = newState;
            // Recalculam totalul gasit
            const totalFound = Object.values(newState).reduce((a, b) => a + b, 0);
            allCommands[commandIndex].products[productIndex].found = totalFound;
        }
    }
    saveCommandsData(allCommands);
}
// Functie pentru a prelua detalii (titlu, imagine) de la webhook
export async function fetchProductDetails(asin) {
    // Verificam daca avem deja datele in cache pentru a nu face request-uri inutile
    const cachedData = sessionStorage.getItem(`product_${asin}`);
    if (cachedData) {
        return JSON.parse(cachedData);
    }

    const webhookUrl = 'https://automatizare.comandat.ro/webhook/f1bb3c1c-3730-4672-b989-b3e73b911043';
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asin: asin }),
        });
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        
        // Salvam datele in sessionStorage pentru a le reutiliza
        sessionStorage.setItem(`product_${asin}`, JSON.stringify(data));

        return data;
    } catch (error) {
        console.error('Eroare la preluarea detaliilor produsului:', error);
        // Returnam valori default in caz de eroare
        return { title: 'Nume indisponibil', images: [''] }; 
    }
}
