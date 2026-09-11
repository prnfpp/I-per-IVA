# I per IVA

**[Apri l'app →](https://prnfpp.github.io/I-per-IVA/)**

Pianificazione fiscale e patrimoniale per partite IVA italiane. Gira nel browser, i dati restano sul tuo dispositivo, non c'è nessun server.

Non serve installare niente e non serve registrarsi: apri il link, premi *Carica i dati di esempio* e ci giri dentro.

## A cosa serve

Non emette fatture: quello lo fa già il gestionale che usi. Risponde alle domande che il gestionale non affronta.

- Quanto devo mettere da parte su questo bonifico che è appena arrivato?
- Quanto mi uscirà davvero a giugno e a novembre, e ce li ho?
- Se accetto quel contratto da dipendente, resto nel forfettario?
- Quanti mesi di spese copre il mio fondo di emergenza?
- Con che ISEE mi presento quest'anno?

## Perché non un foglio di calcolo

Perché un foglio di calcolo mescola le regole fiscali con i tuoi dati. Quando cambia un'aliquota vai a caccia delle celle, e la formula sovrascritta a mano tre mesi prima non te la ricordi più.

Qui le regole stanno in `packages/rules/data/it-<anno>.json`, versionate e con la fonte normativa accanto a ogni parametro. Il codice non contiene numeri fiscali. Cambiare anno significa cambiare un file, e i test dicono subito se qualcosa si è rotto.

## Cosa fa

Sempre attivo:

| Modulo | Cosa calcola |
| --- | --- |
| `forfettario` | Imposta sostitutiva e contributi sugli incassi, per cassa. Soglie di 85.000 e 100.000 euro |
| `acconti` | Scadenze di giugno e novembre, obiettivo del fondo tasse, piano di accantonamento mensile |
| `uscite` | Spese ricorrenti e una tantum, risparmio programmato |
| `cassa` | Saldo del conto corrente mese per mese, con segnalazione degli scoperti |

Da accendere solo se ti riguarda:

| Modulo | A chi serve |
| --- | --- |
| `previsione` | Chi vuole sapere quanto accantonare già a gennaio, quando l'incassato è ancora quasi zero |
| `dipendente` | Chi ha o valuta un contratto: lordo/netto con tredicesima e quattordicesima, TFR, e il controllo sulla soglia che fa perdere il forfettario |
| `patrimonio` | Chi vuole vedere il patrimonio diviso per orizzonte temporale, secondo i quattro pilastri |
| `isee` | Chi deve presentare una DSU e vuole sapere in che fascia cade |
| `regola503020` | Chi vuole controllare la ripartizione delle uscite sul netto disponibile |

## I tuoi dati

Restano nel browser di chi apre la pagina. Nessuna telemetria, nessuna chiamata di rete, nessun account: chi apre il link vede una schermata vuota e i suoi dati non arrivano a nessuno, nemmeno a me.

Il rovescio della medaglia: se svuoti la cronologia del browser li perdi. Dalla scheda Impostazioni puoi scaricare un file con tutto e ricaricarlo quando vuoi, anche su un altro computer.

## Stato del progetto

`v0.1`. Il calcolo del forfettario in Gestione Separata è coperto da scenari di test con valori verificati a mano. Non ancora riscontrato con F24 reali. Le gestioni Artigiani e Commercianti e le addizionali regionali sono presenti ma marcate come non verificate: l'app lo dice con un avviso quando le usi.

Cosa viene dopo: [documentazione/ROADMAP.md](documentazione/ROADMAP.md).

## Per chi vuole metterci mano

```bash
git clone https://github.com/prnfpp/I-per-IVA.git
cd I-per-IVA
npm install
npm test        # 40 scenari di calcolo
npm run dev     # apre l'app in locale
npm run build   # ricompila la cartella docs/ pubblicata da GitHub Pages
```

- [documentazione/ARCHITETTURA.md](documentazione/ARCHITETTURA.md) — come è fatto e perché
- [documentazione/AGGIORNARE-LE-REGOLE.md](documentazione/AGGIORNARE-LE-REGOLE.md) — l'aggiornamento annuale delle aliquote, che non richiede di saper programmare
- [CONTRIBUTING.md](CONTRIBUTING.md) — le tre regole per una modifica accettabile

La segnalazione più utile è un errore di calcolo: apri una issue con anno, regime, numeri in ingresso, risultato ottenuto e risultato atteso con la fonte. Diventa uno scenario di test in dieci minuti.

## Avvertenza

Strumento di pianificazione. Non è una dichiarazione dei redditi, non è una DSU, non è un consiglio professionale. I parametri sono quelli vigenti alla data indicata nel file delle regole e possono essere incompleti o superati. Prima di versare un F24, di presentare una dichiarazione o di cambiare regime fiscale, verifica con un commercialista o un CAF.

## Licenza

MIT.
