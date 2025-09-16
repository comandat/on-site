document.addEventListener('DOMContentLoaded', () => {
    // Redirectioneaza daca utilizatorul este deja logat
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'main.html';
        return;
    }

    const loginContainer = document.getElementById('login-container');
    const scannerContainer = document.getElementById('scanner-container');
    const loginForm = document.getElementById('login-form');
    const accessCodeInput = document.getElementById('access-code');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');
    const buttonText = loginButton.querySelector('.button-text');
    const buttonLoader = loginButton.querySelector('.button-loader');
    const scanButton = document.getElementById('scan-button');
    const closeScannerButton = document.getElementById('close-scanner-button');
    const readerElement = document.getElementById('reader');
    
    // Noul Webhook URL
    const webhookUrl = 'https://automatizare.comandat.ro/webhook-test/637e1f6e-7beb-4295-89bd-4d7022f12d45';

    // Functie pentru a efectua login cu validare reala
    const performLogin = async (accessCode) => {
        errorMessage.textContent = '';
        loginButton.disabled = true;
        buttonText.classList.add('hidden');
        buttonLoader.classList.remove('hidden');

        try {
            // *** MODIFICARE CHEIE AICI ***
            // Am schimbat 'Content-Type' in 'text/plain' pentru a evita problemele de CORS (preflight).
            // Serverul webhook (n8n) ar trebui sa poata interpreta corpul ca JSON chiar si cu acest header.
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain', 
                },
                body: JSON.stringify({ code: accessCode }),
            });

            if (response.ok) {
                const data = await response.json();
                
                // Verificam raspunsul de la webhook.
                if (data && data.status === 'success') {
                    sessionStorage.setItem('isLoggedIn', 'true');
                    window.location.href = 'main.html';
                } else {
                    errorMessage.textContent = 'Cod de acces invalid sau expirat.';
                }
            } else {
                errorMessage.textContent = 'Cod de acces invalid.';
            }
        } catch (error) {
            console.error('Eroare la autentificare:', error);
            errorMessage.textContent = 'Eroare la conectare. Verificați consola (posibil problemă CORS).';
        } finally {
            loginButton.disabled = false;
            buttonText.classList.remove('hidden');
            buttonLoader.classList.add('hidden');
        }
    };

    // --- Logica de Scanare ---
    if (typeof Html5Qrcode === 'undefined') {
        console.error("Librăria Html5Qrcode nu a fost încărcată.");
        if(scanButton) scanButton.style.display = 'none';
        return;
    }

    const html5QrCode = new Html5Qrcode("reader");
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        if (html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                scannerContainer.classList.add('hidden');
                loginContainer.classList.remove('hidden');
                accessCodeInput.value = decodedText;
                performLogin(decodedText);
            }).catch(err => console.error("Eroare la oprirea scanerului.", err));
        }
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    scanButton.addEventListener('click', () => {
        if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
            errorMessage.textContent = "Scanarea necesită o conexiune securizată (HTTPS).";
            return;
        }
        errorMessage.textContent = '';
        loginContainer.classList.add('hidden');
        scannerContainer.classList.remove('hidden');
        html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
            .catch(err => {
                console.error("Nu s-a putut porni scanerul:", err);
                readerElement.innerHTML = `<div class="text-white text-center p-4">Camera nu a putut fi accesată.<br>Asigurați-vă că ați acordat permisiunea de acces.</div>`;
            });
    });

    closeScannerButton.addEventListener('click', () => {
        if (html5QrCode.isScanning) {
            html5QrCode.stop().catch(err => console.error("Eroare la oprirea scanerului.", err));
        }
        readerElement.innerHTML = '';
        scannerContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
    });

    // --- Logica Formularului ---
    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const accessCode = accessCodeInput.value.trim();
        if (!accessCode) {
            errorMessage.textContent = 'Vă rugăm introduceți un cod.';
            return;
        }
        performLogin(accessCode);
    });
});

