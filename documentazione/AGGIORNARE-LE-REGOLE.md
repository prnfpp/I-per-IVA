# Aggiornare le regole fiscali

È il contributo più utile al progetto e non richiede di saper programmare: si modifica un file JSON.

## Ogni gennaio

1. Copia `packages/rules/data/it-<anno precedente>.json` in `it-<anno nuovo>.json`.
2. Cambia `anno` e `aggiornatoIl`.
3. Aggiorna i parametri che sono cambiati con la Legge di Bilancio e con le circolari INPS.
4. Registra il file in `packages/rules/src/index.ts` (tre righe: import, voce nella mappa).
5. Metti `verificato: false` su tutto quello che non hai controllato su fonte primaria.
6. `npm test`. Se un test si rompe, guarda cosa: potrebbe essere corretto che si rompa.
7. Apri una PR spiegando, parametro per parametro, da dove viene il numero.

## Dove si guarda

| Parametro | Fonte |
| --- | --- |
| Aliquote e massimale Gestione Separata | Circolare INPS di inizio anno, di norma a febbraio |
| Contributi Artigiani e Commercianti | Circolare INPS di inizio anno: minimale, contributo fisso, aliquote |
| Scaglioni IRPEF, detrazioni, cuneo fiscale | Legge di Bilancio e TUIR art. 13 |
| Soglie del forfettario | L. 190/2014 e successive modifiche |
| Coefficienti di redditività | Allegato 4 alla L. 190/2014, per gruppo di codici ATECO |
| Franchigie e scala di equivalenza ISEE | DPCM 159/2013 e Legge di Bilancio |
| Addizionali regionali e comunali | Delibere di regione e comune. Sono centinaia: il file ne contiene poche, con un valore di ripiego |

## Regole di buon senso

Un parametro senza `fonte` non entra. "L'ho letto su un sito di consulenza" non è una fonte: serve la norma o la circolare.

Se una regola cambia forma e non solo valore — una nuova fascia, un meccanismo diverso — allora tocca anche lo schema in `src/schema.ts` e probabilmente il modulo che la usa. In quel caso la PR va accompagnata da uno scenario di test.

Non modificare i file degli anni passati per "sistemarli": servono a ricalcolare anni chiusi. Un errore in un anno passato si corregge, ma il commit deve dirlo.
