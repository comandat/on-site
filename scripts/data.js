// scripts/data.js

// Functie pentru a prelua datele din localStorage sau a le initializa
export function getCommandsData() {
    let data = localStorage.getItem('commandsData');
    if (data) {
        return JSON.parse(data);
    }

    // Date initiale, acum structurate pe comenzi
    const initialData = [
        {
            id: 'cmd-001',
            name: 'Comanda #1024',
            date: '14.09.2025',
            status: 'În Desfășurare',
            products: [
                 { id: 'dell-xps-13', name: 'Laptop Dell XPS 13', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAC7Y2f7W60sxHO28zievrABc7RXUtjtFIvngTxavWv1XNYvQfGay-3xIYH9aBDozYCYKLVPiBpqT2htuUE0USPs62Z7Hrn_ISIko-PMXSOM0yJMv1ZvJShlxfI1DtFU3wHmdFm487ph92hDb3VXyS37OQZ8Gq_q_Je7WVT2FykZ2AmJ56r6Mgt8sY3o3o-tcgaAo0N5a3Xlm6anUQrYQQElcN539ggkOlDrXoDOpYS_pg_UwXzkdmmQ3RvQQcWDLEo2dmYRgVjBHI', expected: 4, state: { 'new': 1, 'very-good': 1, 'good': 0, 'broken': 0 }},
                 { id: 'dell-monitor-27', name: 'Monitor Dell UltraSharp 27', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUlrik3yuJIhxDfjs2z7CWN2jDjGrRI4e2KjGi98fwIKvluWlylpOew59brJO2Iq0ImAZww9qkpcG-sTTP3O74FyFuZ6QyXFJeJa1AP3qVEQN71gq8wugSf-cWjl5usbJF49JcaKHZpPIP-8-X60EsqGFSiPsNhXKHcqzfHlk1UvzQxiQRXPJQeTcf3xaxeaDohAc-hEQ5wuIyExTNACDw1KKVPoyxfYynL2tYWfPQN3H_pWbc263CTiAiik_psNy6dhsSDgmSS1c', expected: 1, state: { 'new': 0, 'very-good': 1, 'good': 0, 'broken': 0 }},
                 { id: 'logitech-mx-keys', name: 'Tastatură Logitech MX Keys', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAvVhZX6iyvP3088WcmGj1HpcMcw2ZY74pSKx_mm95GptvW52WiIqp8oVtp4A6J8aOBirdtFl42SACnrxPaRBJogMadPYoGGJpkbcZL8NFA1c6gUyUxWLAUbiu4aYksQd7E6EnuRb82iX0MAGGgn7o9Bqp1-tsCHinCV6IUt8DpBdmcfn-pXuaDSSvewCwUm5d9Oirk78Y2yjeXFs2MCRPDB0P8SOq9b9u80FphKf0U8Ey_XJUb1y_RlWFmRljQ0avf2N7n-ct4lc', expected: 5, state: { 'new': 2, 'very-good': 0, 'good': 1, 'broken': 0 }},
                 { id: 'logitech-mx-master-3', name: 'Mouse Logitech MX Master 3', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCaJ0zpaGNrlvxG3Jfcz7-3fjtC3Ef4qQ6iUDK9lR7KD8vBR1JADGzgk8CCSw36wZE_sm8dZrbMXR98C6ZO1jSa7uu3Yy7-xXO12Cpp3jX9_1GY-k1OzcwD1IPVs6rsjqZuZ-zLf1BZsfd53ohUAisoXdb3O0VcYrzMy5GWe7iapIcTajfcZNyfsYa9uBu1qdtOxSNcklagzl14wMp0Qu0KYth63A_ha9BEsWYk-96bL1B2M9lSB_VUwIvB4oLzoDXmhiGnyGkoiuQ', expected: 4, state: { 'new': 4, 'very-good': 0, 'good': 0, 'broken': 0 }},
                 { id: 'sony-wh-1000xm4', name: 'Căști Sony WH-1000XM4', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAFWSZm2ZjHdDIyThoaskCd5o0rcE967E7O06dAmrid_AwrgBbLI5FPW7o-dq3qJQg0aSgh9ueiSYUHwflaVn9T4Kbq-oUTiVnS-KESHo0lnW8U8ZPUAivE1WMPmDPTOb9IOxAAirVnulzzdEMKwj3ziNQ82ArUAdhQ98u2tgDYpOrf077dzGnDwRYJ8hXJm2CyAcHWSCV7N_HnhDUchL9qaSpZuqd4N5BqFZSNPgdBR18hn0OadMVbNiRlwJSmxOfnqGDzW_4gHFI', expected: 2, state: { 'new': 1, 'very-good': 0, 'good': 0, 'broken': 0 }},
                 { id: 'dell-docking', name: 'Docking Station Dell WD19', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAeSGnn79nj4AGogJyJ3esJ4ICs5ZQKehjzCVXGiy5MR-x4SWk6KjjsB6rtHI5XbeonC6_lflBK-yHNA6Nna-iyApIvIZxFJhTPkwukwSKH3KaxpgRwZeVh7AmN5uxdqJTRuUYSAt8fkDO-As9WMEYyNt3NfkkmNmrAlH8dVWRCPZTxkiZpQUQ-DmH8pw5OjuY8-t8QCOQvk8q2WmaFJWIpu9LtwOi_S_4ia593ZMsMq7VaA0oE4aiW3aTmEiwSWXJuc7xfWepOk2s', expected: 3, state: { 'new': 2, 'very-good': 0, 'good': 0, 'broken': 0 }},
                 { id: 'logitech-brio', name: 'Webcam Logitech Brio 4K', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA90WPRoL1e_IZgtsAynwTd0uwZCutMmBm5lrp4_iXhrZ4y4RGxdyrRJBg4lcfXMcOUzEBfvFv-88kZYF3DgXi7DVDNaVYZNSE9stF3zQqkGJ5ERuMvVH7ZsajEBceOwCwygCvmY79ywpo1LgacJko_kVUz1CitxHWI0S4Hzd6WiZGNoYR6al0D2-DDPiTBcnQXml6L0LOUTJuMsICrcX6N0itaTO4NWLGUxdRbRIMWt_Ob6EQqRDd2yLCYj1wvhv0W89xI3bbZl48', expected: 1, state: { 'new': 1, 'very-good': 0, 'good': 0, 'broken': 0 }},
                 { id: 'blue-yeti', name: 'Microfon Blue Yeti', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDrrEp02wvfZxtWg-6pTpYoWk5WY550zQcXsHPFG-F3B6XsA2NEkSyVzAYfEpuFfNX_n_94nB2LSlLMIschh2UQ_3BTvqfrV5L8u_tEjc3iP3MaBH63V35_tWo43cufCjjUKMY8rMzqCQA1IeebWTWcRDQrmiGjDjDvlw4g10aYuHhJekSjZzi2SuffT3dT6JD7rwijqdJXOCiP2hn6WAcywkGeiT4JUdWeq0AGhXwX237Q3aZz4kWP86CLZypeAkAtBP_DTcd4-90', expected: 3, state: { 'new': 3, 'very-good': 0, 'good': 0, 'broken': 0 }},
                 { id: 'edifier-r1280t', name: 'Boxe Edifier R1280T', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAa-WDI0QBBMibwyMz17F0QH1i0yxM6pDnizXY1Q4lN2tmNwvBQ_u9m7oZ17tphpL8V4NEcxQSNydfzcwdVJqEqBRICsSlvQUx5tUHVhyfw7aZv4TiWrLFa65Y4_gIiq62rkkmqjp8vMY1T2JquFsUEqM0tLtMIEgHAHXOjwKXHZhoo1N7iee5EkZ2KBnfWsIqb27YZLgpnlHSeM13O_CB4Ea2Jg7Xd1tla9LZb8jHuva6_-5UwrcbfIYsADGkzrdIfcsnQN1bNzig', expected: 2, state: { 'new': 2, 'very-good': 0, 'good': 0, 'broken': 0 }},
                 { id: 'hp-laserjet', name: 'Imprimantă HP LaserJet Pro M404dn', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDjZFyhcKF1WH5CjIuebpIa6hXdUAyYppKcrIwn95sOdol9boasLuK8r02Jldg20qnfzIJFHAYgazDxkYhW8y6b6zqXAfbAnp8iwafUWu9HUvXtdElHpvzST6tvpnl1I50ZrPGtk-Sb0aq2Jgrbhucnbd2LcyG2c8-scKDZfPNW6sfIyYL0BO3hPZ7mKZmIO9DEPi4FcqEGY2yFFsprfLK3xk1-XDwTxbRMUgjdUmC-F7yGaY0GrWHn91dqrOvySseZhknBofG1VBE', expected: 1, state: { 'new': 1, 'very-good': 0, 'good': 0, 'broken': 0 }},
            ]
        }
        // Aici pot fi adaugate mai multe comenzi in viitor
    ];
    
    localStorage.setItem('commandsData', JSON.stringify(initialData));
    return initialData;
}

// Functie pentru a salva datele comenzilor
export function saveCommandsData(data) {
    localStorage.setItem('commandsData', JSON.stringify(data));
}

// Functii pentru a gestiona ID-ul comenzii curente
export function setCurrentCommandId(id) {
    sessionStorage.setItem('currentCommandId', id);
}

export function getCurrentCommandId() {
    return sessionStorage.getItem('currentCommandId');
}


// Functii pentru a gestiona ID-ul produsului curent
export function setCurrentProductId(id) {
    sessionStorage.setItem('currentProductId', id);
}

export function getCurrentProductId() {
    return sessionStorage.getItem('currentProductId');
}

