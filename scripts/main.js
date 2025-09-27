// scripts/main.js
import { getCommandsData, fetchProductDetailsInBulk, fetchAndSyncAllCommandsData } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('commands-list-container');
    if (!container) return;
    
    let refreshInterval = null;
    const POLLING_INTERVAL = 60000; // 1 minut

    const renderCommandsList = () => {
        const commands = getCommandsData(); // Citeste din localStorage
        
        // O promisiune care se va rezolva cand datele produselor sunt pre-incarcate
        let productDataPromise = null;

        // Functie pentru pre-incarcarea datelor
        const preloadProductData = () => {
            const asinsToFetch = commands
                .filter(command => command.status === 'În Pregatire')
                .flatMap(command => command.products.map(p => p.asin));
            
            if (asinsToFetch.length > 0) {
                // Initiem fetch-ul si stocam promisiunea
                productDataPromise = fetchProductDetailsInBulk(asinsToFetch);
            } else {
                // Daca nu sunt produse, cream o promisiune deja rezolvata
                productDataPromise = Promise.resolve();
            }
        };

        if (commands.length === 0) {
            container.innerHTML = '<p class="col-span-2 text-center text-gray-500">Nu există comenzi active.</p>';
            return;
        }

        container.innerHTML = ''; // Golim containerul
        commands.forEach(command => {
            const commandEl = document.createElement('a');
            commandEl.href = 'products.html';
            commandEl.className = 'block rounded-lg bg-white p-4 shadow-sm transition-transform hover:scale-105 active:scale-95';
            commandEl.dataset.commandId = command.id;
            
             commandEl.innerHTML = `
            <div class="aspect-square flex flex-col justify-between">
                <div>
                    <h2 class="font-bold text-gray-800">${command.name}</h2>
                    <p class="text-sm text-gray-500">${command.status}</p>
                </div>
                <div class="flex items-center justify-end">
                     <div class="loader-container" style="display: none;">
                        <div class="w-6 h-6 border-4 border-gray-300 border-t-[var(--primary-color)] border-solid rounded-full animate-spin"></div>
                     </div>
                     <span class="material-symbols-outlined text-4xl text-gray-300 icon-inventory">
                        inventory_2
                    </span>
                </div>
            </div>
        `;

            commandEl.addEventListener('click', async (event) => {
                event.preventDefault();
                
                // FIX: Salvam ID-ul si URL-ul in variabile locale INAINTE de 'await'.
                // Folosim 'command' si 'commandEl' care sunt pastrate in memorie (closure)
                // si sunt mai sigure decat 'event.currentTarget'.
                const commandIdToSet = command.id;
                const destinationUrl = commandEl.href;

                const loader = commandEl.querySelector('.loader-container');
                const icon = commandEl.querySelector('.icon-inventory');
                
                // Afisam loader-ul si ascundem icon-ul
                loader.style.display = 'block';
                icon.style.display = 'none';

                // Asteptam ca datele sa fie incarcate
                await productDataPromise;
                
                // Stocam ID-ul si navigam folosind variabilele salvate, care sunt garantat corecte.
                sessionStorage.setItem('currentCommandId', commandIdToSet);
                window.location.href = destinationUrl;
            });

            container.appendChild(commandEl);
        });

        // Pornim pre-incarcarea datelor dupa ce am afisat comenzile
        preloadProductData();
    };

    // NOU: Funcția de Polling
    const startPolling = async () => {
        // Sincronizam Base State o data la fiecare ciclu de Polling
        await fetchAndSyncAllCommandsData(); 
        
        renderCommandsList();
    };

    // Pornim Polling-ul
    startPolling(); // Apel inițial
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(startPolling, POLLING_INTERVAL);
    
    // Oprim Polling-ul la ieșirea din pagină
    window.addEventListener('beforeunload', () => {
        if (refreshInterval) clearInterval(refreshInterval);
    });
});
