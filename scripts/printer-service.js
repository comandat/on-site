// scripts/printer-service.js

// Acest modul gestionează conexiunea și comunicarea cu imprimanta Niimbot.
// Poate fi importat de pe orice pagină pentru a printa sau a verifica starea conexiunii.

let niimbotCharacteristic = null;
let isConnecting = false;
let responseResolver = null;

// --- Funcții de comunicare Bluetooth Low Energy (BLE) ---

function createNiimbotPacket(type, data) {
    const dataBytes = Array.isArray(data) ? data : [data];
    const checksum = dataBytes.reduce((acc, byte) => acc ^ byte, type ^ dataBytes.length);
    const packet = [0x55, 0x55, type, dataBytes.length, ...dataBytes, checksum, 0xAA, 0xAA];
    return new Uint8Array(packet);
}

function handleCharacteristicValueChanged(event) {
    if (responseResolver) {
        const value = new Uint8Array(event.target.value.buffer);
        responseResolver(value);
        responseResolver = null;
    }
}

async function sendCommandAndWait(characteristic, packet) {
    return new Promise((resolve, reject) => {
        responseResolver = resolve;
        const timeout = setTimeout(() => {
            if (responseResolver) {
                responseResolver = null;
                reject(new Error('Timeout: Imprimanta nu a răspuns.'));
            }
        }, 5000);

        characteristic.writeValueWithoutResponse(packet).catch(err => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

// --- Funcții exportate pentru managementul conexiunii și printare ---

export function isPrinterConnected() {
    return niimbotCharacteristic !== null;
}

export async function connectToPrinter(statusCallback) {
    if (isPrinterConnected()) {
        if (statusCallback) statusCallback("Deja conectat.");
        return true;
    }
    if (isConnecting) {
         if (statusCallback) statusCallback("Conectarea este deja în progres...");
        return false;
    }

    isConnecting = true;

    try {
        if (statusCallback) statusCallback('Se caută imprimante...');
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'D' }],
            optionalServices: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455']
        });
        
        if (statusCallback) statusCallback(`Conectare la ${device.name}...`);
        const server = await device.gatt.connect();
        
        if (statusCallback) statusCallback('Se accesează serviciile...');
        const services = await server.getPrimaryServices();
        
        if (statusCallback) statusCallback('Se caută caracteristica potrivită...');
        
        let foundCharacteristic = null;
        for (const service of services) {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
                if (char.properties.writeWithoutResponse && char.properties.notify) {
                    foundCharacteristic = char;
                    break; 
                }
            }
            if (foundCharacteristic) break;
        }

        if (!foundCharacteristic) {
            throw new Error('Nu am găsit o caracteristică potrivită pentru imprimare.');
        }
        
        niimbotCharacteristic = foundCharacteristic;
        
        await niimbotCharacteristic.startNotifications();
        niimbotCharacteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
        
        if (statusCallback) statusCallback(`Conectat la ${device.name}. Gata de imprimare.`);
        
        // Listener pentru deconectare
        device.addEventListener('gattserverdisconnected', () => {
            if (statusCallback) statusCallback('Imprimanta a fost deconectată.');
            niimbotCharacteristic = null;
        });

        isConnecting = false;
        return true;

    } catch (error) {
        if (statusCallback) statusCallback(`Eroare: ${error.message}`);
        niimbotCharacteristic = null;
        isConnecting = false;
        return false;
    }
}

async function printSingleLabel(productCode, conditionLabel, statusCallback) {
    if (!isPrinterConnected()) {
        throw new Error("Imprimanta nu este conectată.");
    }
    
    const textToPrint = `${productCode}${conditionLabel}`;

    try {
        if (statusCallback) statusCallback(`Se pregătește eticheta: ${textToPrint}...`);

        const labelWidth = 240;
        const labelHeight = 120;

        const canvas = document.createElement('canvas');
        canvas.width = labelHeight;
        canvas.height = labelWidth;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(90 * Math.PI / 180);

        const verticalOffset = 10;
        
        const qrScript = document.createElement('script');
        qrScript.src = "https://unpkg.com/qrcode-generator@1.0.1/qrcode.js";
        document.head.appendChild(qrScript);
        await new Promise(resolve => qrScript.onload = resolve);
        
        const qr = qrcode(0, 'M');
        qr.addData(textToPrint);
        qr.make();
        const qrImg = new Image();
        qrImg.src = qr.createDataURL(6, 2);
        await new Promise(resolve => { qrImg.onload = resolve; });

        const qrSize = 85; 
        ctx.drawImage(qrImg, -labelWidth / 2 + 15, -labelHeight / 2 + 18 + verticalOffset, qrSize, qrSize);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px Arial'; 
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(textToPrint, -labelWidth / 2 + qrSize + 30, 0 + verticalOffset);
        ctx.restore();
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const imagePackets = [];
        const widthInBytes = Math.ceil(canvas.width / 8);

        for (let y = 0; y < canvas.height; y++) {
            let lineBytes = new Uint8Array(widthInBytes);
            for (let x = 0; x < canvas.width; x++) {
                const pixelIndex = (y * canvas.width + x) * 4;
                const pixelValue = imageData.data[pixelIndex] > 128 ? 1 : 0;
                if (pixelValue === 1) {
                    lineBytes[Math.floor(x / 8)] |= (1 << (7 - (x % 8)));
                }
            }
            const header = [(y >> 8) & 0xFF, y & 0xFF, 0, 0, 0, 1];
            const dataPayload = Array.from(new Uint8Array([...header, ...lineBytes]));
            imagePackets.push(createNiimbotPacket(0x85, dataPayload));
        }

        const delay = ms => new Promise(res => setTimeout(res, ms));

        if (statusCallback) statusCallback('Se trimit comenzile...');
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x21, [3]));
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x23, [1]));
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x01, [1]));
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x03, [1]));
        const dimensionData = [(canvas.height >> 8) & 0xFF, canvas.height & 0xFF, (canvas.width >> 8) & 0xFF, canvas.width & 0xFF];
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x13, dimensionData));
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x15, [0, 1]));

        if (statusCallback) statusCallback('Se transferă datele etichetei...');
        for (const packet of imagePackets) {
            await niimbotCharacteristic.writeValueWithoutResponse(packet);
            await delay(20);
        }

        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0xE3, [1]));
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0xF3, [1])); 

        if (statusCallback) statusCallback(`Eticheta "${textToPrint}" a fost trimisă.`);
    } catch (error) {
        if (statusCallback) statusCallback(`Eroare la imprimarea etichetei: ${textToPrint} - ${error.message}`);
        throw error;
    }
}

export async function printLabelQueue(queue, statusCallback) {
    if (!queue || queue.length === 0) {
        if (statusCallback) statusCallback('Nu sunt etichete de imprimat.');
        return;
    }
    
    if (statusCallback) statusCallback(`Se inițiază imprimarea pentru ${queue.length} etichete...`);
    
    for (let i = 0; i < queue.length; i++) {
        const { code, conditionLabel } = queue[i];
        try {
            if (statusCallback) statusCallback(`Se printează ${i + 1} din ${queue.length}: ${code}${conditionLabel}`);
            await printSingleLabel(code, conditionLabel, null); // Nu pasam statusCallback la functia individuala
            await new Promise(res => setTimeout(res, 500)); 
        } catch (e) {
            console.error("Eroare la imprimarea etichetei:", e);
             if (statusCallback) statusCallback(`Eroare la eticheta ${i + 1}. Procesul s-a oprit.`);
            return;
        }
    }
    if (statusCallback) statusCallback(`S-a finalizat imprimarea celor ${queue.length} etichete.`);
}
