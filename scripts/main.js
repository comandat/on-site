// scripts/main.js
import { getCommandsData } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('commands-list-container');
    if (!container) return;

    const commands = getCommandsData();
    
    if (commands.length === 0) {
        container.innerHTML = '<p class="col-span-2 text-center text-gray-500">Nu există comenzi active.</p>';
        return;
    }

    container.innerHTML = ''; // Golim containerul
    commands.forEach(command => {
        const commandEl = document.createElement('a');
        commandEl.href = 'products.html'; // URL curat
        commandEl.className = 'block rounded-lg bg-white p-4 shadow-sm transition-transform hover:scale-105 active:scale-95';
        commandEl.dataset.commandId = command.id; // Stocam ID-ul aici temporar
        
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
            </div>
        `;

        // Adaugam un event listener pentru a salva ID-ul si a naviga
        commandEl.addEventListener('click', (event) => {
            event.preventDefault();
            sessionStorage.setItem('currentCommandId', command.id);
            window.location.href = event.currentTarget.href;
        });

        container.appendChild(commandEl);
    });
});
