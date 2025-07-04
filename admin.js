window.addEventListener('load', () => {
    // --- State Management ---
    const state = {
        octokit: null,
        owner: '',
        repo: '',
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

    // --- GitHub API Interaction ---
    const github = {
        connect: async (owner, repo, token) => {
            state.octokit = new Octokit({ auth: token });
            try {
                // Verifica la connessione e i permessi
                await state.octokit.request('GET /repos/{owner}/{repo}', { owner, repo });
                state.owner = owner;
                state.repo = repo;
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
                const { data } = await state.octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                    owner: state.owner,
                    repo: state.repo,
                    path: filePath,
                });
                state.fileSha = data.sha;
                const content = atob(data.content); // Decodifica da Base64
                return JSON.parse(content);
            } catch (error) {
                if (error.status === 404) {
                    showStatus(`Il file menu-${lang}.json non esiste nel repository. Verrà creato al primo salvataggio.`, true);
                    return { bar_name: "Nuovo Menù", categories: [], labels: {} };
                }
                console.error(`Errore nel fetch del file menu:`, error);
                showStatus(`Impossibile caricare il file dal repository: ${error.message}`, true);
                return null;
            }
        },

        uploadImage: async (fileName, fileContent) => {
            const filePath = `images/${fileName}`;
            showStatus(`Caricamento immagine: ${filePath}...`);
            try {
                await state.octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                    owner: state.owner,
                    repo: state.repo,
                    path: filePath,
                    message: `Aggiunge immagine: ${fileName}`,
                    content: fileContent, // Già in Base64
                });
                showStatus(`Immagine ${fileName} caricata con successo.`, false);
                return filePath;
            } catch (error) {
                console.error(`Errore caricamento immagine:`, error);
                showStatus(`Errore durante il caricamento di ${fileName}: ${error.message}`, true);
                throw error;
            }
        },

        saveMenuFile: async (menuData) => {
            try {
                // 1. Carica prima tutte le immagini in attesa
                for (const [tempId, file] of state.pendingImageUploads.entries()) {
                    const base64Content = await toBase64(file);
                    const newImagePath = await github.uploadImage(file.name, base64Content);
                    
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

                // 2. Salva il file JSON aggiornato
                const filePath = `menu-${state.currentLang}.json`;
                const content = btoa(JSON.stringify(menuData, null, 2)); // Codifica in Base64
                
                showStatus('Salvataggio del menù su GitHub...');
                const { data } = await state.octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                    owner: state.owner,
                    repo: state.repo,
                    path: filePath,
                    message: `Aggiornamento menù (${state.currentLang})`,
                    content: content,
                    sha: state.fileSha, // Obbligatorio per aggiornare un file esistente
                });

                state.fileSha = data.content.sha; // Aggiorna lo SHA per il prossimo salvataggio
                showStatus('Menù salvato con successo su GitHub!', false);

            } catch (error) {
                console.error('Errore durante il salvataggio:', error);
                showStatus(`Errore durante il salvataggio: ${error.message}. Potrebbe essere necessario ricaricare la pagina per ottenere l'ultima versione del file.`, true);
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
                    <input type="text" value="${category.name}" class="category-name-input" data-cat-index="${catIndex}" placeholder="Nome Categoria">
                    <div class="category-actions">
                        <button class="delete-btn delete-category-btn" data-cat-index="${catIndex}">Elimina Categoria</button>
                    </div>
                </div>
            `;

            category.items.forEach((item, itemIndex) => {
                const itemEl = render.item(item, catIndex, itemIndex);
                div.appendChild(itemEl);
            });

            const addItemBtn = document.createElement('button');
            addItemBtn.textContent = 'Aggiungi Prodotto';
            addItemBtn.className = 'add-item-btn';
            addItemBtn.dataset.catIndex = catIndex;
            div.appendChild(addItemBtn);

            return div;
        },
        item: (item, catIndex, itemIndex) => {
            const div = document.createElement('div');
            div.className = 'admin-item';
            
            // Genera un ID temporaneo per l'immagine se non è un percorso valido
            const imageIdentifier = item.image.startsWith('images/') ? item.image : (item.image ? `File: ${item.image.split('\\').pop()}` : '');
            const tempImageId = `temp-img-${Date.now()}`;
            
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
                    <div class="field-group full-width">
                        <label>Immagine</label>
                        <input type="text" value="${item.image}" data-cat-index="${catIndex}" data-item-index="${itemIndex}" data-field="image" placeholder="percorso/immagine.jpg" readonly>
                        <input type="file" accept="image/*" class="image-upload-input" data-cat-index="${catIndex}" data-item-index="${itemIndex}">
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
            const updatedMenu = handle.collectDataFromUI();
            await github.saveMenuFile(updatedMenu);
        },

        delegate: (event) => {
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

                    const imagePathInput = target.previousElementSibling;
                    imagePathInput.value = tempId;
                    
                    showStatus(`Immagine "${file.name}" pronta per il caricamento. Salva per confermare.`, false);
                }
            }
        },

        addCategory: () => {
            state.menuData.categories.push({ name: 'Nuova Categoria', items: [] });
            render.menuEditor();
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
        menuEditor.addEventListener('click', handle.delegate);
    }

    init();
});
