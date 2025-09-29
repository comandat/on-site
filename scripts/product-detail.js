// scripts/product-detail.js
import { AppState, fetchDataAndSyncState, sendStockUpdate, fetchProductDetailsInBulk } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- START: Variabilele pentru printare și starea aplicației ---
    let niimbotCharacteristic = null;
    let isConnecting = false;
    let responseResolver = null;

    let currentCommandId = null;
    let currentProductId = null;
    let currentProduct = null;
    let swiper = null;

    let stockStateAtModalOpen = {};
    let stockStateInModal = {};
    let pressTimer = null;
    let clickHandler = null;
    // --- FINAL: Variabile ---

    const pageElements = {
        title: document.getElementById('product-detail-title'),
        expectedStock: document.getElementById('expected-stock'),
        suggestedCondition: document.getElementById('suggested-condition'),
        totalFound: document.getElementById('total-found'),
        imageWrapper: document.getElementById('product-image-wrapper'),
        stockModal: document.getElementById('stock-modal'),
        printerModal: document.getElementById('printer-modal'),
        openModalButton: document.getElementById('open-stock-modal-button'),
        footerPrinterButton: document.getElementById('footer-printer-button')
    };

    function showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, duration);
    }
    
    // --- START: Logica de printare ---
    function isPrinterConnected() {
        return niimbotCharacteristic !== null;
    }

    function createNiimbotPacket(type, data) {
        const dataBytes = Array.isArray(data) ? data : [data];
        const checksum = (dataBytes.reduce((acc, byte) => acc ^ byte, type ^ dataBytes.length)) & 0xFF;
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

    async function connectToPrinter(statusCallback) {
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
            
            device.addEventListener('gattserverdisconnected', () => {
                showToast('Imprimanta a fost deconectată.');
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

    async function printSingleLabel(productCode, conditionLabel) {
        if (!isPrinterConnected()) {
            throw new Error("Imprimanta nu este conectată.");
        }
        
        const textToPrint = `${productCode}${conditionLabel}`;
        try {
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
            
            const qr = qrcode(0, 'M');
            qr.addData(textToPrint);
            qr.make();
            const qrImg = new Image();
            qrImg.src = qr.createDataURL(6, 2);
            await new Promise(resolve => { qrImg.onload = resolve; });
            
            const qrSize = 85; 
            ctx.drawImage(qrImg, -labelWidth / 2 + 15, -labelHeight / 2 + 18 + verticalOffset, qrSize, qrSize);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            const line1 = textToPrint.substring(0, 6);
            const line2 = textToPrint.substring(6);
            
            ctx.fillText(line1, -labelWidth / 2 + qrSize + 30, -15 + verticalOffset);
            ctx.fillText(line2, -labelWidth / 2 + qrSize + 30, 15 + verticalOffset);

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
            console.error(`Eroare critică la printarea etichetei: ${textToPrint}`, error);
            throw error;
        }
    }
    // --- FINAL: Logica de printare ---

    function getLatestProductData() {
        const command = AppState.getCommands().find(c => c.id === currentCommandId);
        return command ? command.products.find(p => p.id === currentProductId) : null;
    }

    function renderPageContent() {
        currentProduct = getLatestProductData();
        if (!currentProduct) return;
        pageElements.expectedStock.textContent = currentProduct.expected;
        pageElements.suggestedCondition.textContent = currentProduct.suggestedcondition;
        pageElements.totalFound.textContent = currentProduct.found;
        for (const condition in currentProduct.state) {
            const element = document.querySelector(`[data-summary="${condition}"]`);
            if (element) element.textContent = currentProduct.state[condition];
        }
    }

    async function handleSaveChanges() {
        const saveButton = document.getElementById('save-btn');
        saveButton.disabled = true;
        saveButton.textContent = 'Se salvează...';

        const productAsinForPrinting = currentProduct.asin;
        
        if (typeof productAsinForPrinting !== 'string' || productAsinForPrinting.trim() === '') {
            const errorMessage = `EROARE: Imprimarea a fost oprită deoarece produsul curent (ID: ${currentProduct.id}) nu are un cod ASIN valid. Valoare primită: '${productAs
