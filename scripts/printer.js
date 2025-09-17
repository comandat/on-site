// Variabilă globală pentru a reține conexiunea la caracteristica imprimantei
let niimbotCharacteristic = null;

// --- Funcțiile de bază pentru comunicarea cu imprimanta ---

/**
 * Creează un pachet de comandă formatat pentru imprimantele NIIMBOT.
 */
function createNiimbotPacket(type, data) {
    const dataBytes = Array.isArray(data) ? data : [data];
    const checksum = dataBytes.reduce((acc, byte) => acc ^ byte, type ^ dataBytes.length);
    const packet = [0x55, 0x55, type, dataBytes.length, ...dataBytes, checksum, 0xAA, 0xAA];
    return new Uint8Array(packet);
}

/**
 * Se conectează la imprimantă prin Web Bluetooth.
 */
async function connectToPrinter() {
    if (niimbotCharacteristic) {
        console.log("Deja conectat.");
        alert("Imprimanta este deja conectată.");
        return;
    }

    try {
        console.log('Se caută imprimante...');
        alert('Se caută imprimante... Aprobă fereastra de selecție.');

        const device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'NIIMBOT' }],
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
        });

        console.log('Conectare la serverul GATT...');
        const server = await device.gatt.connect();

        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        niimbotCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

        console.log(`Conectat la ${device.name}`);
        alert(`Conectat la imprimanta ${device.name}`);

        // Schimbă culoarea butonului pentru a indica starea de conectare
        document.getElementById('connect-printer-button').classList.add('text-green-400');

    } catch (error) {
        console.error("Eroare la conectare:", error);
        alert(`Eroare la conectare: ${error.message}`);
    }
}

/**
 * Generează o imagine (canvas) cu textul specificat.
 */
function createTextImage(text, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width; // 30 mm * 8 dots/mm = 240 dots
    canvas.height = height; // 15 mm * 8 dots/mm = 120 dots
    const ctx = canvas.getContext('2d');

    // Fundal alb
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    
    // Setări text
    ctx.fillStyle = 'black';
    ctx.font = 'bold 80px Arial'; // Font mare pentru a fi vizibil
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Desenează textul pe centru
    ctx.fillText(text, width / 2, height / 2);
    
    return canvas;
}

/**
 * Funcția principală care printează textul "1".
 */
async function printLabel() {
    if (!niimbotCharacteristic) {
        alert("Imprimanta nu este conectată. Apasă pe iconița de imprimantă pentru a te conecta.");
        return;
    }

    try {
        console.log("Încep procesul de imprimare...");

        // Generează o imagine 30x15mm (240x120 pixeli) cu textul "1"
        const canvas = createTextImage('1', 240, 120); 
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Procesează imaginea pentru imprimantă
        const imagePackets = [];
        const widthInBytes = Math.ceil(canvas.width / 8);

        for (let y = 0; y < canvas.height; y++) {
            let lineBytes = new Uint8Array(widthInBytes);
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                const pixelValue = imageData.data[pixelIndex] < 128 ? 1 : 0; // 1 pentru negru, 0 pentru alb (canvas-ul nu e inversat)
                if (pixelValue === 1) {
                    lineBytes[Math.floor(x / 8)] |= (1 << (7 - (x % 8)));
                }
            }
            const header = [(y >> 8) & 0xFF, y & 0xFF, 0, 0, 0, 1];
            const packetData = new Uint8Array([...header, ...lineBytes]);
            imagePackets.push(createNiimbotPacket(0x85, Array.from(packetData)));
        }

        // Trimite secvența de comenzi
        const delay = ms => new Promise(res => setTimeout(res, ms));
        
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x21, [3])); // Density
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x23, [1])); // Label Type
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x01, [1])); // Start Print
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x03, [1])); // Start Page Print
        
        const dimensionData = [(canvas.width >> 8) & 0xFF, canvas.width & 0xFF, (canvas.height >> 8) & 0xFF, canvas.height & 0xFF];
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x13, dimensionData));
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x15, [1, 0])); // Quantity

        console.log("Se trimit datele etichetei...");
        for (const packet of imagePackets) {
            await niimbotCharacteristic.writeValueWithoutResponse(packet);
            await delay(5);
        }

        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0xE3, [1])); // End Page Print
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0xF3, [1])); // End Print

        console.log("Imprimare finalizată!");
        alert("Comanda de imprimare a fost trimisă cu succes!");

    } catch (error) {
        console.error("Eroare la imprimare:", error);
        alert(`Eroare la imprimare: ${error.message}`);
    }
}

// Exportă funcțiile pentru a putea fi folosite în alt fișier
export { connectToPrinter, printLabel };
