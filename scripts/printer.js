// scripts/printer.js
const connectBtn = document.getElementById('connect-btn');
const printBtn = document.getElementById('print-btn');
const textInput = document.getElementById('print-text-input');
const statusP = document.getElementById('status');
const connectionDot = document.getElementById('connection-dot');
const connectionText = document.getElementById('connection-text');

let niimbotCharacteristic = null;

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
        statusP.textContent = 'Se caută imprimante...';

        // --- MODIFICARE AICI ---
        // Caută toate dispozitivele al căror nume începe cu "D".
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'D' }], // <-- Schimbat din 'name' în 'namePrefix'
            optionalServices: [0x18f0]
        });
        // --- SFÂRȘIT MODIFICARE ---

        statusP.textContent = 'Conectare la serverul GATT...';
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(0x18f0);
        niimbotCharacteristic = await service.getCharacteristic(0x2af1);
        
        statusP.textContent = `Conectat la ${device.name}. Gata de imprimare.`;
        connectionDot.classList.remove('bg-ray-400');
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
