// scripts/printer.js
import { connectToPrinter, isPrinterConnected } from './printer-service.js';

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

    // Callback pentru a primi actualizări de stare de la serviciu
    const statusCallback = (message) => {
        const isConnected = isPrinterConnected();
        updateUI(message, isConnected);
    };
    
    connectBtn.addEventListener('click', async () => {
        connectBtn.disabled = true;
        const success = await connectToPrinter(statusCallback);

        if (success) {
             const redirectUrl = sessionStorage.getItem('redirectAfterPrint');
            if (redirectUrl) {
                sessionStorage.removeItem('redirectAfterPrint');
                window.location.href = redirectUrl;
            }
        }
    });

    // Starea initiala a UI-ului
    if (isPrinterConnected()) {
        updateUI("Conectat", true);
    } else {
        updateUI("Apasă pentru a te conecta", false);
    }
});
