document.addEventListener('DOMContentLoaded', () => {

    const state = {
        currentLanguage: 'it',
        menuData: null
    };

    // Elementi del DOM
    const menuContainer = document.getElementById('menu-container');
    const langToggleBtn = document.getElementById('lang-toggle');

    // Funzione per caricare i dati del menù
    async function loadMenu(lang) {
        try {
            // Aggiungiamo un parametro per evitare problemi di cache
            const response = await fetch(`menu-${lang}.json?v=${new Date().getTime()}`);
            if (!response.ok) {
                throw new Error(`Errore caricamento menù: ${response.statusText}`);
            }
            state.menuData = await response.json();
            state.currentLanguage = lang;
            localStorage.setItem('preferredLanguage', lang);
            renderMenu();
        } catch (error) {
            console.error(error);
            menuContainer.innerHTML = `<p style="text-align:center;">Errore nel caricamento del menù. Riprova più tardi.</p>`;
        }
    }

    // Funzione per renderizzare il menù
    function renderMenu() {
        const data = state.menuData;
        if (!data) return;

        // Imposta i testi dell'interfaccia
        document.title = data.bar_name + " - Menù Digitale";
        langToggleBtn.textContent = data.labels.language_toggle;

        // Pulisce il contenitore del menù
        menuContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        data.categories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';

            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            categoryHeader.innerHTML = `
                <h2>${category.name}</h2>
                <span class="category-toggle">+</span>
            `;

            const categoryItems = document.createElement('div');
            categoryItems.className = 'category-items';

            if (category.items.length === 0) {
                 categoryItems.innerHTML = `<p>Nessun articolo in questa categoria.</p>`;
            } else {
                category.items.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'menu-item';
                    itemDiv.innerHTML = `
                        ${item.image && item.image.trim() !== '' ? `<img src="${item.image}" alt="${item.name}" class="menu-item-image" loading="lazy" onerror="this.style.display='none'">` : ''}
                        <div class="menu-item-details">
                            <div class="menu-item-header">
                                <span class="menu-item-name">${item.name}</span>
                                <span class="menu-item-price">${item.price}</span>
                            </div>
                            <p class="menu-item-description">${item.description}</p>
                        </div>
                    `;
                    categoryItems.appendChild(itemDiv);
                });
            }
            
            categoryDiv.appendChild(categoryHeader);
            categoryDiv.appendChild(categoryItems);
            fragment.appendChild(categoryDiv);

            // Event listener per l'accordion
            categoryHeader.addEventListener('click', () => {
                categoryDiv.classList.toggle('open');
            });
        });

        menuContainer.appendChild(fragment);
    }

    // Funzione per cambiare lingua
    function toggleLanguage() {
        const newLang = state.currentLanguage === 'it' ? 'en' : 'it';
        loadMenu(newLang);
    }

    // Event listeners
    langToggleBtn.addEventListener('click', toggleLanguage);

    // Inizializzazione
    function init() {
        const savedLang = localStorage.getItem('preferredLanguage') || 'it';
        loadMenu(savedLang);
    }

    init();
});
