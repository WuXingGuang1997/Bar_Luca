# Menù Digitale per Bar & Caffetteria

Questo progetto è un sito web one-page responsive che funziona come menù digitale, con un pannello di amministrazione separato per la gestione dei prodotti.

## ✨ Architettura

Il progetto è diviso in due parti principali:

1.  **Sito Cliente (`index.html`)**: Una pagina ultra-leggera e veloce, ottimizzata per mobile, che mostra solamente il menù. I clienti accedono a questa pagina.
2.  **Pannello di Amministrazione (`admin.html`)**: Una pagina separata, protetta, che permette al gestore di modificare i prodotti, i prezzi, le categorie e le immagini. Le modifiche vengono salvate direttamente nel repository di GitHub.

## ✨ Caratteristiche

- **Interfaccia Cliente Semplificata**: Nessun fronzolo, solo il menù. Veloce e facile da navigare.
- **Pannello di Amministrazione Potente**: Gestisci l'intero menù da un'interfaccia web, senza toccare direttamente i file di codice.
- **Gestione Immagini Integrata**: Carica le foto dei prodotti direttamente dal pannello di amministrazione.
- **Serverless e Gratuito**: Tutto il sistema si appoggia a GitHub e GitHub Pages, senza costi di server o database.
- **Multilingua**: Supporto per italiano e inglese, gestibile dal pannello.
- **Personalizzabile**: Colori e font del sito cliente sono facilmente modificabili via CSS.

---

## 🚀 Come Iniziare: Guida Rapida

### 1. Prerequisiti: Account GitHub

- **Crea un account su GitHub**: Se non ne hai uno, registrati su [github.com](https://github.com).
- **Crea un nuovo repository**:
  - Clicca sul `+` in alto a destra e scegli "New repository".
  - Dai un nome al repository (es. `menu-bar-luca`).
  - Assicurati che sia **Pubblico** (Public).
  - Clicca su "Create repository".

### 2. Carica i File del Progetto

- Nella pagina del tuo nuovo repository, clicca su "Add file" > "Upload files".
- Trascina **tutti i file e la cartella `images`** del progetto in questa pagina.
- Clicca su "Commit changes".

### 3. Attiva GitHub Pages (per il sito cliente)

- Vai nella scheda "Settings" del tuo repository.
- Nel menu a sinistra, clicca su "Pages".
- Sotto "Branch", seleziona `main` e lascia la cartella come `/root`.
- Clicca su "Save".

Dopo qualche minuto, il tuo **sito per i clienti** sarà visibile all'indirizzo `https://TUO_NOME_UTENTE.github.io/NOME_DEL_TUO_REPO/`.

---

## 🔐 Configurazione del Pannello di Amministrazione (`admin.html`)

Per permettere alla pagina `admin.html` di modificare i file nel tuo repository, devi fornirle una chiave di accesso sicura.

### 1. Crea un Personal Access Token (PAT)

Questo token è una password speciale solo per il tuo pannello di amministrazione.

1.  Vai nelle impostazioni del tuo account GitHub: [github.com/settings/tokens](https://github.com/settings/tokens).
2.  Clicca su **"Generate new token"** e scegli **"Generate new token (classic)"**.
3.  **Note**: Dai un nome riconoscibile al token, es. `admin-menu-bar`.
4.  **Expiration**: Scegli una durata. Per semplicità, puoi scegliere "No expiration", ma per maggiore sicurezza puoi impostare una scadenza (es. 1 anno) e rinnovarlo quando necessario.
5.  **Select scopes**: Questa è la parte più importante. Devi dare al token il permesso di modificare i tuoi repository. Spunta la casella **`repo`**. Questo includerà automaticamente tutti i permessi necessari al suo interno.
6.  Clicca su **"Generate token"** in fondo alla pagina.
7.  **🚨 ATTENZIONE: Copia subito il token!** Ti verrà mostrato una sola volta. Trattalo come una password.

### 2. Accedi al Pannello di Amministrazione

1.  Apri la pagina di amministrazione nel tuo browser. L'indirizzo sarà:
    `https://TUO_NOME_UTENTE.github.io/NOME_DEL_TUO_REPO/admin.html`
2.  Vedrai una schermata di autenticazione. Inserisci:
    -   **Il tuo nome utente GitHub**: L'owner del repository.
    -   **Il nome del repository**: Es. `menu-bar-luca`.
    -   **Il tuo GitHub Personal Access Token**: Incolla qui il token che hai appena generato.
3.  Clicca su **"Accedi"**.

Le credenziali verranno salvate nel tuo browser, quindi non dovrai reinserirle ogni volta.

---

## 🔄 Come Aggiornare il Menù

Una volta effettuato l'accesso al pannello di amministrazione:

1.  **Scegli la lingua**: Usa il menu a tendina per scegliere se modificare il menù in italiano o in inglese.
2.  **Modifica i campi**: Clicca direttamente sui nomi, prezzi e descrizioni per cambiarli.
3.  **Elimina**: Usa i pulsanti "Elimina" per rimuovere un prodotto o un'intera categoria.
4.  **Aggiungi**: Usa i pulsanti "Aggiungi Prodotto" o "Aggiungi Categoria" per creare nuove voci.
5.  **Gestisci le immagini**:
    -   **Scegli Esistente**: Clicca su "📁 Scegli Esistente" per selezionare un'immagine già caricata nella cartella `images/`.
    -   **Carica Nuova**: Oppure clicca su "Scegli file" per caricare una nuova immagine dal tuo computer (JPG, PNG, GIF).
    -   Vedrai subito un'anteprima dell'immagine selezionata.
    -   Le nuove immagini verranno salvate automaticamente nella cartella `images/` del repository.
6.  **Salva tutto**: Quando hai finito le modifiche, clicca sul grande pulsante verde **"Salva Tutte le Modifiche su GitHub"**.

Il sistema caricherà prima le nuove immagini nella cartella `images/` e poi aggiornerà il file del menù. Le modifiche saranno visibili sul sito cliente in circa un minuto.

### ⚠️ Risoluzione Conflitti

Se ricevi un errore durante il salvataggio (es. "HTTP 409: Conflict"):

1. **Clicca su "🔄 Aggiorna File"** per sincronizzare con l'ultima versione del repository
2. **Riprova a salvare** le tue modifiche
3. Il sistema ora include un **meccanismo di retry automatico** che risolve la maggior parte dei conflitti

Questo può succedere se:
- Il file è stato modificato da un'altra sessione
- Ci sono problemi di sincronizzazione con GitHub
- Il repository è stato aggiornato esternamente

---

## 📸 Gestione Immagini

### Funzionalità Automatiche

- **Cartella Automatica**: Tutte le immagini vengono salvate automaticamente nella cartella `images/` del repository.
- **Selezione Immagini Esistenti**: Puoi riutilizzare immagini già caricate tramite il pulsante "📁 Scegli Esistente".
- **Galleria Visiva**: Le immagini esistenti vengono mostrate in una galleria con anteprime per una selezione facile.
- **Nomi Sicuri**: I nomi dei file vengono automaticamente convertiti in formato sicuro per evitare conflitti.
- **Anteprima Immediata**: Quando selezioni un'immagine, vedrai subito l'anteprima nel pannello di amministrazione.
- **Sincronizzazione Prezzi**: I prezzi vengono automaticamente sincronizzati tra italiano e inglese quando modificati.

### Formati Supportati

- **JPG/JPEG**: Consigliato per foto di prodotti
- **PNG**: Consigliato per loghi o immagini con trasparenza
- **GIF**: Supportato ma non consigliato per immagini statiche

### Consigli per le Immagini

- **Dimensioni**: Le immagini vengono automaticamente ridimensionate per il web, ma è consigliabile caricare immagini di dimensioni ragionevoli (max 1MB).
- **Qualità**: Usa immagini di buona qualità per un aspetto professionale.
- **Formato**: Preferisci JPG per le foto di cibo e bevande.
