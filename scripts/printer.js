// --- COD SPECIAL PENTRU A DESCOPERI ADRESA (UUID-ul) SERVICIULUI ---

const connectBtn = document.getElementById('connect-btn');
const statusP = document.getElementById('status');

// Această funcție se conectează și afișează serviciile găsite
async function connectAndDiscover() {
    // Verificăm dacă browser-ul suportă Web Bluetooth
    if (!navigator.bluetooth) {
        alert("EROARE: Acest browser nu suportă Web Bluetooth.");
        return;
    }

    try {
        statusP.textContent = "Se deschide meniul Bluetooth. Alege imprimanta.";
        
        // Pasul 1: Selectăm dispozitivul
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true
        });

        statusP.textContent = `Dispozitiv selectat: ${device.name}. Se conectează...`;
        
        // Pasul 2: Ne conectăm la el
        const server = await device.gatt.connect();
        
        statusP.textContent = "Conectat! Se citesc serviciile...";

        // Pasul 3: Cerem lista TUTUROR serviciilor
        const services = await server.getPrimaryServices();

        if (!services || services.length === 0) {
            alert("EROARE: Nu am găsit niciun serviciu Bluetooth pe acest dispozitiv după conectare.");
            statusP.textContent = "Eroare: Niciun serviciu găsit.";
            server.disconnect();
            return;
        }

        // Pasul 4: Construim și afișăm lista de servicii într-o alertă
        let servicesMessage = "SUCCES! Am găsit următoarele servicii:\n\n";
        for (const service of services) {
            servicesMessage += service.uuid + "\n";
        }
        
        alert(servicesMessage); // Aceasta este informația crucială!

        server.disconnect();
        statusP.textContent = "Diagnosticare finalizată. Verifică alerta.";

    } catch (error) {
        statusP.textContent = `A apărut o eroare: ${error.message}`;
        alert(`A apărut o eroare: ${error.message}`);
    }
}

// Legăm butonul de funcția de diagnosticare
connectBtn.addEventListener('click', connectAndDiscover);

// Dezactivăm funcționalitatea de imprimare
document.getElementById('print-btn').disabled = true;
