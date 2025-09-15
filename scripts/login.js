// scripts/login.js

document.addEventListener('DOMContentLoaded', () => {
    // Redirectioneaza daca utilizatorul este deja logat
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'index.html';
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

    // Noul Webhook URL
    const webhookUrl = 'https://automatizare.comandat.ro/webhook-test/637e1f6e-7beb-4295-89bd-4d7022f12d45';

    // Functie pentru a efectua login
    const performLogin = async (accessCode) => {
        errorMessage.textContent = '';
        loginButton.disabled = true;
        buttonText.classList.add('hidden');
        buttonLoader.classList.remove('hidden');

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code: accessCode }),
            });

            // Intr-un API real, am verifica un raspuns JSON specific
            // Pentru acest exemplu, presupunem ca API-ul returneaza { "status": "success" } sau { "status": "error" }
            if (response.ok) {
                // Aici ar trebui sa vina logica de verificare a raspunsului de la API-ul real.
                // Deoarece webhook-ul de test nu ofera o validare reala, simulam in continuare.
                // In productie, ati verifica: const data = await response.json(); if(data.status === 'success') { ... }
                
                // Simulare pentru testare:
                if (accessCode) { // Presupunem ca orice cod scanat/introdus este valid pentru demo
                    sessionStorage.setItem('isLoggedIn', 'true');
                    window.location.href = 'index.html';
                } else {
                    errorMessage.textContent = 'Cod de acces invalid.';
                }

            } else {
                errorMessage.textContent = 'Eroare de rețea. Vă rugăm încercați din nou.';
            }

        } catch (error) {
            console.error('Eroare la autentificare:', error);
            errorMessage.textContent = 'A apărut o eroare. Vă rugăm încercați mai târziu.';
        } finally {
            loginButton.disabled = false;
            buttonText.classList.remove('hidden');
            buttonLoader.classList.add('hidden');
        }
    };
    
    // --- Logica de Scanare ---
    const html5QrCode = new Html5Qrcode("reader");

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        // Opreste scanerul
        html5QrCode.stop().then(() => {
            scannerContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
            // Completeaza input-ul si porneste login-ul
            accessCodeInput.value = decodedText;
            performLogin(decodedText);
        }).catch(err => {
            console.error("Eroare la oprirea scanerului.", err);
        });
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    scanButton.addEventListener('click', () => {
        loginContainer.classList.add('hidden');
        scannerContainer.classList.remove('hidden');
        // Porneste scanerul
        html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
            .catch(err => {
                console.error("Nu s-a putut porni scanerul", err);
                errorMessage.textContent = "Camera nu a putut fi accesată.";
                loginContainer.classList.remove('hidden');
                scannerContainer.classList.add('hidden');
            });
    });
    
    closeScannerButton.addEventListener('click', () => {
         html5QrCode.stop().then(() => {
            scannerContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
        }).catch(err => {
            console.error("Eroare la oprirea scanerului.", err);
             // Chiar daca oprirea esueaza, afisam formularul
            scannerContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
        });
    });

    // --- Logica Formularului ---
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const accessCode = accessCodeInput.value.trim();
        if (!accessCode) {
            errorMessage.textContent = 'Vă rugăm introduceți un cod.';
            return;
        }
        performLogin(accessCode);
    });
});

