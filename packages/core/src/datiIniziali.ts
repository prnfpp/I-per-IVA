import { euro } from './denaro.js'
import { SCHEMA_VERSION, type Blocco, type Categoria, type DatiUtente } from './tipi.js'

/**
 * Categorie proposte a chi comincia. Non sono un vincolo: si aggiungono,
 * si rinominano e si cancellano. L'unica regola e' che ognuna dichiari il
 * proprio blocco, perche' la regola 50-30-20 non deve indovinare niente.
 */
export const CATEGORIE_PREDEFINITE: Categoria[] = [
  { nome: 'Casa', blocco: 'necessita' },
  { nome: 'Macchina', blocco: 'necessita' },
  { nome: 'P.IVA', blocco: 'necessita' },
  { nome: 'Cura della persona', blocco: 'necessita' },
  { nome: 'Salute', blocco: 'necessita' },
  { nome: 'Studio', blocco: 'necessita' },
  { nome: 'Abbonamenti', blocco: 'svago' },
  { nome: 'Hobby', blocco: 'svago' },
  { nome: 'Tempo Libero', blocco: 'svago' },
  { nome: 'Altro', blocco: 'svago' },
  { nome: 'Risparmio', blocco: 'risparmio' },
]

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
    categorie: CATEGORIE_PREDEFINITE.map((c) => ({ ...c })),
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
  /**
   * v1 -> v2. Due cambiamenti, entrambi per togliere di mezzo un'assunzione
   * implicita.
   *
   * Le categorie diventano un registro esplicito con il blocco dichiarato.
   * Prima il blocco si deduceva confrontando il nome della categoria con un
   * elenco fisso, e chi non corrispondeva finiva nello svago senza saperlo:
   * qui le categorie ignote nascono con `blocco: null`, cioe' da assegnare.
   *
   * `mese: 0` come sinonimo di "ricorrente" diventa un campo `cadenza`.
   * I valori esistenti non vengono toccati, nemmeno quando sono la
   * combinazione contraddittoria (una tantum ripetuta dodici volte): quella
   * la segnala il modulo uscite, non la migrazione, perche' cambiare in
   * silenzio i numeri di qualcun altro e' peggio del difetto che si ripara.
   */
  1: (d) => {
    const uscite = Array.isArray(d.uscite) ? d.uscite : []
    const noti = new Map<string, Blocco | null>(
      CATEGORIE_PREDEFINITE.map((c) => [c.nome, c.blocco]),
    )
    const categorie: Categoria[] = CATEGORIE_PREDEFINITE.map((c) => ({ ...c }))
    for (const u of uscite) {
      const nome = String(u?.categoria ?? '').trim()
      if (!nome || noti.has(nome)) continue
      noti.set(nome, null)
      categorie.push({ nome, blocco: null })
    }
    return {
      ...d,
      schemaVersion: 2,
      categorie,
      uscite: uscite.map((u: any) => {
        const mese = Number(u?.mese ?? 0)
        const unaTantum = mese >= 1 && mese <= 12
        return {
          ...u,
          cadenza: unaTantum ? 'una-tantum' : 'ricorrente',
          mese: unaTantum ? mese : null,
        }
      }),
    }
  },
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
