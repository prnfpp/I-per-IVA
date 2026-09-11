import { euro } from './denaro.js'
import { SCHEMA_VERSION, type DatiUtente } from './tipi.js'

/** Stato iniziale di un nuovo utente. Nessun dato di esempio inventato. */
export function datiIniziali(anno = new Date().getFullYear()): DatiUtente {
  return {
    schemaVersion: SCHEMA_VERSION,
    profilo: {
      anno,
      regime: 'forfettario',
      gestione: 'gestione_separata',
      coefficiente: 0.78,
      annoInizioAttivita: null,
      agevolazioneStartup: false,
      regione: 'default',
      comune: 'default',
      margineSicurezza: 0.05,
      moduliAttivi: ['previsione'],
    },
    fatture: [],
    previsione: [],
    uscite: [],
    dipendente: {
      attivo: false,
      meseInizio: 1,
      lordoMensile: euro(0),
      mensilita: 14,
      bustePaga: Array(12).fill(null),
      redditoAnnoPrecedente: 0,
    },
    annoPrecedente: { impostaDovuta: 0, contributiDovuti: 0, accontiVersati: 0 },
    patrimonio: { liquidita: 0, fondoEmergenza: 0, spesePrevedibili: 0, strumenti: [] },
    isee: {
      componenti: 1,
      figliConviventi: 0,
      redditoForfettario: 0,
      redditoDipendente: 0,
      altriRedditi: 0,
      canoneAnnuo: 0,
      giacenzaMediaConti: 0,
      valoreTitoli: 0,
      titoliDiStato: 0,
      valoreImuPrimaCasa: 0,
      mutuoResiduo: 0,
      cittaMetropolitana: false,
      altriImmobili: 0,
    },
    saldoInizialeCassa: 0,
    saldoFondoTasse: 0,
  }
}

/**
 * Migrazioni del file utente. Ogni volta che cambia la forma dei dati si
 * aggiunge un gradino qui: chi ha un file vecchio non lo perde.
 */
const migrazioni: Record<number, (d: any) => any> = {
  // 0: (d) => ({ ...d, schemaVersion: 1, ...})
}

export function migra(grezzi: unknown): DatiUtente {
  let d = grezzi as any
  if (!d || typeof d !== 'object') throw new Error('File non valido.')
  let versione = Number(d.schemaVersion ?? 0)
  while (versione < SCHEMA_VERSION) {
    const step = migrazioni[versione]
    if (!step) throw new Error(`Non so migrare un file dalla versione ${versione}.`)
    d = step(d)
    versione = Number(d.schemaVersion)
  }
  if (versione > SCHEMA_VERSION) {
    throw new Error(
      `Il file e' stato creato con una versione piu' recente dell'app (schema ${versione}).`,
    )
  }
  return d as DatiUtente
}

/** Esporta lo stato come JSON indentato, pronto per il download. */
export function esporta(dati: DatiUtente): string {
  return JSON.stringify(dati, null, 2)
}
