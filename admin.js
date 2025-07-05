document.addEventListener('DOMContentLoaded', () => {

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
            };

            this.dom = {
                // ... cache degli elementi del DOM ...
                saveButton: document.getElementById('save-button'),
                refreshButton: document.getElementById('refresh-button'),
                addCategoryBtn: document.getElementById('add-category-btn'),
                categoriesContainer: document.getElementById('categories-container'),
                mediaManager: document.getElementById('media-manager'),
                mediaGallery: document.getElementById('media-gallery'),
                mediaUploadInput: document.getElementById('media-upload-input'),
            };
            
            this.init();
        }

        init() {
            // ... logica di inizializzazione ...
            this.loadCredentials();
            this.addEventListeners();

            if (this.isAuthenticated()) {
                this.github.client = new Octokit({ auth: this.state.github.token });
                this.loadInitialData();
            }
        }
        
        addEventListeners() {
            // ... aggiunge tutti gli event listener ...
            this.dom.saveButton.addEventListener('click', () => this.saveData());
            this.dom.refreshButton.addEventListener('click', () => this.loadInitialData());
            this.dom.addCategoryBtn.addEventListener('click', () => this.addCategory());
            this.dom.mediaUploadInput.addEventListener('change', (e) => this.handleImageUpload(e));
        }
        
        // --- METODI DI GESTIONE MEDIA ---
        
        async renderMediaGallery() {
            this.showToast('Caricamento galleria immagini...');
            try {
                const response = await this.github.client.repos.getContent({
                    owner: this.state.github.owner,
                    repo: this.state.github.repo,
                    path: 'images'
                });

                this.dom.mediaGallery.innerHTML = '';
                const imageFiles = response.data.filter(file => /\.(jpe?g|png|gif|webp)$/i.test(file.name));

                if (imageFiles.length === 0) {
                    this.dom.mediaGallery.innerHTML = '<p>Nessuna immagine trovata. Caricane una!</p>';
                    return;
                }

                imageFiles.forEach(file => {
                    const galleryItem = document.createElement('div');
                    galleryItem.className = 'gallery-item';
                    galleryItem.innerHTML = `
                        <img src="${file.download_url}" alt="${file.name}" loading="lazy">
                        <div class="gallery-item-overlay">
                            <span class="gallery-item-name">${file.name}</span>
                            <button class="delete-image-btn" data-path="${file.path}" data-sha="${file.sha}" title="Elimina immagine">&times;</button>
                        </div>
                    `;
                    
                    // Aggiunge l'immagine al prodotto selezionato
                    galleryItem.querySelector('img').addEventListener('click', () => {
                        this.assignImageToProduct(file.path);
                    });
                    
                    // Gestisce l'eliminazione
                    galleryItem.querySelector('.delete-image-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.deleteImage(file.path, file.sha);
                    });

                    this.dom.mediaGallery.appendChild(galleryItem);
                });

            } catch (error) {
                console.error('Errore nel caricare la galleria:', error);
                this.showToast('Errore nel caricare la galleria.', 'error');
                this.dom.mediaGallery.innerHTML = '<p>Errore nel caricamento della galleria.</p>';
            }
        }

        async handleImageUpload(event) {
            // ... logica per l'upload di una nuova immagine ...
        }

        async deleteImage(path, sha) {
            if (!confirm(`Sei sicuro di voler eliminare l'immagine "${path}"? L'azione è irreversibile.`)) return;
            // ... logica per eliminare l'immagine da GitHub ...
        }
        
        // --- METODI DI SELEZIONE E ASSEGNAZIONE IMMAGINE ---

        prepareImageUpdate(catIndex, itemIndex) {
            this.state.productForImageUpdate = { catIndex, itemIndex };
            this.showToast('Seleziona un\'immagine dalla galleria qui sopra.', 'info');
            this.dom.mediaManager.scrollIntoView({ behavior: 'smooth' });
            // Evidenzia il prodotto corrente
        }

        assignImageToProduct(imagePath) {
            const { productForImageUpdate } = this.state;
            if (!productForImageUpdate) {
                this.showToast('Prima clicca sull\'anteprima di un prodotto per scegliere dove inserire l'immagine.', 'info');
                return;
            }
            
            const { catIndex, itemIndex } = productForImageUpdate;
            this.state.data.categories[catIndex].items[itemIndex].image = imagePath;
            this.state.isDirty = true;
            
            this.showToast(`Immagine "${imagePath}" assegnata! Salva le modifiche.`);
            this.state.productForImageUpdate = null; // Resetta lo stato
            this.render(); // Aggiorna la UI
        }

        // --- METODI DI RENDERING UI ---

        createProductItemHTML(item, catIndex, itemIndex) {
            // HTML del prodotto SENZA i controlli di upload
            const imageSrc = item.image ? `https://raw.githubusercontent.com/${this.state.github.owner}/${this.state.github.repo}/main/${item.image}` : 'placeholder.png';
            
            return `
                <div class="product-image-container">
                    <img src="${imageSrc}" alt="Anteprima" class="product-image-preview" onerror="this.src='placeholder.png';">
                    <button class="change-image-btn">Cambia</button>
                </div>
                <!-- Altri input per nome, prezzo, etc. -->
            `;
        }

        render() {
            // ... logica di rendering principale che usa le nuove funzioni ...
        }
        
        // ... tutti gli altri metodi (saveData, loadData, auth, etc.) riorganizzati
    }

    // Inizializza l'app
    new AdminApp();
});
