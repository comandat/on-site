// --- COD SPECIAL PENTRU A AFIȘA UUID-URILE DIRECT PE PAGINĂ ---

const connectBtn = document.getElementById('connect-btn');
const statusP = document.getElementById('status');

// Funcția se conectează și afișează serviciile găsite pe pagină
async function discoverAndDisplayServices() {
    try {
        statusP.textContent = "Pas 1: Se deschide meniul Bluetooth. Alege imprimanta.";
        
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true
        });

        statusP.textContent = `Pas 2: Dispozitiv selectat. Se conectează...`;
        
        const server = await device.gatt.connect();
        
        statusP.textContent = "Pas 3: Conectat! Se citesc serviciile...";

        const services = await server.getPrimaryServices();

        if (!services || services.length === 0) {
            statusP.innerHTML = "<b>EROARE:</b> Nu am găsit niciun serviciu Bluetooth pe acest dispozitiv.";
            server.disconnect();
            return;
        }

        // --- PARTEA IMPORTANTĂ ---
        // Construim un text HTML cu rezultatele
        let reportHTML = "<b>SUCCES! Copiază textul de mai jos și trimite-l:</b><br><br>";
        
        // Adăugăm fiecare UUID găsit în text
        for (const service of services) {
            reportHTML += service.uuid + "<br>";
        }

        // Afișăm textul direct în elementul de status de pe pagină
        statusP.innerHTML = reportHTML;

        server.disconnect();

    } catch (error) {
        statusP.innerHTML = `<b>EROARE:</b> ${error.message}`;
    }
}

// Legăm butonul de noua funcție
connectBtn.addEventListener('click', discoverAndDisplayServices);

// Dezactivăm funcționalitatea de imprimare
document.getElementById('print-btn').disabled = true;
