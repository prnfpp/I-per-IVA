# Come contribuire

## Prima di aprire una PR

```bash
npm install
npm run typecheck
npm test
```

## Le tre regole

**1. Nessun numero fiscale nel codice.** Se serve un parametro nuovo, va in `packages/rules/data/it-<anno>.json` con la sua fonte, e nello schema.

**2. Nessuna modifica al calcolo senza uno scenario di test.** Se cambi una formula, aggiungi o aggiorna uno scenario in `packages/core/test/scenari.test.ts` e spiega nel commit da dove viene il valore atteso.

**3. Il denaro sono centesimi interi.** Nessun float per gli importi, nessuna moltiplicazione a mano: si passa da `mul()`.

## Aggiungere un modulo

1. Crea `packages/core/src/moduli/<nome>.ts` che esporta un oggetto `Modulo`.
2. Dichiara `richiede`, `opzionali` e `fornisce`. Non importare altri moduli: se ti serve un valore, dichiaralo fra le dipendenze.
3. Registralo in `packages/core/src/index.ts`.
4. Aggiungi i `kpi()`: compariranno in dashboard da soli.
5. Se serve un pannello di inserimento dati, aggiungi una scheda in `apps/web/src/App.tsx`.
6. Scrivi i test.

Un modulo che tocca soldi in un certo mese emette `Movimento`, non scrive direttamente in cassa.

## Segnalare un errore di calcolo

È il tipo di issue più prezioso. Servono: anno, regime, gestione previdenziale, i numeri in ingresso, il risultato ottenuto, il risultato che ti aspetti e da dove viene. Con questi elementi diventa uno scenario di test in dieci minuti.

## Lingua

Codice, commenti, documentazione e interfaccia in italiano. Il dominio è il fisco italiano: tradurre "imposta sostitutiva" o "coefficiente di redditività" non aiuta nessuno.
