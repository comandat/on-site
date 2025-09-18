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
