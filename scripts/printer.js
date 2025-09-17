// --- COD DE DIAGNOSTICARE FINAL (v2) - GĂSEȘTE CARACTERISTICILE ---

const connectBtn = document.getElementById('connect-btn');
const statusP = document.getElementById('status');

// Folosim UUID-ul de Serviciu pe care l-am confirmat că este corect
const CORRECT_SERVICE_UUID = '49535343-fe7d-4ae5-8fa9-9fafd205e455';

async function discoverCharacteristics() {
    try {
        statusP.textContent = "Pas 1: Se caută imprimanta cu serviciul corect...";
        
        // Căutăm direct imprimanta care are serviciul confirmat
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [CORRECT_SERVICE_UUID] }]
        });

        statusP.textContent = `Pas 2: Dispozitiv găsit: ${device.name}. Se conectează...`;
        const server = await device.gatt.connect();
        
        statusP.textContent = "Pas 3: Conectat! Se accesează serviciul...";
        const service = await server.getPrimaryService(CORRECT_SERVICE_UUID);
        
        statusP.textContent = "Pas 4: Serviciu accesat! Se citesc TOATE caracteristicile...";

        // Acum cerem lista TUTUROR caracteristicilor de pe acest serviciu
        const characteristics = await service.getCharacteristics();

        if (!characteristics || characteristics.length === 0) {
            statusP.innerHTML = "<b>EROARE:</b> Am găsit serviciul, dar nu conține nicio caracteristică.";
            server.disconnect();
            return;
        }

        // Construim raportul final
        let reportHTML = "<b>SUCCES! Copiază și trimite tot acest text:</b><br><br>";
        reportHTML += `<b>Serviciu: ${service.uuid}</b><br>`;
        
        for (const char of characteristics) {
            let props = [];
            if (char.properties.read) props.push('CITIRE (READ)');
            if (char.properties.write) props.push('SCRIERE (WRITE)');
            if (char.properties.writeWithoutResponse) props.push('SCRIERE FĂRĂ RĂSPUNS (WRITE NO RESP)');
            if (char.properties.notify) props.push('NOTIFICARE (NOTIFY)');
            
            reportHTML += `<br><b>- Caracteristică:</b> ${char.uuid}<br>`;
            reportHTML += `  <i>Proprietăți: ${props.join(', ')}</i><br>`;
        }

        statusP.innerHTML = reportHTML;
        server.disconnect();

    } catch (error) {
        statusP.innerHTML = `<b>EROARE:</b> ${error.message}`;
    }
}

// Legăm butonul de noua funcție
connectBtn.addEventListener('click', discoverCharacteristics);


document.addEventListener('DOMContentLoaded', () => {
    const versionElement = document.getElementById('script-version');
    if (versionElement) {
        versionElement.textContent = 'v2';
    }
});
