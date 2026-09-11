# Architettura

Documento tecnico. Spiega com'è fatto Quadro e, dove serve, perché è fatto così invece che in un altro modo ragionevole.

## Principi

1. **Le regole fiscali sono dati, non codice.** Nessun numero fiscale compare in un file `.ts`. Se ne trovi uno, è un bug.
2. **Il core è puro.** Nessun accesso a rete, disco, DOM o orologio dentro `packages/core`. Funzioni da input a output, quindi testabili senza impalcature.
3. **Il denaro sono centesimi interi.** Mai `number` in euro con decimali. Le percentuali sono decimali (`0.2607`) e ogni moltiplicazione passa da `mul()`, che arrotonda al centesimo.
4. **Nessun backend.** Non per minimalismo, ma perché un server che raccoglie dati fiscali di privati è una responsabilità che il progetto non vuole e un costo che non può sostenere.
5. **Modularità per chiavi, non per interruttori.** I moduli non si conoscono fra loro.

## Struttura

```
packages/rules      parametri fiscali per anno, schema Zod, loader
packages/core       tipi, utility monetarie, registro moduli, i moduli
apps/web            interfaccia React, build statica Vite
```

`rules` non dipende da niente. `core` dipende solo da `rules`. `web` dipende da entrambi e non contiene logica di calcolo: se ti trovi a scrivere una formula fiscale in un componente React, sei nel posto sbagliato.

## Il pacchetto rules

Un file per anno: `data/it-2025.json`, `it-2026.json`, `it-2027.json`. Ogni sezione porta un campo `fonte` con il riferimento normativo e, dove il valore non è ancora stato verificato su fonte primaria, `verificato: false`.

Quel flag non è decorativo: `parametriDaVerificare()` lo raccoglie e l'app lo mostra come avviso all'utente. Chi usa Quadro deve sapere quali numeri sono controllati e quali no. Oggi le gestioni Artigiani e Commercianti e le addizionali regionali sono marcate come non verificate.

Se si chiede un anno che non esiste, il loader usa il più recente disponibile e genera un avviso. La scelta è deliberata: un calcolo dichiaratamente approssimato è più utile di una schermata di errore, purché lo dica.

## Il modello dati

Un unico documento JSON per utente, con `schemaVersion`. Le migrazioni stanno in `datiIniziali.ts` come gradini numerati: un file scritto con una versione vecchia si aggiorna, uno scritto con una versione più nuova viene rifiutato con un messaggio chiaro invece di essere letto male.

Distinzione che regge tutto il resto: **competenza** e **cassa**. Una `Fattura` ha `dataEmissione` (competenza) e `dataIncasso` (cassa, nullable). Il forfettario tassa per cassa, la previsione ragiona per competenza, e tenerle separate nel tipo evita l'errore più comune dei fogli di calcolo fatti a mano.

## Il registro dei moduli

Un modulo dichiara:

```ts
{
  id: string
  richiede: string[]   // chiavi che si aspetta di trovare
  opzionali?: string[] // chiavi utili ma non necessarie
  fornisce: string[]   // chiavi che pubblica
  calcola(ctx): Contributo
  kpi(): Kpi[]
}
```

Il registro fa un ordinamento topologico sulle chiavi e chiama i moduli attivi in sequenza, accumulando i contributi in un `Contesto` condiviso. Tre errori vengono intercettati a monte: due moduli che forniscono la stessa chiave, una chiave richiesta che nessuno fornisce, una dipendenza circolare.

Il vantaggio pratico: il modulo `dipendente` pubblica `altraCoperturaPrevidenziale`, il modulo `forfettario` la elenca fra le `opzionali` e per questo viene calcolato dopo. L'aliquota INPS passa dal 26,07% al 24% senza che nessuno dei due moduli sappia dell'esistenza dell'altro, e senza un `if` nell'interfaccia.

Il rovescio della medaglia, da tenere presente: le chiavi sono stringhe, quindi il compilatore non le verifica. La protezione è a runtime, all'avvio, e i test la esercitano. Se il progetto crescerà molto, il passo successivo è generare un tipo unione delle chiavi dai moduli registrati.

## I movimenti

I moduli che spostano denaro emettono `Movimento`:

```ts
{ mese, importo, tipo, descrizione, impattaContoCorrente }
```

Il modulo `cassa` non ha logica propria: riduce la lista dei movimenti in dodici saldi progressivi. Aggiungere un modulo che genera flussi lo fa comparire in cassa senza modificare una riga di `cassa.ts`.

`impattaContoCorrente: false` serve per gli F24, che escono dal fondo tasse alimentato mese per mese. Se il fondo va sotto zero, il modulo `acconti` emette un avviso di livello `errore`: è lì che l'utente scopre che la rata di giugno finirà sul conto corrente.

## Gestioni previdenziali

La formula dei contributi è una sola e copre sia i casi percentuali puri sia quelli con minimale:

```
contributi = minimale
  ? contributoFisso + (min(reddito, massimale) - redditoMinimo)+ x aliquota
  : min(reddito, massimale) x aliquota
```

Gestione Separata ha `minimale: null`. Artigiani e Commercianti hanno contributo fisso e aliquota sull'eccedenza. Aggiungere una cassa professionale significa aggiungere una voce in `previdenza` nel JSON, non scrivere codice — finché il suo regolamento rientra in questa forma. Le casse con regole proprie (minimi soggettivi e integrativi, contributo di maternità) richiederanno un modulo dedicato: è un limite noto della forma attuale, non una svista.

## Cose che il codice sa e che vale la pena sapere

**La deduzione dei contributi vale per cassa.** Si deducono i contributi pagati nell'anno, non quelli maturati. Il modulo `forfettario` assume che coincidano e lo dichiara in un avviso. È l'approssimazione più significativa presente nel calcolo.

**Il netto da lavoro dipendente non è monotono.** Le fasce del bonus cuneo fiscale (7,1% fino a 8.500 euro, 5,3% fino a 15.000, 4,8% fino a 20.000) si applicano per fasce sull'intero reddito: superare 8.500 euro di imponibile fa perdere netto. È come è scritta la norma, non un bug, e c'è un test che lo documenta. Per questo `ralDaNetto()` non usa la ricerca binaria ma una scansione: la ricerca binaria darebbe risultati sbagliati proprio nella fascia dei redditi bassi.

**Il bonus cuneo si calcola sull'imponibile fiscale**, non sulla RAL, e la terza fascia è aperta: il tetto di 20.000 euro riguarda la spettanza, non la base di calcolo. Chi porta la formula da un foglio di calcolo tende a sbagliare esattamente qui.

**Il reddito forfettario entra per intero nell'ISEE.** Non paga IRPEF ma pesa sull'indicatore: sotto questo profilo il forfettario non è agevolato.

## Test

`packages/core/test/scenari.test.ts` contiene scenari fiscali di riferimento con i valori attesi ricavati da un prospetto verificato a mano. Se un numero cambia, o c'è un bug o è cambiata una regola: in entrambi i casi va spiegato nel messaggio di commit.

Ci sono anche test di proprietà: il netto cresce col lordo sopra le fasce del cuneo, la ripartizione dei centesimi non ne perde nessuno, il calcolo gira su uno stato completamente vuoto senza esplodere.

Quello che i test **non** garantiscono, e va detto: nessuno scenario è stato ancora riscontrato con un F24 reale o con il parere di un commercialista. Fino a quel momento il progetto resta un `v0`.

## Interfaccia

React con Vite, `base: './'` così la build funziona sia su GitHub Pages sia aperta da file locale. Nessun framework CSS: un foglio di stile con variabili, perché il valore del progetto sta nel motore di calcolo e non vale la pena pagare una dipendenza per l'aspetto.

Lo stato vive in un solo `useStato()`: legge da `localStorage`, ricalcola tutto a ogni modifica, scrive. Il calcolo completo su dati realistici sta sotto il millisecondo, quindi non serve memoizzare per pezzi.

La dashboard è generata dai `kpi()` dei moduli attivi. Aggiungere un modulo lo fa comparire senza toccare `App.tsx`.

## Cosa Quadro non farà

L'IVA, i registri, le liquidazioni periodiche. Nel momento in cui li aggiunge diventa un gestionale, entra in concorrenza con il software che gli utenti già pagano e si prende una responsabilità che non vuole. È un confine di prodotto, non un limite tecnico, e serve a tenere onesta la promessa del README.
