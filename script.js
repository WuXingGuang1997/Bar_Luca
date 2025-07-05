document.addEventListener('DOMContentLoaded', () => {

    class MenuApp {
        constructor() {
            this.state = {
                currentLanguage: localStorage.getItem('preferredLanguage') || 'it',
                menuData: null
            };

            this.dom = {
                menuAccordion: document.getElementById('menu-accordion'),
                langToggleBtn: document.getElementById('lang-toggle'),
                barName: document.getElementById('bar-name'),
                barDescription: document.getElementById('bar-description')
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
                this.dom.menuAccordion.innerHTML = `<p class="text-center text-danger">Non è stato possibile caricare il menù. Riprova più tardi.</p>`;
            }
        }

        toggleLanguage() {
            const newLang = this.state.currentLanguage === 'it' ? 'en' : 'it';
            this.loadMenu(newLang);
        }

        createMenuItem(item) {
            const hasImage = item.image && item.image.trim() !== '';
            return `
                <div class="list-group-item menu-item-bs">
                    <div class="d-flex w-100">
                        ${hasImage ? `<img src="${item.image}" alt="${item.name}" class="menu-item-img">` : ''}
                        <div class="flex-grow-1 ${hasImage ? 'ms-3' : ''}">
                            <div class="d-flex w-100 justify-content-between">
                                <h5 class="mb-1 item-name">${item.name}</h5>
                                <span class="item-price">${item.price}</span>
                            </div>
                            <p class="mb-1 item-description">${item.description}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        createCategorySection(category, index) {
            const categoryId = `category-${index}`;
            const itemsHtml = category.items.map(item => this.createMenuItem(item)).join('');
            
            return `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="heading-${categoryId}">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${categoryId}" aria-expanded="false" aria-controls="collapse-${categoryId}">
                            ${category.name}
                        </button>
                    </h2>
                    <div id="collapse-${categoryId}" class="accordion-collapse collapse" aria-labelledby="heading-${categoryId}" data-bs-parent="#menu-accordion">
                        <div class="accordion-body p-0">
                            <div class="list-group list-group-flush">
                                ${itemsHtml || '<p class="p-3">Nessun prodotto in questa categoria.</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        renderMenu() {
            const data = this.state.menuData;
            if (!data) return;

            this.dom.barName.textContent = data.bar_name;
            this.dom.langToggleBtn.textContent = data.labels.language_toggle;
            
            const categoriesHtml = data.categories.map((category, index) => this.createCategorySection(category, index)).join('');
            this.dom.menuAccordion.innerHTML = categoriesHtml;
        }
    }

    new MenuApp();

});
