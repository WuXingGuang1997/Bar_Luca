document.addEventListener('DOMContentLoaded', () => {

    const GITHUB_API_URL = 'https://api.github.com';

    // Funzione per codificare il contenuto per l'API di GitHub
    function b64EncodeUnicode(str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
            return String.fromCharCode('0x' + p1);
        }));
    }

    class AdminApp {
        constructor() {
            this.state = {
                github: {
                    owner: localStorage.getItem('github_owner'),
                    repo: localStorage.getItem('github_repo'),
                    token: localStorage.getItem('github_token'),
                    branch: 'main',
                    client: null
                },
                currentLang: 'it',
                data: null, // Conterrà menu-it.json
                dataEn: null, // Conterrà menu-en.json
                fileSha: null, // SHA di menu-it.json
                fileShaEn: null, // SHA di menu-en.json
                isDirty: false, // Indica se ci sono modifiche da salvare
                productForImageUpdate: null, // { catIndex, itemIndex }
                isAuthenticated: false
            };

            this.dom = {
                authSection: document.getElementById('auth-section'),
                adminPanel: document.getElementById('admin-panel'),
                ownerInput: document.getElementById('github-owner'),
                repoInput: document.getElementById('github-repo'),
                tokenInput: document.getElementById('github-token'),
                authButton: document.getElementById('auth-button'),
                authStatus: document.querySelector('.auth-status'),
                saveButton: document.getElementById('save-changes-btn'),
                refreshButton: document.getElementById('refresh-file-btn'),
                addCategoryBtn: document.getElementById('add-category-btn'),
                categoriesContainer: document.getElementById('menu-editor'),
                mediaManager: document.getElementById('media-manager'),
                mediaGallery: document.getElementById('media-gallery'),
                mediaUploadInput: document.getElementById('media-upload-input'),
                langSelect: document.getElementById('lang-select'),
                toastContainer: document.getElementById('toast-container')
            };
            
            this.init();
        }

        init() {
            this.loadCredentials();
            this.addEventListeners();

            if (this.state.github.owner && this.state.github.repo && this.state.github.token) {
                this.handleAuth(true); // Prova l'autenticazione silenziosa
            }
        }
        
        addEventListeners() {
            this.dom.authButton.addEventListener('click', () => this.handleAuth(false));
            this.dom.saveButton.addEventListener('click', () => this.saveData());
            this.dom.refreshButton.addEventListener('click', () => this.loadInitialData());
            this.dom.addCategoryBtn.addEventListener('click', () => this.addCategory());
            this.dom.mediaUploadInput.addEventListener('change', (e) => this.handleMediaUpload(e));
            this.dom.langSelect.addEventListener('change', (e) => this.switchLanguage(e.target.value));
        }
        
        // --- AUTENTICAZIONE E GESTIONE CREDENZIALI ---

        loadCredentials() {
            if (this.state.github.owner) this.dom.ownerInput.value = this.state.github.owner;
            if (this.state.github.repo) this.dom.repoInput.value = this.state.github.repo;
            if (this.state.github.token) this.dom.tokenInput.value = this.state.github.token;
        }

        async handleAuth(isSilent = false) {
            if (!isSilent) {
                this.state.github.owner = this.dom.ownerInput.value.trim();
                this.state.github.repo = this.dom.repoInput.value.trim();
                this.state.github.token = this.dom.tokenInput.value.trim();
            }

            if (this.state.github.owner && this.state.github.repo && this.state.github.token) {
                localStorage.setItem('github_owner', this.state.github.owner);
                localStorage.setItem('github_repo', this.state.github.repo);
                localStorage.setItem('github_token', this.state.github.token);

                this.state.isAuthenticated = true;
                this.dom.authSection.classList.add('hidden');
                this.dom.adminPanel.classList.remove('hidden');

                // Assicurati che Octokit sia disponibile prima di usarlo
                if (typeof Octokit === "undefined") {
                    this.showToast("Libreria Octokit non trovata. Assicurati che lo script sia caricato.", "error");
                    return;
                }
                this.state.github.client = new Octokit({ auth: this.state.github.token });
                
                await this.loadInitialData();
                if (!isSilent) this.showToast('Autenticazione riuscita!', 'success');

            } else if (!isSilent) {
                this.showToast('Per favore, compila tutti i campi.', 'error');
            }
        }
        
        async loadInitialData() {
            if (!this.state.isAuthenticated) return;
            this.showToast('Caricamento dati in corso...');
            try {
                await this.loadFile('it');
                await this.loadFile('en');
                this.render();
                await this.renderMediaGallery();
                this.showToast('Dati caricati con successo!', 'success');
            } catch (error) {
                this.showToast(`Errore nel caricamento dei dati: ${error.message}`, 'error');
            }
        }
        
        async loadFile(lang) {
            try {
                const filePath = `menu-${lang}.json`;
                const response = await this.state.github.client.repos.getContent({
                    owner: this.state.github.owner,
                    repo: this.state.github.repo,
                    path: filePath,
                });
                const content = atob(response.data.content);
                const data = JSON.parse(content);

                if (lang === 'it') {
                    this.state.data = data;
                    this.state.fileSha = response.data.sha;
                } else {
                    this.state.dataEn = data;
                    this.state.fileShaEn = response.data.sha;
                }
            } catch (error) {
                console.error(`Errore caricamento ${lang}:`, error);
                throw new Error(`Impossibile caricare menu-${lang}.json`);
            }
        }

        async saveData() {
            this.showToast('Salvataggio in corso...');
            try {
                // Salva menu-it.json
                await this.state.github.client.repos.createOrUpdateFileContents({
                    owner: this.state.github.owner,
                    repo: this.state.github.repo,
                    path: 'menu-it.json',
                    message: `Aggiornamento menù (IT) - ${new Date().toISOString()}`,
                    content: b64EncodeUnicode(JSON.stringify(this.state.data, null, 2)),
                    sha: this.state.fileSha
                });
                
                // Salva menu-en.json
                await this.state.github.client.repos.createOrUpdateFileContents({
                    owner: this.state.github.owner,
                    repo: this.state.github.repo,
                    path: 'menu-en.json',
                    message: `Aggiornamento menù (EN) - ${new Date().toISOString()}`,
                    content: b64EncodeUnicode(JSON.stringify(this.state.dataEn, null, 2)),
                    sha: this.state.fileShaEn
                });

                this.showToast('Modifiche salvate con successo!', 'success');
                this.state.isDirty = false;
                await this.loadInitialData(); // Ricarica i dati per ottenere i nuovi SHA

            } catch (error) {
                console.error('Errore durante il salvataggio:', error);
                this.showToast(`Errore durante il salvataggio: ${error.message}`, 'error');
            }
        }

        // --- GESTIONE MEDIA ---
        
        async renderMediaGallery() {
            this.showToast('Caricamento galleria...');
            this.dom.mediaGallery.innerHTML = '<p>Caricamento...</p>';
            try {
                const response = await this.state.github.client.repos.getContent({
                    owner: this.state.github.owner,
                    repo: this.state.github.repo,
                    path: 'images'
                });
        
                this.dom.mediaGallery.innerHTML = '';
                const imageFiles = response.data.filter(file => file.type === 'file' && /\.(jpe?g|png|gif|webp)$/i.test(file.name));
        
                if (imageFiles.length === 0) {
                    this.dom.mediaGallery.innerHTML = '<p>Nessuna immagine trovata.</p>';
                    return;
                }
        
                imageFiles.forEach(file => {
                    const item = document.createElement('div');
                    item.className = 'gallery-item';
                    item.innerHTML = `
                        <img src="${file.download_url}" alt="${file.name}" loading="lazy">
                        <div class="gallery-item-overlay">
                            <span class="gallery-item-name" title="${file.name}">${file.name}</span>
                            <button class="delete-image-btn" data-path="${file.path}" data-sha="${file.sha}">&times;</button>
                        </div>
                    `;
                    item.querySelector('img').addEventListener('click', () => this.assignImageToProduct(file.path));
                    item.querySelector('.delete-image-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteImage(file.path, file.sha);
                    });
                    this.dom.mediaGallery.appendChild(item);
                });
            } catch (error) {
                this.dom.mediaGallery.innerHTML = '<p>Errore nel caricare la galleria.</p>';
                console.error(error);
            }
        }

        async handleMediaUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            this.showToast(`Caricamento di ${file.name}...`);
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target.result.split(',')[1]; // Contenuto in Base64
                const path = `images/${Date.now()}_${file.name}`;

                try {
                    await this.state.github.client.repos.createOrUpdateFileContents({
                        owner: this.state.github.owner,
                        repo: this.state.github.repo,
                        path: path,
                        message: `Aggiunta immagine: ${file.name}`,
                        content: content
                    });
                    this.showToast('Immagine caricata con successo!', 'success');
                    await this.renderMediaGallery();
                } catch (error) {
                    console.error('Errore upload immagine:', error);
                    this.showToast(`Errore upload: ${error.message}`, 'error');
                }
            };
            reader.readAsDataURL(file);
        }

        async deleteImage(path, sha) {
            if (!confirm(`Sei sicuro di voler eliminare l'immagine "${path}"? L'azione è irreversibile.`)) return;

            this.showToast(`Eliminazione di ${path}...`);
            try {
                await this.state.github.client.repos.deleteFile({
                    owner: this.state.github.owner,
                    repo: this.state.github.repo,
                    path: path,
                    message: `Eliminazione immagine: ${path}`,
                    sha: sha
                });
                this.showToast('Immagine eliminata!', 'success');
                await this.renderMediaGallery();
            } catch (error) {
                console.error('Errore eliminazione immagine:', error);
                this.showToast(`Errore eliminazione: ${error.message}`, 'error');
            }
        }
        
        // --- ASSEGNAZIONE IMMAGINE ---

        prepareImageUpdate(catIndex, itemIndex) {
            this.state.productForImageUpdate = { catIndex, itemIndex };
            this.showToast('Seleziona un\'immagine dalla galleria qui sopra.', 'info');
            this.dom.mediaManager.scrollIntoView({ behavior: 'smooth' });
            
            // Evidenzia prodotto (opzionale)
            document.querySelectorAll('.product-item.highlight').forEach(el => el.classList.remove('highlight'));
            const productElement = this.dom.categoriesContainer.querySelector(`[data-cat-index="${catIndex}"] .product-item[data-item-index="${itemIndex}"]`);
            if(productElement) productElement.classList.add('highlight');
        }

        assignImageToProduct(imagePath) {
            const { productForImageUpdate } = this.state;
            if (!productForImageUpdate) {
                this.showToast('Prima clicca "Cambia Immagine" su un prodotto.', 'info');
                return;
            }
            
            const { catIndex, itemIndex } = productForImageUpdate;
            const currentData = this.state.currentLang === 'it' ? this.state.data : this.state.dataEn;
            currentData.categories[catIndex].items[itemIndex].image = imagePath;
            
            this.state.isDirty = true;
            this.showToast(`Immagine "${imagePath}" assegnata! Salva le modifiche.`);
            this.state.productForImageUpdate = null;
            this.render();
        }

        // --- LOGICA DI RENDER E MANIPOLAZIONE DOM ---
        
        switchLanguage(lang) {
            this.state.currentLang = lang;
            this.render();
        }

        addCategory() {
            const name = prompt('Nome della nuova categoria:');
            if (!name) return;
            
            const newCategory = { name: name, items: [] };
            this.state.data.categories.push({ ...newCategory });
            this.state.dataEn.categories.push({ ...newCategory }); // Aggiungi anche in inglese
            
            this.state.isDirty = true;
            this.render();
        }

        deleteCategory(catIndex) {
            if (!confirm('Sei sicuro di voler eliminare questa categoria e tutti i suoi prodotti?')) return;
            this.state.data.categories.splice(catIndex, 1);
            this.state.dataEn.categories.splice(catIndex, 1);
            this.state.isDirty = true;
            this.render();
        }

        addItem(catIndex) {
            const newItem = { name: 'Nuovo Prodotto', price: '0.00', description: '', image: '' };
            this.state.data.categories[catIndex].items.push({ ...newItem });
            this.state.dataEn.categories[catIndex].items.push({ ...newItem });
            this.state.isDirty = true;
            this.render();
        }

        deleteItem(catIndex, itemIndex) {
            if (!confirm('Sei sicuro di voler eliminare questo prodotto?')) return;
            this.state.data.categories[catIndex].items.splice(itemIndex, 1);
            this.state.dataEn.categories[catIndex].items.splice(itemIndex, 1);
            this.state.isDirty = true;
            this.render();
        }

        handleInputChange(catIndex, itemIndex, field, value) {
            const currentData = this.state.currentLang === 'it' ? this.state.data : this.state.dataEn;
            currentData.categories[catIndex].items[itemIndex][field] = value;
            this.state.isDirty = true;
            
            // Sincronizza il prezzo tra le lingue
            if (field === 'price') {
                const otherData = this.state.currentLang === 'it' ? this.state.dataEn : this.state.data;
                otherData.categories[catIndex].items[itemIndex][field] = value;
            }
        }
        
        createProductItemHTML(item, catIndex, itemIndex) {
            const imageUrl = item.image ? `https://raw.githubusercontent.com/${this.state.github.owner}/${this.state.github.repo}/main/${item.image}` : '';
            return `
                <div class="product-item" data-item-index="${itemIndex}">
                    <div class="product-image-container">
                        <img src="${imageUrl || 'placeholder.png'}" class="product-image-preview" onerror="this.src='placeholder.png';">
                        <button class="change-image-btn" data-cat-index="${catIndex}" data-item-index="${itemIndex}">Cambia</button>
                    </div>
                    <div class="product-fields">
                        <input type="text" placeholder="Nome prodotto" value="${item.name}" data-field="name" data-cat-index="${catIndex}" data-item-index="${itemIndex}">
                        <input type="text" placeholder="Prezzo" value="${item.price}" data-field="price" data-cat-index="${catIndex}" data-item-index="${itemIndex}">
                        <textarea placeholder="Descrizione" data-field="description" data-cat-index="${catIndex}" data-item-index="${itemIndex}">${item.description}</textarea>
                        <button class="delete-item-btn" data-cat-index="${catIndex}" data-item-index="${itemIndex}">Elimina Prodotto</button>
                    </div>
                </div>
            `;
        }
        
        render() {
            if (!this.state.isAuthenticated) return;
            
            const data = this.state.currentLang === 'it' ? this.state.data : this.state.dataEn;
            if (!data) return;
            
            this.dom.categoriesContainer.innerHTML = '';
            data.categories.forEach((cat, catIndex) => {
                const catDiv = document.createElement('div');
                catDiv.className = 'category-item';
                catDiv.dataset.catIndex = catIndex;
                
                let itemsHTML = '';
                cat.items.forEach((item, itemIndex) => {
                    itemsHTML += this.createProductItemHTML(item, catIndex, itemIndex);
                });

                catDiv.innerHTML = `
                    <div class="category-header">
                        <input type="text" class="category-name-input" value="${cat.name}" data-cat-index="${catIndex}">
                        <div>
                            <button class="add-item-btn" data-cat-index="${catIndex}">Aggiungi Prodotto</button>
                            <button class="delete-category-btn" data-cat-index="${catIndex}">Elimina Categoria</button>
                        </div>
                    </div>
                    <div class="product-list">${itemsHTML}</div>
                `;
                this.dom.categoriesContainer.appendChild(catDiv);
            });
            this.addRenderEventListeners();
        }

        addRenderEventListeners() {
            // Aggiunge event listener a tutti gli elementi appena renderizzati
            this.dom.categoriesContainer.querySelectorAll('input, textarea').forEach(input => {
                input.addEventListener('input', (e) => {
                    const { catIndex, itemIndex, field } = e.target.dataset;
                    this.handleInputChange(parseInt(catIndex), parseInt(itemIndex), field, e.target.value);
                });
            });
            this.dom.categoriesContainer.querySelectorAll('.delete-category-btn').forEach(btn => btn.addEventListener('click', (e) => this.deleteCategory(parseInt(e.target.dataset.catIndex))));
            this.dom.categoriesContainer.querySelectorAll('.add-item-btn').forEach(btn => btn.addEventListener('click', (e) => this.addItem(parseInt(e.target.dataset.catIndex))));
            this.dom.categoriesContainer.querySelectorAll('.delete-item-btn').forEach(btn => btn.addEventListener('click', (e) => this.deleteItem(parseInt(e.target.dataset.catIndex), parseInt(e.target.dataset.itemIndex))));
            this.dom.categoriesContainer.querySelectorAll('.change-image-btn').forEach(btn => btn.addEventListener('click', (e) => this.prepareImageUpdate(parseInt(e.target.dataset.catIndex), parseInt(e.target.dataset.itemIndex))));
        }

        showToast(message, type = 'info', duration = 3000) {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            this.dom.toastContainer.appendChild(toast);
            setTimeout(() => toast.remove(), duration);
        }
    }

    new AdminApp();
});
