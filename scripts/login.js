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
    const scanButton = document.getElementById('scan-button');

    if (!loginForm) {
        console.error("Eroare critică: Formularul cu ID-ul 'login-form' nu a fost găsit.");
        return;
    }
    
    const buttonText = loginButton.querySelector('.button-text');
    const buttonLoader = loginButton.querySelector('.button-loader');
    
    const webhookUrl = 'https://automatizare.comandat.ro/webhook/637e1f6e-7beb-4295-89bd-4d7022f12d45';

    const performLogin = async (accessCode) => {
        errorMessage.textContent = '';
        loginButton.disabled = true;
        buttonText.classList.add('hidden');
        buttonLoader.classList.remove('hidden');

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ code: accessCode }),
            });

            if (!response.ok) {
                throw new Error(`Eroare de rețea: ${response.status}`);
            }

            const responseData = await response.json();
            console.log("Răspuns primit de la webhook:", responseData);
            
            // --- MODIFICARE CHEIE AICI ---
            // Acum verificăm direct `responseData` în loc de o structură complexă.
            if (responseData && responseData.status === 'success' && responseData.data) {
                sessionStorage.setItem('loggedInUser', responseData.user);
                const transformedCommands = transformData(responseData.data);
                localStorage.setItem('commandsData', JSON.stringify(transformedCommands));
                sessionStorage.setItem('isLoggedIn', 'true');
                window.location.href = 'main.html';
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

    const transformData = (rawData) => {
        return Object.keys(rawData).map(commandId => {
            const products = rawData[commandId]; 
            
            return {
                id: commandId,
                name: `Comanda #${commandId.substring(0, 12)}`,
                date: new Date().toLocaleDateString('ro-RO'),
                status: 'În Desfășurare',
                products: products || [] 
            };
        });
    };
});
