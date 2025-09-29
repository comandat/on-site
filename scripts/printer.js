// scripts/printer.js
import { connectToPrinter, isPrinterConnected, printLabelQueue } from './printer-service.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const connectBtn = document.getElementById('connect-btn');
    const statusP = document.getElementById('status');
    const connectionDot = document.getElementById('connection-dot');
    const connectionText = document.getElementById('connection-text');

    function updateUI(statusMessage, isConnected) {
        statusP.textContent = statusMessage;
        if (isConnected) {
            connectionDot.classList.remove('bg-gray-400');
            connectionDot.classList.add('bg-green-500');
            connectionText.textContent = 'Conectat';
            connectBtn.textContent = 'Conectat';
            connectBtn.disabled = true;
        } else {
            connectionDot.classList.remove('bg-green-500');
            connectionDot.classList.add('bg-gray-400');
            connectionText.textContent = 'Deconectat';
            connectBtn.textContent = 'Caută Imprimantă';
            connectBtn.disabled = false;
        }
    }

    const statusCallback = (message) => {
        const isConnected = isPrinterConnected();
        updateUI(message, isConnected);
    };
    
    connectBtn.addEventListener('click', async () => {
        connectBtn.disabled = true;
        await connectToPrinter(statusCallback);
    });

    // Starea initiala a UI-ului
    if (isPrinterConnected()) {
        updateUI("Conectat", true);
    } else {
        updateUI("Apasă pentru a te conecta", false);
    }

    // Daca am fost redirectionati aici cu o coada de printare in asteptare
    const pendingQueueRaw = sessionStorage.getItem('pendingPrintQueue');
    if(pendingQueueRaw){
        sessionStorage.removeItem('pendingPrintQueue');
        const queue = JSON.parse(pendingQueueRaw);
        
        // Conecteaza-te si printeaza
        connectBtn.click(); // Simuleaza click pentru a deschide fereastra de selectie
        // Ar fi ideal sa asteptam conexiunea si sa printam, dar experienta e mai buna asa
        // utilizatorul trebuie sa selecteze imprimanta si apoi sa apese print manual
        // Pentru a printa automat, ar trebui sa schimbam fluxul in printer-service
        // momentan, lasam asa pentru simplitate. Utilizatorul va trebui sa navigheze inapoi.
    }
});
