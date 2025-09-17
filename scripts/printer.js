// scripts/printer.js
const connectBtn = document.getElementById('connect-btn');
const printBtn = document.getElementById('print-btn');
const textInput = document.getElementById('print-text-input');
const statusP = document.getElementById('status');
const connectionDot = document.getElementById('connection-dot');
const connectionText = document.getElementById('connection-text');

let niimbotCharacteristic = null;

// ID-urile Bluetooth complete și corecte
const NIIMBOT_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const NIIMBOT_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';


function createNiimbotPacket(type, data) {
    const dataBytes = Array.isArray(data) ? data : [data];
    const checksum = dataBytes.reduce((acc, byte) => acc ^ byte, type ^ dataBytes.length);
    const packet = [0x55, 0x55, type, dataBytes.length, ...dataBytes, checksum, 0xAA, 0xAA];
    return new Uint8Array(packet);
}

function createTextImage(text, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'black';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
    return canvas;
}

async function connectToPrinter() {
    if (niimbotCharacteristic) {
        statusP.textContent = "Deja conectat.";
        return;
    }
    try {
        statusP.textContent = 'Se caută dispozitive...';

        // --- MODIFICARE AICI: Am revenit la ID-ul complet pentru serviciu ---
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [NIIMBOT_SERVICE_UUID]
        });
        // --- SFÂRȘIT MODIFICARE ---

        statusP.textContent = `Conectare la ${device.name || 'dispozitiv necunoscut'}...`;
        const server = await device.gatt.connect();
        
        statusP.textContent = 'Se caută serviciul de imprimare...';
        const service = await server.getPrimaryService(NIIMBOT_SERVICE_UUID);
        if (!service) {
            statusP.textContent = 'Eroare: Serviciul necesar nu a fost găsit pe acest dispozitiv.';
            alert('Acesta nu pare a fi o imprimantă NIIMBOT. Serviciul Bluetooth necesar lipsește.');
            return;
        }
        
        statusP.textContent = 'Se caută caracteristica de scriere...';
        niimbotCharacteristic = await service.getCharacteristic(NIIMBOT_CHARACTERISTIC_UUID);
        if (!niimbotCharacteristic) {
            statusP.textContent = 'Eroare: Caracteristica necesară nu a fost găsită pe acest dispozitiv.';
            alert('Acesta nu pare a fi o imprimantă NIIMBOT. Caracteristica Bluetooth necesară lipsește.');
            return;
        }
        
        statusP.textContent = `Conectat la ${device.name}. Gata de imprimare.`;
        connectionDot.classList.remove('bg-gray-400');
        connectionDot.classList.add('bg-green-500');
        connectionText.textContent = 'Conectat';
        printBtn.disabled = false;
        printBtn.classList.remove('bg-gray-300', 'cursor-not-allowed');
        printBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        connectBtn.textContent = 'Conectat';
    } catch (error) {
        statusP.textContent = `Eroare: ${error.message}`;
    }
}

async function printLabel(textToPrint) {
    if (!niimbotCharacteristic) {
        alert("Imprimanta nu este conectată.");
        return;
    }
    if (!textToPrint) {
        alert("Introduceți un text pentru a imprima.");
        return;
    }
    try {
        statusP.textContent = 'Se pregătește eticheta...';
        const canvas = createTextImage(textToPrint, 240, 120);
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const imagePackets = [];
        const widthInBytes = Math.ceil(canvas.width / 8);
        for (let y = 0; y < canvas.height; y++) {
            let lineBytes = new Uint8Array(widthInBytes);
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                const pixelValue = imageData.data[pixelIndex] < 128 ? 1 : 0;
                if (pixelValue === 1) {
                    lineBytes[Math.floor(x / 8)] |= (1 << (7 - (x % 8)));
                }
            }
            const header = [(y >> 8) & 0xFF, y & 0xFF, 0, 0, 0, 1];
            imagePackets.push(createNiimbotPacket(0x85, Array.from(new Uint8Array([...header, ...lineBytes]))));
        }
        const delay = ms => new Promise(res => setTimeout(res, ms));
        statusP.textContent = 'Se trimit comenzile...';
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x21, [3]));
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x23, [1]));
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x01, [1]));
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x03, [1]));
        const dimensionData = [(canvas.width >> 8) & 0xFF, canvas.width & 0xFF, (canvas.height >> 8) & 0xFF, canvas.height & 0xFF];
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x13, dimensionData));
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0x15, [1, 0]));
        statusP.textContent = 'Se transferă datele etichetei...';
        for (const packet of imagePackets) {
            await niimbotCharacteristic.writeValueWithoutResponse(packet);
            await delay(5);
        }
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0xE3, [1]));
        await niimbotCharacteristic.writeValueWithoutResponse(createNiimbotPacket(0xF3, [1]));
        statusP.textContent = 'Comandă trimisă cu succes! Gata de o nouă imprimare.';
    } catch (error) {
        statusP.textContent = `Eroare la imprimare: ${error.message}`;
    }
}

connectBtn.addEventListener('click', connectToPrinter);
printBtn.addEventListener('click', () => {
    const text = textInput.value;
    printLabel(text);
});

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const textToPrint = urlParams.get('text');
    if (textToPrint) {
        textInput.value = textToPrint;
    }
});
