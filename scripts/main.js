// scripts/main.js
import { AppState, syncStateWithServer } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('commands-list-container');
    if (!container) return;

    const renderCommandsList = () => {
        const commands = AppState.getCommands(); // Citeste direct din starea "live"

        if (!commands || commands.length === 0) {
            container.innerHTML = '<p class="col-span-2 text-center text-gray-500">Nu există comenzi de afișat.</p>';
            return;
        }

        container.innerHTML = ''; // Golește containerul
        commands.forEach(command => {
            const commandEl = document.createElement('a');
            commandEl.href = 'products.html';
            commandEl.className = 'block rounded-lg bg-white p-4 shadow-sm transition-transform hover:scale-105 active:scale-95';
            
            commandEl.innerHTML = `
                <div class="aspect-square flex flex-col justify-between">
                    <div>
                        <h2 class="font-bold text-gray-800">${command.name}</h2>
                        <p class="text-sm text-gray-500">${command.status}</p>
                    </div>
                    <div class="flex items-center justify-end">
                         <span class="material-symbols-outlined text-4xl text-gray-300">
                            inventory_2
                        </span>
                    </div>
                </div>`;

            commandEl.addEventListener('click', (event) => {
                event.preventDefault();
                // Salvăm ID-ul comenzii selectate pentru a fi folosit de pagina de produse
                sessionStorage.setItem('currentCommandId', command.id);
                window.location.href = commandEl.href;
            });

            container.appendChild(commandEl);
        });
    };

    async function initializePage() {
        // Opțional: putem forța o resincronizare la fiecare vizită pe pagina principală
        // pentru a fi siguri că datele sunt proaspete.
        container.innerHTML = '<p class="col-span-2 text-center text-gray-500">Se încarcă comenzile...</p>';
        await syncStateWithServer();
        renderCommandsList();
    }

    initializePage();
});
