// --- COD SPECIAL DE DEPANARE PENTRU A DESCOPERI SERVICIILE ---

const connectBtn = document.getElementById('connect-btn');
const statusP = document.getElementById('status');

// Funcția de conectare a fost modificată pentru a afișa serviciile disponibile
async function discoverServices() {
    try {
        statusP.textContent = 'Pas 1: Se deschide meniul Bluetooth...';
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true
            // Am scos optionalServices pentru a fi siguri că nu filtrează nimic
        });

        statusP.textContent = `Pas 2: Dispozitiv selectat: ${device.name || 'necunoscut'}`;
        const server = await device.gatt.connect();
        
        statusP.textContent = 'Pas 3: Conectat. Se caută TOATE serviciile...';
        
        // Aici este partea importantă: cerem TOATE serviciile, nu unul anume
        const services = await server.getPrimaryServices();

        if (!services || services.length === 0) {
            statusP.textContent = "Eroare: Nu am găsit niciun serviciu pe acest dispozitiv.";
            alert("EROARE: Nu am găsit niciun serviciu pe acest dispozitiv.");
            return;
        }

        // Construim un mesaj cu toate UUID-urile serviciilor găsite
        let availableServicesMessage = "SUCCES! Servicii găsite:\n\n";
        for (const service of services) {
            availableServicesMessage += service.uuid + "\n";
        }

        // Afișăm mesajul într-o alertă pentru a fi siguri că îl vezi
        statusP.textContent = 'Pas 4: Servicii găsite! Vezi alerta.';
        alert(availableServicesMessage);

        // Odată ce ai copiat UUID-urile, ne putem deconecta
        server.disconnect();
        statusP.textContent = 'Descoperire finalizată. Poți închide pagina.';

    } catch (error) {
        statusP.textContent = `Eroare: ${error.message}`;
        alert(`A apărut o eroare: ${error.message}`);
    }
}

// Am legat butonul de noua funcție
connectBtn.addEventListener('click', discoverServices);

// Am dezactivat restul funcționalităților temporar
document.getElementById('print-btn').disabled = true;
