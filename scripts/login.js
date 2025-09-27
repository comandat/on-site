document.addEventListener('DOMContentLoaded', () => {
    console.log("Login script a pornit.");

    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'main.html';
        return;
    }

    const loginForm = document.getElementById('login-form');
    const accessCodeInput = document.getElementById('access-code');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');

    if (!loginForm) {
        console.error("Eroare critică: Formularul cu ID-ul 'login-form' nu a fost găsit.");
        return;
    }
    
    const buttonText = loginButton.querySelector('.button-text');
    const buttonLoader = loginButton.querySelector('.button-loader');
    
    // URL-uri actualizate
    const loginWebhookUrl = 'https://automatizare.comandat.ro/webhook/637e1f6e-7beb-4295-89bd-4d7022f12d45';
    const dataFetchWebhookUrl = 'https://automatizare.comandat.ro/webhook/5a447557-8d52-463e-8a26-5902ccee8177';


    // ATENTIE: Functia transformData ramane aici pentru a putea fi apelata,
    // deoarece acest script nu este de tip 'module' si nu poate folosi import din data.js.
    const transformData = (rawData) => {
        return Object.keys(rawData).map(commandId => {
            const products = rawData[commandId] || [];
            
            const transformedProducts = products.map(product => {
                return {
                    id: product.productsku, 
                    asin: product.asin,
                    name: 'Încărcare...',
                    imageUrl: '',
                    expected: product.orderedquantity || 0,
                    found: (product.bncondition || 0) + (product.vgcondition || 0) + (product.gcondition || 0) + (product.broken || 0),
                    state: {
                        'new': product.bncondition || 0,
                        'very-good': product.vgcondition || 0,
                        'good': product.gcondition || 0,
                        'broken': product.broken || 0
                    }
                };
            });

            return {
                id: commandId,
                name: `Comanda #${commandId.substring(0, 12)}`,
                date: new Date().toLocaleDateString('ro-RO'),
                status: 'În Pregatire',
                products: transformedProducts
            };
        });
    };


    const performLogin = async (accessCode) => {
        errorMessage.textContent = '';
        loginButton.disabled = true;
        buttonText.classList.add('hidden');
        buttonLoader.classList.remove('hidden');

        try {
            // PAS 1: LOGIN (POST) - Doar autentificare
            const loginResponse = await fetch(loginWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ code: accessCode }),
            });

            if (!loginResponse.ok) {
                throw new Error(`Eroare de rețea: ${loginResponse.status}`);
            }

            const loginData = await loginResponse.json();
            console.log("Răspuns primit de la webhook (Login):", loginData);
            
            if (loginData && loginData.status === 'success') {
                sessionStorage.setItem('loggedInUser', loginData.user);
                sessionStorage.setItem('lastAccessCode', accessCode); // Salvăm codul pentru Polling
                
                // PAS 2: DATA FETCH (GET) - Extragerea datelor
                const dataFetchUrlWithCode = `${dataFetchWebhookUrl}?code=${encodeURIComponent(accessCode)}`;

                const dataResponse = await fetch(dataFetchUrlWithCode, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                });

                if (!dataResponse.ok) {
                    throw new Error(`Eroare de rețea la data fetch: ${dataResponse.status}`);
                }

                const dataFetchData = await dataResponse.json();
                console.log("Răspuns primit de la webhook (Data Fetch):", dataFetchData);

                if (dataFetchData && dataFetchData.status === 'success' && dataFetchData.data) {
                    const transformedCommands = transformData(dataFetchData.data);
                    localStorage.setItem('commandsData', JSON.stringify(transformedCommands));
                    sessionStorage.setItem('isLoggedIn', 'true');
                    window.location.href = 'main.html';
                } else {
                    errorMessage.textContent = 'Autentificare reușită, dar eroare la preluarea datelor.';
                }

            } else if (loginData && loginData.status === 'failed') {
                errorMessage.textContent = 'Date incorecte';
            } else {
                errorMessage.textContent = 'Răspuns invalid de la server.';
            }
        } catch (error) {
            console.error('Eroare la autentificare:', error);
            errorMessage.textContent = 'Eroare la conectare. Verifică URL-ul și consola.';
        } finally {
            loginButton.disabled = false;
            buttonText.classList.remove('hidden');
            buttonLoader.classList.add('hidden');
        }
    };

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault(); 
        console.log("Formular trimis și interceptat de JS.");
        const accessCode = accessCodeInput.value.trim();
        if (accessCode) {
            performLogin(accessCode);
        } else {
            errorMessage.textContent = 'Vă rugăm introduceți un cod.';
        }
    });
});
