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
    const dom = {
        authSection: document.getElementById('auth-section'),
        adminPanel: document.getElementById('admin-panel'),
        ownerInput: document.getElementById('github-owner'),
        repoInput: document.getElementById('github-repo'),
        tokenInput: document.getElementById('github-token'),
        authButton: document.getElementById('auth-button'),
        authStatus: document.querySelector('#auth-section .auth-status'),
        langSelect: document.getElementById('lang-select'),
        menuEditor: document.getElementById('menu-editor'),
        saveChangesBtn: document.getElementById('save-changes-btn'),
        addCategoryBtn: document.getElementById('add-category-btn'),
        refreshFileBtn: document.getElementById('refresh-file-btn'),
        statusArea: document.getElementById('status-area'),
        deploymentTimerEl: document.getElementById('last-saved-timer'),
        mediaGrid: document.getElementById('media-grid'),
        mediaUploadArea: document.querySelector('.media-upload-area'),
        mediaUploadInput: document.getElementById('media-upload-input'),
        mediaTab: document.getElementById('media-tab'),
    };

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
                dom.deploymentTimerEl.classList.remove('hidden', 'success');
                dom.deploymentTimerEl.classList.add('visible');

                if (countdown > 0) {
                    dom.deploymentTimerEl.textContent = `✅ Salvataggio riuscito! Aggiornamento del sito in corso... Tempo stimato: ${countdown}s`;
                    countdown--;
                } else {
                    deploymentTimer.stop();
                    dom.deploymentTimerEl.textContent = `🎉 Sito aggiornato! Le modifiche dovrebbero essere visibili.`;
                    dom.deploymentTimerEl.classList.add('success');
                }
            };
            
            update(); // Chiamata immediata
            deploymentTimer.intervalId = setInterval(update, 1000);
        }
    };

    // --- Utility Functions ---
    const showStatus = (message, isError = false) => {
        dom.statusArea.textContent = message;
        dom.statusArea.className = isError ? 'error' : 'success';
        dom.statusArea.style.display = 'block';
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
                dom.authStatus.innerHTML = `<div class="alert alert-danger">Connessione fallita: ${error.message}</div>`;
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

                const data = await response.json();
                // Filtra solo i file, escludi le sottocartelle e i file nascosti
                return data
                    .filter(item => item.type === 'file' && !item.name.startsWith('.'))
                    .map(item => ({
                        name: item.name,
                        path: item.path,
                        sha: item.sha,
                        downloadUrl: item.download_url
                    }));
            } catch (error) {
                console.error(`Errore nel recuperare le immagini:`, error);
                showStatus('Impossibile caricare la galleria di immagini.', true);
                return [];
            }
        },

        deleteImage: async (image) => {
             if (!confirm(`Sei sicuro di voler eliminare l'immagine "${image.name}"? L'azione è irreversibile.`)) {
                return false;
            }

            showStatus(`Eliminazione di ${image.name}...`);
            try {
                 const response = await fetch(`https://api.github.com/repos/${state.owner}/${state.repo}/contents/${image.path}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${state.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Delete image: ${image.name}`,
                        sha: image.sha
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                showStatus(`Immagine "${image.name}" eliminata con successo.`, false);
                return true;

            } catch (error) {
                console.error(`Errore durante l'eliminazione dell'immagine:`, error);
                showStatus(`Errore durante l'eliminazione di ${image.name}: ${error.message}`, true);
                return false;
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
            
            // Deep copy per modificare i dati prima del salvataggio
            const dataToSave = JSON.parse(JSON.stringify(menuData));

            // Assicura che tutti i prezzi siano stringhe formattate correttamente
            dataToSave.categories.forEach(category => {
                if (category.items) {
                    category.items.forEach(item => {
                        if (item.hasOwnProperty('price')) {
                            const priceValue = parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0;
                            item.price = `${priceValue.toFixed(2)}€`;
                        }
                    });
                }
            });
            
            try {
                // Se è un retry, ricarica il file per ottenere l'ultimo SHA
                if (retryCount > 0) {
                    showStatus(`Tentativo ${retryCount + 1}/${maxRetries + 1}: Aggiornamento SHA...`);
                    await github.refreshFileSha(state.currentLang);
                }
                
                const content = utf8ToBase64(JSON.stringify(dataToSave, null, 2));
                
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
                showStatus('✅ Menù salvato con successo su GitHub!', false);
                deploymentTimer.start(); // Avvia il timer di deployment

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
            if (!state.menuData) return;
            dom.menuEditor.innerHTML = state.menuData.categories.map((cat, catIndex) => render.category(cat, catIndex)).join('');
        },
        category: (category, catIndex) => {
            const itemsHtml = category.items.map((item, itemIndex) => render.item(item, catIndex, itemIndex)).join('');
            return `
                <div class="accordion-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-cat-${catIndex}">
                            <input type="text" class="form-control-plaintext category-name-input" value="${category.name}" data-cat-index="${catIndex}" data-field="categoryName">
                        </button>
                    </h2>
                    <div id="collapse-cat-${catIndex}" class="accordion-collapse collapse" data-bs-parent="#menu-editor">
                        <div class="accordion-body">
                            <div class="list-group">
                                ${itemsHtml}
                            </div>
                             <button class="btn btn-outline-primary btn-sm mt-2 add-item-btn" data-cat-index="${catIndex}">Aggiungi Prodotto</button>
                        </div>
                         <button class="btn btn-danger btn-sm m-2 delete-category-btn" data-cat-index="${catIndex}">Elimina Categoria</button>
                    </div>
                </div>
            `;
        },
        item: (item, catIndex, itemIndex) => {
            return `
                <div class="list-group-item">
                    <div class="row g-2 align-items-center">
                        <div class="col-md-3">
                            <input type="text" class="form-control form-control-sm" value="${item.name}" placeholder="Nome prodotto" data-field="name" data-cat-index="${catIndex}" data-item-index="${itemIndex}">
                        </div>
                        <div class="col-md-4">
                             <textarea class="form-control form-control-sm" placeholder="Descrizione" data-field="description" data-cat-index="${catIndex}" data-item-index="${itemIndex}">${item.description}</textarea>
                        </div>
                        <div class="col-md-2">
                            <div class="input-group input-group-sm">
                                <input type="number" class="form-control" value="${String(item.price).replace('€','')}" placeholder="Prezzo" data-field="price" data-cat-index="${catIndex}" data-item-index="${itemIndex}">
                                <span class="input-group-text">€</span>
                            </div>
                        </div>
                        <div class="col-md-3 d-flex align-items-center">
                            <img src="${item.image || 'placeholder.png'}" class="img-thumbnail me-2" style="width: 40px; height: 40px;">
                            <button class="btn btn-outline-secondary btn-sm choose-existing-btn" data-cat-index="${catIndex}" data-item-index="${itemIndex}">...</button>
                            <button class="btn btn-outline-danger btn-sm ms-1 delete-item-btn" data-cat-index="${catIndex}" data-item-index="${itemIndex}">X</button>
                        </div>
                    </div>
                </div>
            `;
        },
        mediaLibrary: (images) => {
            dom.mediaGrid.innerHTML = images.map(img => `
                <div class="col">
                    <div class="card h-100">
                        <img src="${img.downloadUrl}" class="card-img-top" alt="${img.name}">
                        <div class="card-body p-2">
                            <p class="card-text small">${img.name}</p>
                        </div>
                        <div class="card-footer p-1">
                            <button class="btn btn-danger btn-sm w-100 delete-media-btn" data-image-path="${img.path}" data-image-sha="${img.sha}" data-image-name="${img.name}">Elimina</button>
                        </div>
                    </div>
                </div>
            `).join('');
        },
        imageModal: (images, catIndex, itemIndex) => {
            // ... logica per creare e mostrare un modal di Bootstrap ...
        }
    };

    // --- Event Handlers ---
    const handle = {
        auth: async () => {
            const owner = dom.ownerInput.value.trim();
            const repo = dom.repoInput.value.trim();
            const token = dom.tokenInput.value.trim();
            if (!owner || !repo || !token) {
                dom.authStatus.innerHTML = `<div class="alert alert-danger">Per favore, compila tutti i campi.</div>`;
                return;
            }
            dom.authStatus.innerHTML = '<div class="alert alert-info">Connessione in corso...</div>';

            if (await github.connect(owner, repo, token)) {
                dom.authSection.classList.add('hidden');
                dom.adminPanel.classList.remove('hidden');
                await handle.loadCurrentMenu();
            }
        },

        loadCurrentMenu: async () => {
            state.currentLang = dom.langSelect.value;
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

            let countdown = 1;
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
            }, 1000); // 50 secondi di attesa
        },

        delegateMenuActions: async (event) => {
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

            // Existing Images Button
            if (target.matches('.existing-images-btn')) {
                const catIndex = parseInt(target.dataset.catIndex, 10);
                const itemIndex = parseInt(target.dataset.itemIndex, 10);
                await handle.showExistingImagesModal(catIndex, itemIndex);
            }
        },
        
        delegateMediaActions: async (event) => {
            if (event.target.matches('.delete-media-btn')) {
                const mediaItem = event.target.closest('.media-item');
                const imageName = mediaItem.dataset.imageName;
                const imageSha = mediaItem.dataset.imageSha;
                const imagePath = mediaItem.dataset.imagePath;

                const deleted = await github.deleteImage({ name: imageName, sha: imageSha, path: imagePath });
                if (deleted) {
                    await handle.loadMediaLibrary();
                }
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
                
                if (otherMenuData && otherMenuData.categories[catIndex]?.items[itemIndex]) {
                    otherMenuData.categories[catIndex].items[itemIndex].price = newPrice;
                    
                    const currentLang = state.currentLang;
                    state.currentLang = otherLang;
                    await github.saveMenuFile(otherMenuData);
                    
                    state.currentLang = currentLang;
                    await github.fetchMenuFile(currentLang); // Ricarica il file corrente per avere lo SHA corretto
                    
                    showStatus(`Prezzo sincronizzato anche in ${otherLang}.`, false);
                }
            } catch (error) {
                console.warn('Impossibile sincronizzare il prezzo con l\'altra lingua:', error);
            }
        },

        // Funzione per sincronizzare le immagini tra le lingue
        syncImagesBetweenLanguages: async (catIndex, itemIndex, newImagePath) => {
            try {
                const otherLang = state.currentLang === 'it' ? 'en' : 'it';
                const otherMenuData = await github.fetchMenuFile(otherLang);

                if (otherMenuData && otherMenuData.categories[catIndex]?.items[itemIndex]) {
                    otherMenuData.categories[catIndex].items[itemIndex].image = newImagePath;
                    
                    const currentLang = state.currentLang;
                    state.currentLang = otherLang;
                    await github.saveMenuFile(otherMenuData);
                    
                    state.currentLang = currentLang;
                    await github.fetchMenuFile(currentLang); // Ricarica il file corrente per avere lo SHA corretto

                    showStatus(`Immagine sincronizzata anche in ${otherLang}.`, false);
                }
            } catch (error) {
                console.warn('Impossibile sincronizzare l\'immagine con l\'altra lingua:', error);
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
                    option.addEventListener('click', async () => {
                        const imagePath = option.dataset.imagePath;
                        const imageUrl = option.querySelector('img').src;
                        
                        // Aggiorna il campo dell'immagine
                        const imagePathInput = document.querySelector(`input[data-cat-index="${catIndex}"][data-item-index="${itemIndex}"][data-field="image"]`);
                        imagePathInput.value = imagePath;
                        
                        // Aggiorna l'anteprima
                        const previewContainer = imagePathInput.closest('.field-group-img').querySelector('.image-preview-container');
                        previewContainer.innerHTML = `<img src="${imageUrl}" alt="Immagine selezionata" class="image-preview">`;
                        
                        // Aggiorna anche i dati del menu
                        state.menuData.categories[catIndex].items[itemIndex].image = imagePath;
                        
                        showStatus(`Immagine "${option.querySelector('.image-name').textContent}" selezionata.`, false);
                        
                        // Sincronizza l'immagine con l'altra lingua
                        await handle.syncImagesBetweenLanguages(catIndex, itemIndex, imagePath);
                        
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
        },

        tabs: (event) => {
            if (!event.target.matches('.tab-btn')) return;

            const tab = event.target.dataset.tab;

            // Gestione dei pulsanti
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');

            // Gestione dei contenuti
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            let containerIdToShow;
            if (tab === 'menu') {
                containerIdToShow = 'menu-editor-container';
            } else if (tab === 'media') {
                containerIdToShow = 'media-library-container';
            }
            
            if (containerIdToShow) {
                document.getElementById(containerIdToShow).classList.add('active');
            }

            if (tab === 'media') {
                handle.loadMediaLibrary();
            }
        },

        loadMediaLibrary: async () => {
            showStatus('Caricamento galleria media...', false);
            const images = await github.getExistingImages();
            render.mediaLibrary(images);
            showStatus('Galleria caricata.', false);
        },

        mediaUpload: async (files) => {
            if (files.length === 0) return;

            showStatus(`Caricamento di ${files.length} immagini in corso...`, false);
            const uploadPromises = [];

            for (const file of files) {
                const safeName = generateSafeFileName(file.name);
                const promise = toBase64(file)
                    .then(base64Content => github.uploadImage(safeName, base64Content));
                uploadPromises.push(promise);
            }

            try {
                await Promise.all(uploadPromises);
                showStatus(`${files.length} immagini caricate con successo!`, false);
                // Ricarica la galleria per mostrare le nuove immagini
                await handle.loadMediaLibrary();
            } catch (error) {
                showStatus(`Errore durante il caricamento di una o più immagini.`, true);
            }
        }
    };
    
    // --- Initialization ---
    function init() {
        const savedCreds = localStorage.getItem('github_creds');
        if (savedCreds) {
            const { owner, repo, token } = JSON.parse(savedCreds);
            dom.ownerInput.value = owner;
            dom.repoInput.value = repo;
            dom.tokenInput.value = token;
            handle.auth();
        }
        
        dom.authButton.addEventListener('click', handle.auth);
        dom.langSelect.addEventListener('change', handle.loadCurrentMenu);
        dom.saveChangesBtn.addEventListener('click', handle.saveChanges);
        dom.addCategoryBtn.addEventListener('click', handle.addCategory);
        dom.refreshFileBtn.addEventListener('click', handle.refreshFile);
        
        // Delegati per eventi specifici
        dom.menuEditor.addEventListener('click', handle.delegateMenuActions);
        dom.mediaGrid.addEventListener('click', handle.delegateMediaActions);
        
        // Event listener per sincronizzazione prezzi
        dom.menuEditor.addEventListener('blur', async (event) => {
            if (event.target.matches('input[data-field="price"]')) {
                const catIndex = parseInt(event.target.dataset.catIndex, 10);
                const itemIndex = parseInt(event.target.dataset.itemIndex, 10);
                const newPrice = event.target.value;
                
                if (newPrice && newPrice.trim() !== '') {
                    await handle.syncPricesBetweenLanguages(catIndex, itemIndex, newPrice);
                }
            }
        }, true);

        // Tab switching
        dom.tabsContainer.addEventListener('click', handle.tabs);

        // Media upload listeners
        dom.mediaUploadArea.addEventListener('click', () => dom.mediaUploadInput.click());
        dom.mediaUploadInput.addEventListener('change', (e) => handle.mediaUpload(e.target.files));

        // Drag & Drop for media upload
        dom.mediaUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dom.mediaUploadArea.classList.add('dragover');
        });
        dom.mediaUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dom.mediaUploadArea.classList.remove('dragover');
        });
        dom.mediaUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dom.mediaUploadArea.classList.remove('dragover');
            handle.mediaUpload(e.dataTransfer.files);
        });
    }

    init();
});
