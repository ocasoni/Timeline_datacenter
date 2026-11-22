# Timeline assonometrica

## Aprire il progetto

1. Estrai tutto lo ZIP.
2. In Visual Studio Code scegli **File → Apri cartella** e seleziona `Timeline_assonometrica_VSCode`.
3. Apri `index.html` nel browser. Oppure, se hai l’estensione Live Server, fai clic destro su `index.html` e scegli **Open with Live Server**.

Non servono npm, compilazione o dipendenze da installare. Immagini e font Inter sono inclusi e funzionano anche senza Internet. I collegamenti alle fonti aprono siti esterni e richiedono una connessione.

## File

- `index.html`: struttura della pagina e delle schede; contiene anche il disegno vettoriale della mappa dei data center.
- `css/style.css`: stile dell’interfaccia e caricamento del font locale.
- `js/app.js`: rendering, profondità, navigazione, hover e schede.
- `js/timeline-data.js`: eventi, testi, grafici, coordinate e percorsi delle immagini.
- `assets/images/`: immagini degli eventi, mappe e piano della timeline.
- `assets/fonts/`: font Inter in formato WOFF2.
- `.vscode/settings.json`: impostazioni facoltative per Live Server.

I percorsi delle immagini nei dati sono relativi a `index.html`; il percorso del font nel CSS è relativo a `css/style.css`. Mantieni la struttura delle cartelle quando sposti o condividi il progetto.

## Navigazione

Trascina per ruotare; usa la rotella per zoomare. Fai doppio clic nello spazio vuoto e trascina tenendo premuto per spostare la struttura; puoi anche trascinare con Maiusc premuto. Le viste si scelgono dall’icona in alto a destra. Passa sulle immagini per leggere i titoli e fai clic per aprire le schede.
