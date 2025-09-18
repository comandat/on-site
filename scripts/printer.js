// Așteaptă ca întregul document HTML să fie încărcat înainte de a rula scriptul
document.addEventListener('DOMContentLoaded', () => {
    
    // --- CODUL TĂU ÎNCEPE AICI ---

    const connectBtn = document.getElementById('connect-btn');
    const printBtn = document.getElementById('print-btn');
    const textInput = document.getElementById('print-text-input');
    const statusP = document.getElementById('status');
    const connectionDot = document.getElementById('connection-dot');
    const connectionText = document.getElementById('connection-text');

    let niimbotCharacteristic = null;
    let responseResolver = null;

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
                    reject(new Error('Timeout: Printer did not respond.'));
                }
            }, 5000);

            characteristic.writeValueWithoutResponse(packet).catch(err => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    async function connectToPrinter() {
        if (niimbotCharacteristic) {
            statusP.textContent = "Deja conectat.";
            return;
        }
        try {
            statusP.textContent = 'Se caută imprimante...';
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'D' }],
                optionalServices: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455']
            });
            
            statusP.textContent = `Conectare la ${device.name}...`;
            const server = await device.gatt.connect();
            
            statusP.textContent = 'Se accesează serviciile...';
            const services = await server.getPrimaryServices();
            
            statusP.textContent = 'Se caută caracteristica potrivită...';
            
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
                statusP.textContent = 'Eroare: Nu am găsit o caracteristică potrivită pentru imprimare.';
                server.disconnect();
                return;
            }
            
            niimbotCharacteristic = foundCharacteristic;
            
            await niimbotCharacteristic.startNotifications();
            niimbotCharacteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
            
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
            ctx.font = 'bold 30px Arial'; 
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            const textX = -labelWidth / 2 + qrSize + 30;
            
            if (textToPrint.length > 7) {
                const mid = Math.ceil(textToPrint.length / 2);
                const text1 = textToPrint.substring(0, mid);
                const text2 = textToPrint.substring(mid);
                ctx.fillText(text1, textX, 0 - 18 + verticalOffset);
                ctx.fillText(text2, textX, 0 + 18 + verticalOffset);
            } else {
                ctx.fillText(textToPrint, textX, 0 + verticalOffset);
            }

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

            statusP.textContent = 'Se trimit comenzile...';

            await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x21, [3]));
            await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x23, [1]));
            await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x01, [1]));
            await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x03, [1]));

            const dimensionData = [
                (canvas.height >> 8) & 0xFF, canvas.height & 0xFF,
                (canvas.width >> 8) & 0xFF, canvas.width & 0xFF
            ];
            await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x13, dimensionData));
            await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0x15, [0, 1]));

            statusP.textContent = 'Se transferă datele etichetei...';
            for (const packet of imagePackets) {
                await niimbotCharacteristic.writeValueWithoutResponse(packet);
                await delay(20);
            }

            await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0xE3, [1]));
            await sendCommandAndWait(niimbotCharacteristic, createNiimbotPacket(0xF3, [1]));

            statusP.textContent = 'Comandă trimisă cu succes!';
        } catch (error) {
            statusP.textContent = `Eroare la imprimare: ${error.message}`;
        }
    }

    // Adaugă event listenere la butoane
    connectBtn.addEventListener('click', connectToPrinter);
    printBtn.addEventListener('click', () => {
        const text = textInput.value;
        printLabel(text);
    });

    // Verifică dacă există text în URL la încărcarea paginii
    const urlParams = new URLSearchParams(window.location.search);
    const textToPrint = urlParams.get('text');
    if (textToPrint) {
        textInput.value = textToPrint;
    }

}); // --- SFÂRȘITUL BLOCULUI DOMContentLoaded ---
