document.addEventListener('DOMContentLoaded', () => {

    class MenuApp {
        constructor() {
            this.state = {
                currentLanguage: localStorage.getItem('preferredLanguage') || 'it',
                menuData: null
            };

            this.dom = {
                menuContainer: document.getElementById('menu-container'),
                langToggleBtn: document.getElementById('lang-toggle'),
                barName: document.getElementById('bar-name')
            };

            this.init();
        }

        async init() {
            this.dom.langToggleBtn.addEventListener('click', () => this.toggleLanguage());
            await this.loadMenu(this.state.currentLanguage);
        }

        async loadMenu(lang) {
            try {
                const response = await fetch(`menu-${lang}.json?v=${new Date().getTime()}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                this.state.menuData = await response.json();
                this.state.currentLanguage = lang;
                localStorage.setItem('preferredLanguage', lang);
                this.renderMenu();
            } catch (error) {
                console.error("Failed to load menu:", error);
                this.dom.menuContainer.innerHTML = `<p class="error-message">Non è stato possibile caricare il menù. Riprova più tardi.</p>`;
            }
        }

        toggleLanguage() {
            const newLang = this.state.currentLanguage === 'it' ? 'en' : 'it';
            this.loadMenu(newLang);
        }

        createMenuItem(item) {
            const itemElement = document.createElement('div');
            itemElement.className = 'menu-item';
            itemElement.innerHTML = `
                ${item.image ? `<img src="${item.image}" alt="${item.name}" class="menu-item-image" loading="lazy" onerror="this.style.display='none'">` : ''}
                <div class="menu-item-content">
                    <div class="menu-item-header">
                        <h3 class="menu-item-name">${item.name}</h3>
                        <span class="menu-item-price">${item.price}</span>
                    </div>
                    <p class="menu-item-description">${item.description}</p>
                </div>
            `;
            return itemElement;
        }

        createCategorySection(category) {
            const section = document.createElement('div');
            section.className = 'category';
        
            const header = document.createElement('div');
            header.className = 'category-header';
            header.innerHTML = `
                <h2>${category.name}</h2>
                <span class="category-toggle">▼</span>
            `;
            
            const itemsGrid = document.createElement('div');
            itemsGrid.className = 'category-items';
            
            if(category.items && category.items.length > 0) {
                category.items.forEach(item => {
                    const itemElement = this.createMenuItem(item);
                    itemsGrid.appendChild(itemElement);
                });
            } else {
                itemsGrid.innerHTML = `<p>Nessun prodotto in questa categoria.</p>`;
            }
            
            section.appendChild(header);
            section.appendChild(itemsGrid);
            
            // Funzionalità di apertura/chiusura
            header.addEventListener('click', () => {
                section.classList.toggle('open');
            });
            
            return section;
        }

        renderMenu() {
            const data = this.state.menuData;
            if (!data) return;

            this.dom.barName.textContent = data.bar_name;
            this.dom.langToggleBtn.textContent = data.labels.language_toggle;
            
            this.dom.menuContainer.innerHTML = '';
            const fragment = document.createDocumentFragment();

            data.categories.forEach(category => {
                const categorySection = this.createCategorySection(category);
                fragment.appendChild(categorySection);
            });

            this.dom.menuContainer.appendChild(fragment);
        }
    }

    new MenuApp();

});
