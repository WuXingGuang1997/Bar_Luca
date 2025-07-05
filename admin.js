window.addEventListener('load', () => {
    // --- State Management ---
    const state = {
        owner: '',
        repo: '',
        token: '',
        menuData: null,
        currentLang: 'it',
        fileSha: null, // Per gli aggiornamenti su GitHub
        pendingImageUploads: new Map() // Mappa per gestire i file immagine in attesa di upload
    };

    // --- DOM Elements ---
    const authSection = document.getElementById('auth-section');
    const adminPanel = document.getElementById('admin-panel');
    const ownerInput = document.getElementById('github-owner');
    const repoInput = document.getElementById('github-repo');
    const tokenInput = document.getElementById('github-token');
    const authButton = document.getElementById('auth-button');
    const authStatus = document.querySelector('.auth-status');
    const langSelect = document.getElementById('lang-select');
    const menuEditor = document.getElementById('menu-editor');
    const saveChangesBtn = document.getElementById('save-changes-btn');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const statusArea = document.getElementById('status-area');
    const deploymentTimerEl = document.getElementById('last-saved-timer');

    // --- Deployment Timer Logic ---
    const deploymentTimer = {
        intervalId: null,
        stop: () => {
            if (deploymentTimer.intervalId) {
                clearInterval(deploymentTimer.intervalId);
                deploymentTimer.intervalId = null;
            }
        },
        start: () => {
            deploymentTimer.stop(); // Ferma qualsiasi timer precedente

            let countdown = 50; // 50 secondi di countdown
            
            const update = () => {
                deploymentTimerEl.classList.remove('hidden', 'success');
                deploymentTimerEl.classList.add('visible');

                if (countdown > 0) {
                    deploymentTimerEl.textContent = `✅ Salvataggio riuscito! Aggiornamento del sito in corso... Tempo stimato: ${countdown}s`;
                    countdown--;
                } else {
                    deploymentTimer.stop();
                    deploymentTimerEl.textContent = `🎉 Sito aggiornato! Le modifiche dovrebbero essere visibili.`;
                    deploymentTimerEl.classList.add('success');
                }
            };
            
            update(); // Chiamata immediata
            deploymentTimer.intervalId = setInterval(update, 1000);
        }
    };

    // --- Utility Functions ---
    const showStatus = (message, isError = false) => {
        statusArea.textContent = message;
        statusArea.className = isError ? 'error' : 'success';
        statusArea.style.display = 'block';
    };

    // Funzione per convertire un file in Base64
    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

    // Funzione per codificare testo UTF-8 in Base64 (gestisce caratteri speciali)
    const utf8ToBase64 = (str) => {
        // Usa TextEncoder per una codifica UTF-8 corretta
        const encoder = new TextEncoder();
        const bytes = encoder.encode(str);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

    // Funzione per generare un nome file sicuro
    const generateSafeFileName = (originalName) => {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const extension = originalName.split('.').pop().toLowerCase();
        const baseName = originalName.split('.')[0]
            .replace(/[^a-zA-Z0-9]/g, '_')
            .toLowerCase()
            .substring(0, 20);
        return `${baseName}_${timestamp}_${randomStr}.${extension}`;
    };

    // --- GitHub API Interaction (usando fetch direttamente) ---
    const github = {
        connect: async (owner, repo, token) => {
            try {
                // Verifica la connessione e i permessi
                const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                state.owner = owner;
                state.repo = repo;
                state.token = token;
                localStorage.setItem('github_creds', JSON.stringify({ owner, repo, token }));
                return true;
            } catch (error) {
                console.error("Errore di connessione a GitHub:", error);
                authStatus.textContent = `Connessione fallita. Controlla le credenziali e i permessi del token. Dettagli: ${error.message}`;
                authStatus.style.color = 'red';
                localStorage.removeItem('github_creds');
                return false;
            }
        },
        
        fetchMenuFile: async (lang) => {
            try {
                const filePath = `menu-${lang}.json`;
                const response = await fetch(`https://api.github.com/repos/${state.owner}/${state.repo}/contents/${filePath}`, {
                    headers: {
                        'Authorization': `token ${state.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (!response.ok) {
                    if (response.status === 404) {
                        showStatus(`Il file menu-${lang}.json non esiste nel repository. Verrà creato al primo salvataggio.`, true);
                        return { bar_name: "Nuovo Menù", categories: [], labels: {} };
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                state.fileSha = data.sha;
                
                // Decodifica da Base64 con supporto UTF-8
                const base64Content = data.content.replace(/\s/g, ''); // Rimuove spazi e newline
                const binaryString = atob(base64Content);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const decoder = new TextDecoder('utf-8');
                const content = decoder.decode(bytes);
                
                return JSON.parse(content);
            } catch (error) {
                console.error(`Errore nel fetch del file menu:`, error);
                showStatus(`Impossibile caricare il file dal repository: ${error.message}`, true);
                return null;
            }
        },

        uploadImage: async (fileName, fileContent) => {
            const filePath = `images/${fileName}`;
            showStatus(`Caricamento immagine: ${filePath}...`);
            try {
                // Prima assicuriamoci che la cartella images esista
                await github.ensureImagesFolder();
                
                const response = await fetch(`https://api.github.com/repos/${state.owner}/${state.repo}/contents/${filePath}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${state.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Add product image: ${fileName}`,
                        content: fileContent // Già in Base64
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                showStatus(`Immagine ${fileName} caricata con successo.`, false);
                return filePath;
            } catch (error) {
                console.error(`Errore caricamento immagine:`, error);
                showStatus(`Errore durante il caricamento di ${fileName}: ${error.message}`, true);
                throw error;
            }
        },

        // Funzione per assicurarsi che la cartella images esista
        ensureImagesFolder: async () => {
            try {
                // Verifica se la cartella images esiste già
                const response = await fetch(`https://api.github.com/repos/${state.owner}/${state.repo}/contents/images`, {
                    headers: {
                        'Authorization': `token ${state.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (response.status === 404) {
                    // La cartella non esiste, creiamo un file .gitkeep per crearla
                    await fetch(`https://api.github.com/repos/${state.owner}/${state.repo}/contents/images/.gitkeep`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${state.token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: 'Create images folder for product images',
                            content: utf8ToBase64('# This file ensures the images folder exists\n# Product images will be stored in this folder')
                        })
                    });
                    showStatus('Cartella images creata nel repository.', false);
                }
            } catch (error) {
                console.warn('Impossibile verificare/creare la cartella images:', error);
                // Non lanciamo l'errore perché l'upload potrebbe funzionare comunque
            }
        },

        // Funzione per recuperare le immagini esistenti nella cartella images
        getExistingImages: async () => {
            try {
                const response = await fetch(`https://api.github.com/repos/${state.owner}/${state.repo}/contents/images`, {
                    headers: {
                        'Authorization': `token ${state.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        return []; // Cartella non esiste ancora
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const files = await response.json();
                // Filtra solo i file immagine (esclude .gitkeep e altri file)
                const imageFiles = files.filter(file => {
                    const isFile = file.type === 'file';
                    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
                    const isNotGitkeep = file.name !== '.gitkeep';
                    return isFile && isImage && isNotGitkeep;
                });

                return imageFiles.map(file => ({
                    name: file.name,
                    path: file.path,
                    downloadUrl: file.download_url
                }));
            } catch (error) {
                console.warn('Impossibile recuperare le immagini esistenti:', error);
                return [];
            }
        },

        saveMenuFile: async (menuData) => {
            try {
                // 1. Carica prima tutte le immagini in attesa
                for (const [tempId, file] of state.pendingImageUploads.entries()) {
                    const base64Content = await toBase64(file);
                    const safeFileName = generateSafeFileName(file.name);
                    const newImagePath = await github.uploadImage(safeFileName, base64Content);
                    
                    // Aggiorna il percorso dell'immagine nei dati del menù
                    const findAndUpdatePath = (obj) => {
                        for(const key in obj) {
                            if(key === 'image' && obj[key] === tempId) {
                                obj[key] = newImagePath;
                                return;
                            }
                            if(typeof obj[key] === 'object') findAndUpdatePath(obj[key]);
                        }
                    };
                    findAndUpdatePath(menuData);
                }
                state.pendingImageUploads.clear();

                // 2. Salva il file JSON aggiornato con retry per conflitti
                await github.saveMenuFileWithRetry(menuData);

            } catch (error) {
                console.error('Errore durante il salvataggio:', error);
                showStatus(`Errore durante il salvataggio: ${error.message}. Potrebbe essere necessario ricaricare la pagina per ottenere l'ultima versione del file.`, true);
            }
        },

        // Nuova funzione per salvare con retry in caso di conflitti
        saveMenuFileWithRetry: async (menuData, retryCount = 0) => {
            const maxRetries = 3;
            const filePath = `menu-${state.currentLang}.json`;
            
            try {
                // Se è un retry, ricarica il file per ottenere l'ultimo SHA
                if (retryCount > 0) {
                    showStatus(`Tentativo ${retryCount + 1}/${maxRetries + 1}: Aggiornamento SHA...`);
                    await github.refreshFileSha(state.currentLang);
                }
                
                const content = utf8ToBase64(JSON.stringify(menuData, null, 2));
                
                showStatus(`Salvataggio del menù su GitHub... (tentativo ${retryCount + 1})`);
                
                const requestBody = {
                    message: `Aggiornamento menù (${state.currentLang}) - ${new Date().toISOString()}`,
                    content: content
                };
                
                // Aggiungi SHA solo se il file esiste già
                if (state.fileSha) {
                    requestBody.sha = state.fileSha;
                }
                
                const response = await fetch(`https://api.github.com/repos/${state.owner}/${state.repo}/contents/${filePath}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${state.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    if (response.status === 409 && retryCount < maxRetries) {
                        // Conflitto: riprova dopo un breve delay
                        showStatus(`Conflitto rilevato. Riprovo tra ${1000 + (retryCount * 500)}ms...`, true);
                        await new Promise(resolve => setTimeout(resolve, 1000 + (retryCount * 500)));
                        return await github.saveMenuFileWithRetry(menuData, retryCount + 1);
                    }
                    
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText}`);
                }
                
                const responseData = await response.json();
                state.fileSha = responseData.content.sha; // Aggiorna lo SHA per il prossimo salvataggio
                showStatus('Menù salvato con successo su GitHub!', false);
                deploymentTimer.start(); // Avvia il timer dell'ultimo salvataggio

            } catch (error) {
                if (error.message.includes('409') && retryCount < maxRetries) {
                    // Ultimo tentativo con refresh completo
                    showStatus(`Ultimo tentativo con refresh completo...`);
                    await github.refreshFileSha(state.currentLang);
                    return await github.saveMenuFileWithRetry(menuData, retryCount + 1);
                }
                throw error;
            }
        },

        // Funzione per aggiornare il SHA del file
        refreshFileSha: async (lang) => {
            try {
                const filePath = `menu-${lang}.json`;
                const response = await fetch(`https://api.github.com/repos/${state.owner}/${state.repo}/contents/${filePath}`, {
                    headers: {
                        'Authorization': `token ${state.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    state.fileSha = data.sha;
                    showStatus('SHA del file aggiornato.', false);
                } else if (response.status === 404) {
                    // File non esiste, rimuovi SHA
                    state.fileSha = null;
                    showStatus('File non trovato, verrà creato un nuovo file.', false);
                }
            } catch (error) {
                console.warn('Impossibile aggiornare SHA:', error);
                state.fileSha = null; // Reset SHA in caso di errore
            }
        }
    };

    // --- UI Rendering ---
    const render = {
        menuEditor: () => {
            menuEditor.innerHTML = '';
            if (!state.menuData) return;

            state.menuData.categories.forEach((category, catIndex) => {
                const categoryEl = render.category(category, catIndex);
                menuEditor.appendChild(categoryEl);
            });
        },
        category: (category, catIndex) => {
            const div = document.createElement('div');
            div.className = 'admin-category';
            div.innerHTML = `
                <div class="admin-category-header">
                    <input type="text" value="${category.name}" data-cat-index="${catIndex}" data-field="categoryName" placeholder="Nome Categoria">
                    <button class="delete-btn delete-category-btn" data-cat-index="${catIndex}">Elimina Categoria</button>
                </div>
            `;
            
            // Crea un contenitore a griglia per i prodotti
            const itemsGrid = document.createElement('div');
            itemsGrid.className = 'admin-items-grid';

            if (category.items.length > 0) {
                category.items.forEach((item, itemIndex) => {
                    itemsGrid.appendChild(render.item(item, catIndex, itemIndex));
                });
            } else {
                itemsGrid.innerHTML = `<p class="no-items-message">Nessun prodotto in questa categoria. Clicca "Aggiungi Prodotto" per iniziare.</p>`;
            }

            div.appendChild(itemsGrid);

            const addItemBtn = document.createElement('button');
            addItemBtn.className = 'add-item-btn';
            addItemBtn.dataset.catIndex = catIndex;
            addItemBtn.textContent = 'Aggiungi Prodotto';
            div.appendChild(addItemBtn);

            return div;
        },
        item: (item, catIndex, itemIndex) => {
            const div = document.createElement('div');
            div.className = 'admin-item';
            
            // Determina se mostrare l'immagine o un placeholder
            const hasImage = item.image && item.image.trim() !== '';
            const imageElement = hasImage 
                ? `<img src="${item.image}" alt="${item.name}" class="image-preview">` 
                : `<div class="no-image-placeholder">Nessuna<br>immagine</div>`;
            
            div.innerHTML = `
                <div class="admin-item-fields">
                    <div class="field-group">
                        <label>Nome Prodotto</label>
                        <input type="text" value="${item.name}" data-cat-index="${catIndex}" data-item-index="${itemIndex}" data-field="name" placeholder="Nome">
                    </div>
                    <div class="field-group">
                        <label>Prezzo</label>
                        <input type="text" value="${item.price}" data-cat-index="${catIndex}" data-item-index="${itemIndex}" data-field="price" placeholder="Prezzo">
                    </div>
                    <div class="field-group full-width">
                        <label>Descrizione</label>
                        <input type="text" value="${item.description}" data-cat-index="${catIndex}" data-item-index="${itemIndex}" data-field="description" placeholder="Descrizione">
                    </div>
                    <div class="field-group">
                        <label>Immagine</label>
                        <input type="text" value="${item.image}" data-cat-index="${catIndex}" data-item-index="${itemIndex}" data-field="image" placeholder="percorso/immagine.jpg" readonly>
                        <div class="image-options">
                            <button type="button" class="btn-secondary existing-images-btn" data-cat-index="${catIndex}" data-item-index="${itemIndex}">
                                📁 Scegli Esistente
                            </button>
                            <span class="or-separator">oppure</span>
                            <input type="file" accept="image/*" class="image-upload-input" data-cat-index="${catIndex}" data-item-index="${itemIndex}">
                        </div>
                        <div class="image-preview-container">
                            ${imageElement}
                        </div>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="delete-btn delete-item-btn" data-cat-index="${catIndex}" data-item-index="${itemIndex}">Elimina Prodotto</button>
                </div>
            `;
            return div;
        }
    };

    // --- Event Handlers ---
    const handle = {
        auth: async () => {
            const owner = ownerInput.value.trim();
            const repo = repoInput.value.trim();
            const token = tokenInput.value.trim();
            if (!owner || !repo || !token) {
                authStatus.textContent = 'Per favore, compila tutti i campi.';
                authStatus.style.color = 'red';
                return;
            }
            authStatus.textContent = 'Connessione in corso...';
            authStatus.style.color = 'orange';

            if (await github.connect(owner, repo, token)) {
                authSection.classList.add('hidden');
                adminPanel.classList.remove('hidden');
                await handle.loadCurrentMenu();
            }
        },

        loadCurrentMenu: async () => {
            state.currentLang = langSelect.value;
            showStatus(`Caricamento menù in ${state.currentLang}...`);
            state.menuData = await github.fetchMenuFile(state.currentLang);
            if (state.menuData) {
                render.menuEditor();
                showStatus(`Menù in ${state.currentLang} caricato.`, false);
            }
        },
        
        collectDataFromUI: () => {
            const newMenuData = {
                bar_name: state.menuData.bar_name, // Manteniamo i dati non modificabili
                labels: state.menuData.labels,
                categories: []
            };

            document.querySelectorAll('.admin-category').forEach((catEl, catIndex) => {
                const categoryName = catEl.querySelector('.category-name-input').value;
                const newCategory = { name: categoryName, items: [] };

                catEl.querySelectorAll('.admin-item').forEach((itemEl, itemIndex) => {
                    const newItem = {};
                    itemEl.querySelectorAll('input[data-field]').forEach(input => {
                        newItem[input.dataset.field] = input.value;
                    });
                    newCategory.items.push(newItem);
                });
                newMenuData.categories.push(newCategory);
            });
            return newMenuData;
        },

        saveChanges: async () => {
            const saveButton = document.getElementById('save-changes-btn');
            
            // Disabilita il pulsante per prevenire click multipli
            saveButton.disabled = true;

            let countdown = 50;
            const originalButtonText = saveButton.textContent;
            
            // Avvia il conto alla rovescia visivo
            const countdownInterval = setInterval(() => {
                countdown--;
                saveButton.textContent = `Attendi (${countdown}s)`;
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    saveButton.textContent = 'Salvataggio in corso...';
                }
            }, 1000);

            showStatus(`Inizio attesa di 50 secondi per la sincronizzazione di GitHub...`, false);

            setTimeout(async () => {
                clearInterval(countdownInterval); // Assicurati che il timer sia fermo
                
                try {
                    showStatus('Salvataggio in corso su GitHub...', false);
                    const menuDataToSave = JSON.parse(JSON.stringify(state.menuData));
                    await github.saveMenuFile(menuDataToSave);
                } catch (error) {
                    // L'errore viene già gestito all'interno di saveMenuFile,
                    // ma in caso di eccezioni impreviste, le mostriamo qui.
                    showStatus(`Errore imprevisto durante il salvataggio: ${error.message}`, true);
                    console.error("Errore non gestito in saveChanges:", error);
                } finally {
                    // Riabilita il pulsante e ripristina il testo originale
                    saveButton.disabled = false;
                    saveButton.textContent = originalButtonText;
                }
            }, 50000); // 50 secondi di attesa
        },

        delegate: async (event) => {
            const target = event.target;

            // Delete category
            if (target.matches('.delete-category-btn')) {
                const catIndex = parseInt(target.dataset.catIndex, 10);
                if (confirm(`Sei sicuro di voler eliminare la categoria "${state.menuData.categories[catIndex].name}" e tutti i suoi prodotti?`)) {
                    state.menuData.categories.splice(catIndex, 1);
                    render.menuEditor();
                }
            }

            // Delete item
            if (target.matches('.delete-item-btn')) {
                const catIndex = parseInt(target.dataset.catIndex, 10);
                const itemIndex = parseInt(target.dataset.itemIndex, 10);
                if (confirm(`Sei sicuro di voler eliminare questo prodotto?`)) {
                    state.menuData.categories[catIndex].items.splice(itemIndex, 1);
                    render.menuEditor();
                }
            }

            // Add item
            if (target.matches('.add-item-btn')) {
                const catIndex = parseInt(target.dataset.catIndex, 10);
                state.menuData.categories[catIndex].items.push({ name: 'Nuovo Prodotto', price: '0.00€', description: '', image: '' });
                render.menuEditor();
            }

            // Image Upload
            if (target.matches('.image-upload-input')) {
                const file = target.files[0];
                if (file) {
                    const catIndex = parseInt(target.dataset.catIndex, 10);
                    const itemIndex = parseInt(target.dataset.itemIndex, 10);
                    const tempId = `temp-id-${Date.now()}`;
                    
                    state.pendingImageUploads.set(tempId, file);

                    const imagePathInput = target.parentElement.previousElementSibling;
                    imagePathInput.value = tempId;
                    
                    // FIX: Aggiorna lo stato dei dati del menù IMMEDIATAMENTE
                    state.menuData.categories[catIndex].items[itemIndex].image = tempId;
                    
                    // Mostra anteprima dell'immagine selezionata
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const previewContainer = target.parentElement.nextElementSibling;
                        previewContainer.innerHTML = `<img src="${e.target.result}" alt="Anteprima" class="image-preview">`;
                    };
                    reader.readAsDataURL(file);
                    
                    showStatus(`Immagine "${file.name}" pronta per il caricamento. Salva per confermare.`, false);
                }
            }

            // Existing Images Button
            if (target.matches('.existing-images-btn')) {
                const catIndex = parseInt(target.dataset.catIndex, 10);
                const itemIndex = parseInt(target.dataset.itemIndex, 10);
                await handle.showExistingImagesModal(catIndex, itemIndex);
            }
        },

        addCategory: () => {
            state.menuData.categories.push({ name: 'Nuova Categoria', items: [] });
            render.menuEditor();
        },

        // Funzione per sincronizzare i prezzi tra le lingue
        syncPricesBetweenLanguages: async (catIndex, itemIndex, newPrice) => {
            try {
                const otherLang = state.currentLang === 'it' ? 'en' : 'it';
                const otherMenuData = await github.fetchMenuFile(otherLang);
                
                if (otherMenuData && 
                    otherMenuData.categories[catIndex] && 
                    otherMenuData.categories[catIndex].items[itemIndex]) {
                    
                    // Aggiorna il prezzo nell'altra lingua
                    otherMenuData.categories[catIndex].items[itemIndex].price = newPrice;
                    
                    // Salva temporaneamente il file dell'altra lingua
                    const currentLang = state.currentLang;
                    const currentSha = state.fileSha;
                    
                    state.currentLang = otherLang;
                    await github.saveMenuFile(otherMenuData);
                    
                    // Ripristina la lingua corrente
                    state.currentLang = currentLang;
                    state.fileSha = currentSha;
                    
                    showStatus(`Prezzo sincronizzato anche nella versione ${otherLang === 'it' ? 'italiana' : 'inglese'}.`, false);
                }
            } catch (error) {
                console.warn('Impossibile sincronizzare il prezzo con l\'altra lingua:', error);
            }
        },

        // Funzione per mostrare il modal delle immagini esistenti
        showExistingImagesModal: async (catIndex, itemIndex) => {
            try {
                showStatus('Caricamento immagini esistenti...', false);
                const existingImages = await github.getExistingImages();
                
                if (existingImages.length === 0) {
                    showStatus('Nessuna immagine trovata nella cartella images/. Carica prima alcune immagini.', true);
                    return;
                }

                // Crea il modal
                const modal = document.createElement('div');
                modal.className = 'image-modal';
                modal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Seleziona un'immagine esistente</h3>
                            <button class="modal-close">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="image-grid">
                                ${existingImages.map(img => `
                                    <div class="image-option" data-image-path="${img.path}">
                                        <img src="${img.downloadUrl}" alt="${img.name}" class="existing-image-preview">
                                        <span class="image-name">${img.name}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                // Event listeners per il modal
                modal.querySelector('.modal-close').addEventListener('click', () => {
                    document.body.removeChild(modal);
                });

                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        document.body.removeChild(modal);
                    }
                });

                // Event listener per la selezione dell'immagine
                modal.querySelectorAll('.image-option').forEach(option => {
                    option.addEventListener('click', () => {
                        const imagePath = option.dataset.imagePath;
                        const imageUrl = option.querySelector('img').src;
                        
                        // Aggiorna il campo dell'immagine
                        const imagePathInput = document.querySelector(`input[data-cat-index="${catIndex}"][data-item-index="${itemIndex}"][data-field="image"]`);
                        imagePathInput.value = imagePath;
                        
                        // Aggiorna l'anteprima
                        const previewContainer = imagePathInput.closest('.field-group').querySelector('.image-preview-container');
                        previewContainer.innerHTML = `<img src="${imageUrl}" alt="Immagine selezionata" class="image-preview">`;
                        
                        // Aggiorna anche i dati del menu
                        state.menuData.categories[catIndex].items[itemIndex].image = imagePath;
                        
                        showStatus(`Immagine "${option.querySelector('.image-name').textContent}" selezionata.`, false);
                        document.body.removeChild(modal);
                    });
                });

                showStatus('Clicca su un\'immagine per selezionarla.', false);
            } catch (error) {
                console.error('Errore nel caricamento delle immagini esistenti:', error);
                showStatus('Errore nel caricamento delle immagini esistenti.', true);
            }
        },

        // Funzione per aggiornare manualmente il file
        refreshFile: async () => {
            try {
                showStatus('Aggiornamento del file in corso...', false);
                await github.refreshFileSha(state.currentLang);
                
                // Ricarica il menu corrente
                const menuData = await github.fetchMenuFile(state.currentLang);
                if (menuData) {
                    state.menuData = menuData;
                    render.menuEditor();
                    showStatus('File aggiornato con successo. Ora puoi salvare le tue modifiche.', false);
                } else {
                    showStatus('Impossibile ricaricare il file. Controlla la connessione.', true);
                }
            } catch (error) {
                console.error('Errore durante l\'aggiornamento del file:', error);
                showStatus(`Errore durante l'aggiornamento: ${error.message}`, true);
            }
        },

        // Funzione per aggiornare i dati del menù quando un campo viene modificato
        updateMenuData: (catIndex, itemIndex, field, value) => {
            // ... existing code ...
        }
    };
    
    // --- Initialization ---
    function init() {
        const savedCreds = localStorage.getItem('github_creds');
        if (savedCreds) {
            const { owner, repo, token } = JSON.parse(savedCreds);
            ownerInput.value = owner;
            repoInput.value = repo;
            tokenInput.value = token;
            handle.auth();
        }
        
        authButton.addEventListener('click', handle.auth);
        langSelect.addEventListener('change', handle.loadCurrentMenu);
        saveChangesBtn.addEventListener('click', handle.saveChanges);
        addCategoryBtn.addEventListener('click', handle.addCategory);
        document.getElementById('refresh-file-btn').addEventListener('click', handle.refreshFile);
        menuEditor.addEventListener('click', handle.delegate);
        
        // Event listener per sincronizzazione prezzi
        menuEditor.addEventListener('blur', async (event) => {
            if (event.target.matches('input[data-field="price"]')) {
                const catIndex = parseInt(event.target.dataset.catIndex, 10);
                const itemIndex = parseInt(event.target.dataset.itemIndex, 10);
                const newPrice = event.target.value;
                
                if (newPrice && newPrice.trim() !== '') {
                    await handle.syncPricesBetweenLanguages(catIndex, itemIndex, newPrice);
                }
            }
        }, true);
        
        deploymentTimer.init();
    }

    init();
});
