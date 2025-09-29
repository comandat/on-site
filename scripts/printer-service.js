// scripts/printer-service.js

// Acest modul gestionează o conexiune "persistentă" cu imprimanta pe parcursul sesiunii.
// Chiar dacă se navighează între pagini, încearcă să se reconecteze automat.

let niimbotCharacteristic = null;
let isConnecting = false;
let connectedDevice = null;
let responseResolver = null;

const PRINTER_DEVICE_ID_KEY = 'printerDeviceId';

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

function onDisconnected(event) {
    // La deconectare, curățăm tot
    console.log('Imprimanta s-a deconectat.');
    niimbotCharacteristic = null;
    connectedDevice = null;
    sessionStorage.removeItem(PRINTER_DEVICE_ID_KEY);
}

async function setupConnection(device, statusCallback) {
    if (statusCallback) statusCallback(`Conectare la ${device.name}...`);
    device.addEventListener('gattserverdisconnected', onDisconnected);
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
    
    connectedDevice = device;
    sessionStorage.setItem(PRINTER_DEVICE_ID_KEY, device.id);

    if (statusCallback) statusCallback(`Conectat la ${device.name}.`);
}


// --- Funcții exportate ---

export function isPrinterConnected() {
    return niimbotCharacteristic !== null;
}

export function hasPreviouslyConnectedDevice() {
    return sessionStorage.getItem(PRINTER_DEVICE_ID_KEY) !== null;
}

// Funcție pentru a se reconecta la un device cunoscut, fără a deschide fereastra de selecție
async function silentReconnect(statusCallback) {
    const deviceId = sessionStorage.getItem(PRINTER_DEVICE_ID_KEY);
    if (!deviceId) return false;

    if (statusCallback) statusCallback("Încercare de reconectare la imprimantă...");
    try {
        const devices = await navigator.bluetooth.getDevices();
        let device = devices.find(d => d.id === deviceId);
        if (!device) {
             // Dacă nu e în lista de device-uri permise, nu putem face reconectare silentioasa.
             // Acest caz se poate intampla rar, de ex. daca userul curata permisiunile din browser
             throw new Error("Imprimanta nu a fost gasita in device-urile permise.");
        }
        await setupConnection(device, statusCallback);
        return true;
    } catch (error) {
        if (statusCallback) statusCallback(`Reconectarea a eșuat: ${error.message}`);
        onDisconnected(); // Curățăm starea dacă reconectarea eșuează
        return false;
    }
}


export async function connectToPrinter(statusCallback) {
    if (isPrinterConnected()) {
        if (statusCallback) statusCallback("Deja conectat.");
        return true;
    }
    if (isConnecting) return false;

    isConnecting = true;
    try {
        if (statusCallback) statusCallback('Se caută imprimante...');
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'D' }],
            optionalServices: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
        });
        await setupConnection(device, statusCallback);
        return true;
    } catch (error) {
        if (statusCallback) statusCallback(`Eroare: ${error.message}`);
        onDisconnected();
        return false;
    } finally {
        isConnecting = false;
    }
}

async function printSingleLabel(productCode, conditionLabel, statusCallback) {
    if (!isPrinterConnected()) throw new Error("Imprimanta nu este conectată.");
    
    const textToPrint = `${productCode}${conditionLabel}`;

    try {
        if (statusCallback) statusCallback(`Se pregătește: ${textToPrint}`);
        
        // ... (restul codului pentru canvas, QR, etc. rămâne neschimbat)
        const labelWidth = 240, labelHeight = 120;
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
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x21, [3]));
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x23, [1]));
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x01, [1]));
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x03, [1]));
        const dimensionData = [(canvas.height >> 8) & 0xFF, canvas.height & 0xFF, (canvas.width >> 8) & 0xFF, canvas.width & 0xFF];
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x13, dimensionData));
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x15, [0, 1]));
        for (const packet of imagePackets) {
            await niimbotCharacteristic.writeValueWithoutResponse(packet);
            await delay(20);
        }
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0xE3, [1]));
        await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0xF3, [1]));

    } catch (error) {
        if (statusCallback) statusCallback(`Eroare la printare: ${error.message}`);
        throw error;
    }
}

export async function printLabelQueue(queue, statusCallback) {
    if (!queue || queue.length === 0) return;
    
    // Pas 1: Asigură-te că ești conectat.
    if (!isPrinterConnected()) {
        const reconnected = await silentReconnect(statusCallback);
        if (!reconnected) {
            if (statusCallback) statusCallback("Conectarea la imprimantă este necesară.");
            // Stocăm ce vrem să printăm și redirectionăm
            sessionStorage.setItem('pendingPrintQueue', JSON.stringify(queue));
            window.location.href = 'printer.html';
            return;
        }
    }
    
    // Pas 2: Printează coada.
    if (statusCallback) statusCallback(`Începe printarea a ${queue.length} etichete...`);
    for (let i = 0; i < queue.length; i++) {
        const { code, conditionLabel } = queue[i];
        try {
            if (statusCallback) statusCallback(`Se printează ${i + 1}/${queue.length}: ${code}${conditionLabel}`);
            await printSingleLabel(code, conditionLabel, null);
            await new Promise(res => setTimeout(res, 500)); 
        } catch (e) {
             if (statusCallback) statusCallback(`Eroare la eticheta ${i + 1}. Procesul s-a oprit.`);
            return;
        }
    }
    if (statusCallback) statusCallback(`Printare finalizată.`);
}
