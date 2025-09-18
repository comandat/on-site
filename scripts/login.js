document.addEventListener('DOMContentLoaded', () => {
    // Redirectioneaza daca utilizatorul este deja logat
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'main.html';
        return;
    }

    const loginForm = document.getElementById('login-form');
    const accessCodeInput = document.getElementById('access-code');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');
    const buttonText = loginButton.querySelector('.button-text');
    const buttonLoader = loginButton.querySelector('.button-loader');
    const scanButton = document.getElementById('scan-button');
    const scannerContainer = document.getElementById('scanner-container');
    const closeScannerButton = document.getElementById('close-scanner-button');
    const readerElement = document.getElementById('reader');

    const webhookUrl = 'https://automatizare.comandat.ro/webhook-test/637e1f6e-7beb-4295-89bd-4d7022f12d45';

    // --- Functii Helper ---

    const getDefaultProducts = () => [
        { id: 'dell-xps-13', name: 'Laptop Dell XPS 13', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAC7Y2f7W60sxHO28zievrABc7RXUtjtFIvngTxavWv1XNYvQfGay-3xIYH9aBDozYCYKLVPiBpqT2htuUE0USPs62Z7Hrn_ISIko-PMXSOM0yJMv1ZvJShlxfI1DtFU3wHmdFm487ph92hDb3VXyS37OQZ8Gq_q_Je7WVT2FykZ2AmJ56r6Mgt8sY3o3o-tcgaAo0N5a3Xlm6anUQrYQQElcN539ggkOlDrXoDOpYS_pg_UwXzkdmmQ3RvQQcWDLEo2dmYRgVjBHI', expected: 4, found: 2, state: { 'new': 1, 'very-good': 1, 'good': 0, 'broken': 0 }},
        { id: 'dell-monitor-27', name: 'Monitor Dell UltraSharp 27', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUlrik3yuJIhxDfjs2z7CWN2jDjGrRI4e2KjGi98fwIKvluWlylpOew59brJO2Iq0ImAZww9qkpcG-sTTP3O74FyFuZ6QyXFJeJa1AP3qVEQN71gq8wugSf-cWjl5usbJF49JcaKHZpPIP-8-X60EsqGFSiPsNhXKHcqzfHlk1UvzQxiQRXPJQeTcf3xaxeaDohAc-hEQ5wuIyExTNACDw1KKVPoyxfYynL2tYWfPQN3H_pWbc263CTiAiik_psNy6dhsSDgmSS1c', expected: 1, found: 1, state: { 'new': 0, 'very-good': 1, 'good': 0, 'broken': 0 }},
        // ... (restul produselor)
    ];

    const transformData = (rawData) => {
        return Object.keys(rawData).map(commandId => ({
            id: commandId,
            name: `Comanda #${commandId.substring(0, 12)}`,
            date: new Date().toLocaleDateString('ro-RO'),
            status: 'În Desfășurare',
            products: getDefaultProducts()
        }));
    };

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
            
            // *** MODIFICARE CHEIE AICI ***
            // Clonam raspunsul pentru a-l putea citi de doua ori (o data ca text, o data ca JSON)
            const responseClone = response.clone();
            const rawText = await responseClone.text();
            console.log("Răspuns brut de la server (text):", rawText);


            if (response.ok) {
                const responseData = await response.json();
                console.log("Răspuns de la server (JSON):", responseData); // Afisam si JSON-ul parsat

                const body = responseData[0]?.response?.body;

                if (body && body.status === 'success' && body.data) {
                    sessionStorage.setItem('loggedInUser', body.user);
                    const transformedCommands = transformData(body.data);
                    localStorage.setItem('commandsData', JSON.stringify(transformedCommands));
                    sessionStorage.setItem('isLoggedIn', 'true');
                    window.location.href = 'main.html';
                } else {
                    errorMessage.textContent = 'Răspuns invalid de la server.';
                }
            } else {
                errorMessage.textContent = 'Cod de acces invalid.';
            }
        } catch (error) {
            console.error('Eroare la autentificare:', error);
            errorMessage.textContent = 'Eroare la conectare. Verificați consola.';
        } finally {
            loginButton.disabled = false;
            buttonText.classList.remove('hidden');
            buttonLoader.classList.add('hidden');
        }
    };

    // --- Logica de Scanare (ramane neschimbata) ---
    // ...
});
