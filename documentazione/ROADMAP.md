# Roadmap

Ordine ragionato, non promesse con date.

## v0.1 — fatto

Nucleo del calcolo: forfettario in Gestione Separata, acconti di giugno e novembre, uscite, cassa mensile. Moduli attivabili per previsionale, lavoro dipendente, patrimonio, ISEE, regola 50-30-20. Interfaccia essenziale, export e import del file, regole 2025-2027.

## v0.2 — rendere l inserimento dati tollerabile

È il vero rischio di abbandono: nessuno inserisce cento fatture a mano.

- Import CSV con mappatura delle colonne, così funziona con l export di qualunque gestionale.
- Modalità semplificata: solo totali mensili, senza fatture singole.
- Duplicazione dell anno precedente con azzeramento dei movimenti.

## v0.3 — credibilità

- Almeno cinque scenari riscontrati con F24 reali o col parere di un commercialista.
- Verifica delle gestioni Artigiani e Commercianti, oggi marcate come non verificate.
- Aliquote addizionali comunali importate da una fonte pubblica invece dei valori di ripiego.
- Pagina che elenca ogni parametro con la sua fonte e la data di verifica.

## v0.4 — coprire altre situazioni

- Regime ordinario semplificato, senza IVA: costi deducibili reali e IRPEF a scaglioni.
- Casse professionali con regolamento proprio, come modulo dedicato.
- Riduzione contributiva del 35% per Artigiani e Commercianti.
- Contributo integrativo e rivalsa in fattura.

## v0.5 — connessioni

- Interfaccia `SorgenteFatture` con implementazioni per i gestionali più diffusi, partendo da CSV e poi API con OAuth PKCE lato browser.
- Import dei movimenti bancari via CSV per la riconciliazione delle uscite.

## Più avanti

- Confronto fra scenari: due o tre ipotesi affiancate.
- Multi-anno con riporto automatico dei saldi.
- Impacchettamento desktop con Tauri, se qualcuno lo chiede davvero. Prima serve la firma del codice, che costa soldi e tempo: non è una priorità finché la PWA basta.
- Traduzione dell interfaccia. Le regole restano italiane: un file `rules` per un altro paese è un progetto diverso.

## Cosa resta fuori, per scelta

Fatturazione elettronica, registri IVA, liquidazioni periodiche, dichiarazione dei redditi. Non è mancanza di tempo: è il confine che tiene Quadro uno strumento di pianificazione invece di un gestionale a metà.
