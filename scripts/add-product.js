// scripts/add-product.js
import { AppState } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-product-form');
    const asinInput = document.getElementById('asin-input');
    const countrySelect = document.getElementById('country-select'); // Adăugat
    const commandSelect = document.getElementById('command-select');
    const insertButton = document.getElementById('insert-button');
    const buttonText = insertButton.querySelector('.button-text');
    const buttonLoader = insertButton.querySelector('.button-loader');
    const statusMessage = document.getElementById('status-message');

    const ADD_PRODUCT_WEBHOOK_URL = 'https://automatizare.comandat.ro/webhook/830c352e-a708-4f6e-873a-941574326b82';

    // 1. Populează lista de comenzi
    function populateCommandsList() {
        const commands = AppState.getCommands();
        commandSelect.innerHTML = ''; // Curăță mesajul "Se încarcă..."

        if (!commands || commands.length === 0) {
            commandSelect.innerHTML = '<option value="">Nu există comenzi</option>';
            commandSelect.disabled = true;
            return;
        }

        commandSelect.innerHTML = '<option value="">Alege o comandă...</option>';
        commands.forEach(command => {
            const option = document.createElement('option');
            option.value = command.id;
            option.textContent = command.name;
            commandSelect.appendChild(option);
        });
    }

    // 2. Gestionează trimiterea formularului
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const asin = asinInput.value.trim();
        const country = countrySelect.value; // Adăugat
        const orderId = commandSelect.value;

        if (!asin || !orderId || !country) { // Modificat
            statusMessage.textContent = 'Te rugăm să completezi toate câmpurile.'; // Modificat
            statusMessage.className = 'text-red-600 text-center text-sm font-medium';
            return;
        }

        // Blochează butonul
        insertButton.disabled = true;
        buttonText.classList.add('hidden');
        buttonLoader.classList.remove('hidden');
        statusMessage.textContent = 'Se inserează...';
        statusMessage.className = 'text-gray-500 text-center text-sm font-medium';

        try {
            const payload = {
                asin: asin,
                orderId: orderId,
                country: country // Adăugat
            };

            const response = await fetch(ADD_PRODUCT_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Eroare HTTP: ${response.status}`);
            }
            
            const result = await response.json();

            if (result.status === 'success') {
                statusMessage.textContent = 'Produsul a fost inserat cu succes!';
                statusMessage.className = 'text-green-600 text-center text-sm font-medium';
                asinInput.value = ''; // Golește câmpul ASIN
                countrySelect.selectedIndex = 0; // Resetează selectul de țară
                commandSelect.selectedIndex = 0; // Resetează selectul de comandă
            } else {
                throw new Error(result.message || 'Eroare necunoscută de la server.');
            }

        } catch (error) {
            console.error('Eroare la inserarea produsului:', error);
            statusMessage.textContent = 'Eroare la inserare. Verifică consola.';
            statusMessage.className = 'text-red-600 text-center text-sm font-medium';
        } finally {
            // Deblochează butonul
            insertButton.disabled = false;
            buttonText.classList.remove('hidden');
            buttonLoader.classList.add('hidden');
        }
    });

    // Inițializează pagina
    populateCommandsList();
});
