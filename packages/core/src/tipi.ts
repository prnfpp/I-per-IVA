import type { Regole } from '@iperiva/rules'
import type { Cents } from './denaro.js'

export const SCHEMA_VERSION = 2

export type Regime = 'forfettario'
export type CodiceGestione = 'gestione_separata' | 'artigiani' | 'commercianti'

export interface Profilo {
  anno: number
  regime: Regime
  gestione: CodiceGestione
  /** Chiave dentro regole.forfettario.coefficienti, oppure un valore esplicito. */
  coefficiente: number
  annoInizioAttivita: number | null
  /** Se true si applica l'aliquota startup al 5% quando gli anni lo consentono. */
  agevolazioneStartup: boolean
  regione: string
  comune: string
  /** Cuscinetto aggiunto alla percentuale teorica di accantonamento. */
  margineSicurezza: number
  moduliAttivi: string[]
}

export interface Fattura {
  id: string
  cliente: string
  imponibile: Cents
  /** ISO date. Determina la competenza. */
  dataEmissione: string
  /** ISO date oppure null se non ancora incassata. Determina la cassa. */
  dataIncasso: string | null
  note?: string
}

export interface RigaPrevisione {
  cliente: string
  /** 12 importi, indice 0 = gennaio. */
  mesi: Cents[]
}

/** Blocco della regola 50-30-20 a cui appartiene una categoria di spesa. */
export type Blocco = 'necessita' | 'svago' | 'risparmio'

/**
 * Registro delle categorie di spesa dell'utente. Esiste per una ragione sola:
 * far sì che ogni categoria dichiari a quale blocco appartiene, invece di
 * essere indovinata confrontando stringhe. `blocco: null` significa "non
 * ancora assegnata" e produce un avviso: mai un'assegnazione silenziosa.
 */
export interface Categoria {
  nome: string
  blocco: Blocco | null
}

/** Una voce ricorrente si spalma su dodici mesi; una tantum esce in un mese solo. */
export type Cadenza = 'ricorrente' | 'una-tantum'

export interface Uscita {
  id: string
  categoria: string
  voce: string
  costoUnitario: Cents
  /** Quante volte nell'anno. Per 'una-tantum' vale 1. */
  ricorrenze: number
  cadenza: Cadenza
  /** 1-12, solo per 'una-tantum'. Null per le voci ricorrenti. */
  mese: number | null
  /** Se true è un trasferimento a risparmio, non una spesa. */
  risparmio: boolean
  note?: string
}

export interface DatiDipendente {
  attivo: boolean
  meseInizio: number
  lordoMensile: Cents
  mensilita: number
  /** Netti reali da busta paga; se presenti prevalgono sulla simulazione. */
  bustePaga: (Cents | null)[]
  redditoAnnoPrecedente: Cents
}

export interface DatiAnnoPrecedente {
  impostaDovuta: Cents
  contributiDovuti: Cents
  accontiVersati: Cents
}

export interface Strumento {
  id: string
  nome: string
  tipo: string
  orizzonte: 'breve' | 'medio' | 'lungo'
  prezzoCarico: Cents
  prezzoMercato: Cents
  quantita: number
  destinazione: string
  titoloDiStato: boolean
}

export interface DatiPatrimonio {
  liquidita: Cents
  fondoEmergenza: Cents
  spesePrevedibili: Cents
  strumenti: Strumento[]
}

export interface DatiIsee {
  componenti: number
  figliConviventi: number
  redditoForfettario: Cents
  redditoDipendente: Cents
  altriRedditi: Cents
  canoneAnnuo: Cents
  giacenzaMediaConti: Cents
  valoreTitoli: Cents
  titoliDiStato: Cents
  valoreImuPrimaCasa: Cents
  mutuoResiduo: Cents
  cittaMetropolitana: boolean
  altriImmobili: Cents
}

export interface DatiUtente {
  schemaVersion: number
  profilo: Profilo
  fatture: Fattura[]
  previsione: RigaPrevisione[]
  categorie: Categoria[]
  uscite: Uscita[]
  dipendente: DatiDipendente
  annoPrecedente: DatiAnnoPrecedente
  patrimonio: DatiPatrimonio
  isee: DatiIsee
  saldoInizialeCassa: Cents
  saldoFondoTasse: Cents
}

// ---------------------------------------------------------------------------
// Contesto di calcolo
// ---------------------------------------------------------------------------

export type TipoMovimento =
  | 'incasso'
  | 'stipendio'
  | 'spesa'
  | 'risparmio'
  | 'accantonamento'
  | 'f24'

export interface Movimento {
  /** 1-12 */
  mese: number
  importo: Cents
  tipo: TipoMovimento
  descrizione: string
  /** Se false il movimento non transita dal conto corrente (esce dal fondo tasse). */
  impattaContoCorrente: boolean
}

export type LivelloAvviso = 'info' | 'attenzione' | 'errore'

export interface Avviso {
  livello: LivelloAvviso
  modulo: string
  messaggio: string
}

export interface Contesto {
  anno: number
  regole: Regole
  dati: DatiUtente
  /** Valori numerici in centesimi, oppure percentuali quando il nome lo dice. */
  valori: Record<string, number>
  testi: Record<string, string>
  /** Serie mensili di 12 elementi. */
  serie: Record<string, number[]>
  movimenti: Movimento[]
  avvisi: Avviso[]
}

export interface Contributo {
  valori?: Record<string, number>
  testi?: Record<string, string>
  serie?: Record<string, number[]>
  movimenti?: Movimento[]
  avvisi?: Avviso[]
}

export interface Kpi {
  chiave: string
  etichetta: string
  formato: 'euro' | 'percentuale' | 'numero' | 'testo'
  gruppo: string
  nota?: string
  /** Semaforo: OK oppure il messaggio di allerta. */
  semaforo?: (ctx: Contesto) => string
}

export interface Modulo {
  id: string
  etichetta: string
  descrizione: string
  /** Se true non può essere disattivato. */
  obbligatorio: boolean
  /** Chiavi che il modulo si aspetta di trovare in ctx.valori. */
  richiede: string[]
  /** Chiavi opzionali: se assenti il modulo funziona comunque. */
  opzionali?: string[]
  /** Chiavi che il modulo pubblica. */
  fornisce: string[]
  /**
   * Percorsi dentro le regole fiscali che questo modulo legge davvero, dato
   * il profilo dell'utente. Serve ad avvisare solo sui parametri non
   * verificati che entrano nel suo calcolo, invece che su tutti.
   */
  regoleUsate?(dati: DatiUtente): string[]
  calcola(ctx: Contesto): Contributo
  kpi(): Kpi[]
}
