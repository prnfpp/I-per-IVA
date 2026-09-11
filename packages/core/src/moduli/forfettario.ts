import { max0, minimo, mul, somma, type Cents } from '../denaro.js'
import type { Contesto, Contributo, Kpi, Modulo } from '../tipi.js'
import type { Gestione } from '@iperiva/rules'

/** Aliquota applicabile: 5% nei primi anni di attività se l'agevolazione è attiva. */
export function aliquotaImposta(ctx: Contesto): number {
  const { forfettario } = ctx.regole
  const p = ctx.dati.profilo
  if (p.agevolazioneStartup && p.annoInizioAttivita !== null) {
    const anni = ctx.anno - p.annoInizioAttivita
    if (anni >= 0 && anni < forfettario.anniStartup) return forfettario.aliquotaStartup
  }
  return forfettario.aliquotaOrdinaria
}

/**
 * Contributi previdenziali sul reddito imponibile lordo.
 * Gestione Separata: percentuale pura entro il massimale.
 * Artigiani e Commercianti: contributo fisso sul minimale più percentuale sull'eccedenza.
 */
export function contributiPrevidenziali(
  imponibileLordo: Cents,
  gestione: Gestione,
  altraCopertura: boolean,
): Cents {
  const aliquota = altraCopertura ? gestione.aliquotaRidotta : gestione.aliquotaPiena
  const base = minimo(imponibileLordo, Math.round(gestione.massimale * 100))
  if (!gestione.minimale) return mul(base, aliquota)
  const minimoRedditoCents = Math.round(gestione.minimale.redditoMinimo * 100)
  const fisso = Math.round(gestione.minimale.contributoFisso * 100)
  const eccedenza = max0(base - minimoRedditoCents)
  return fisso + mul(eccedenza, aliquota)
}

function incassatoPerMese(ctx: Contesto): number[] {
  const serie = Array(12).fill(0)
  for (const f of ctx.dati.fatture) {
    if (!f.dataIncasso) continue
    const mese = new Date(f.dataIncasso).getMonth()
    if (mese >= 0 && mese < 12) serie[mese] += f.imponibile
  }
  return serie
}

export const moduloForfettario: Modulo = {
  id: 'forfettario',
  etichetta: 'Regime forfettario',
  descrizione:
    'Calcola imposta sostitutiva e contributi previdenziali sugli incassi dell\u2019anno, per cassa.',
  obbligatorio: true,
  richiede: [],
  opzionali: ['fatturatoPrevisto', 'altraCoperturaPrevidenziale'],
  fornisce: [
    'incassato',
    'fatturatoEmesso',
    'daIncassare',
    'imponibileLordo',
    'contributi',
    'imponibileNetto',
    'imposta',
    'dovuto',
    'netto',
    'pressioneFiscale',
    'aliquotaInpsApplicata',
    'baseStima',
    'dovutoPrevisto',
    'impostaPrevista',
    'contributiPrevisti',
    'percentualeAccantonamento',
    'utilizzoSogliaRicavi',
  ],

  regoleUsate(dati) {
    return ['forfettario', `previdenza.${dati.profilo.gestione}`]
  },

  calcola(ctx: Contesto): Contributo {
    const { forfettario, previdenza } = ctx.regole
    const p = ctx.dati.profilo
    const gestione = previdenza[p.gestione]
    if (!gestione) {
      return {
        avvisi: [
          {
            livello: 'errore',
            modulo: 'forfettario',
            messaggio: `Gestione previdenziale "${p.gestione}" non presente nelle regole del ${ctx.regole.anno}.`,
          },
        ],
      }
    }

    const altraCopertura = ctx.valori.altraCoperturaPrevidenziale === 1
    const aliquotaInps = altraCopertura ? gestione.aliquotaRidotta : gestione.aliquotaPiena
    const aliquota = aliquotaImposta(ctx)

    const serieIncassi = incassatoPerMese(ctx)
    const incassato = somma(serieIncassi)
    const fatturatoEmesso = somma(ctx.dati.fatture.map((f) => f.imponibile))
    const daIncassare = somma(
      ctx.dati.fatture.filter((f) => !f.dataIncasso).map((f) => f.imponibile),
    )

    const imponibileLordo = mul(incassato, p.coefficiente)
    const contributi = contributiPrevidenziali(imponibileLordo, gestione, altraCopertura)
    // I contributi si deducono per cassa: nell'MVP assumiamo versati nell'anno
    // e lo diciamo in un avviso, invece di far finta che sia esatto.
    const imponibileNetto = max0(imponibileLordo - contributi)
    const imposta = mul(imponibileNetto, aliquota)
    const dovuto = imposta + contributi

    // Stima sull'anno pieno: il maggiore fra previsione e incassato.
    const previsto = ctx.valori.fatturatoPrevisto ?? 0
    const baseStima = Math.max(previsto, incassato)
    const impLordoPrev = mul(baseStima, p.coefficiente)
    const contributiPrev = contributiPrevidenziali(impLordoPrev, gestione, altraCopertura)
    const impostaPrev = mul(max0(impLordoPrev - contributiPrev), aliquota)
    const dovutoPrevisto = impostaPrev + contributiPrev

    const percentuale =
      baseStima > 0 ? dovutoPrevisto / baseStima + p.margineSicurezza : p.margineSicurezza

    const avvisi: Contributo['avvisi'] = [
      {
        livello: 'info',
        modulo: 'forfettario',
        messaggio:
          'I contributi si deducono nell\u2019anno in cui vengono pagati. Qui sono considerati versati nell\u2019anno di maturazione: se paghi in ritardo l\u2019imponibile reale sale.',
      },
    ]
    if (incassato > forfettario.sogliaUscitaImmediata * 100) {
      avvisi.push({
        livello: 'errore',
        modulo: 'forfettario',
        messaggio: `Hai superato i ${forfettario.sogliaUscitaImmediata} \u20ac: si esce dal forfettario immediatamente, con IVA dal momento del superamento.`,
      })
    } else if (incassato > forfettario.sogliaRicavi * 100) {
      avvisi.push({
        livello: 'errore',
        modulo: 'forfettario',
        messaggio: `Hai superato i ${forfettario.sogliaRicavi} \u20ac: si esce dal forfettario dall\u2019anno prossimo.`,
      })
    } else if (baseStima > forfettario.sogliaRicavi * 100 * 0.8) {
      avvisi.push({
        livello: 'attenzione',
        modulo: 'forfettario',
        messaggio: 'Sei oltre l\u201980% della soglia dei ricavi considerando la previsione dell\u2019anno.',
      })
    }

    return {
      valori: {
        incassato,
        fatturatoEmesso,
        daIncassare,
        imponibileLordo,
        contributi,
        imponibileNetto,
        imposta,
        dovuto,
        netto: incassato - dovuto,
        pressioneFiscale: incassato > 0 ? dovuto / incassato : 0,
        aliquotaInpsApplicata: aliquotaInps,
        baseStima,
        dovutoPrevisto,
        impostaPrevista: impostaPrev,
        contributiPrevisti: contributiPrev,
        percentualeAccantonamento: percentuale,
        utilizzoSogliaRicavi:
          forfettario.sogliaRicavi > 0 ? incassato / (forfettario.sogliaRicavi * 100) : 0,
      },
      serie: { incassiMensili: serieIncassi },
      movimenti: serieIncassi.map((importo, i) => ({
        mese: i + 1,
        importo,
        tipo: 'incasso' as const,
        descrizione: 'Incassi partita IVA',
        impattaContoCorrente: true,
      })),
      avvisi,
    }
  },

  descriviSerie() {
    return [{ chiave: 'incassiMensili', etichetta: 'Incassato', tipo: 'flusso' as const }]
  },

  kpi(): Kpi[] {
    return [
      { chiave: 'fatturatoEmesso', etichetta: 'Fatturato emesso', formato: 'euro', gruppo: 'Fatturato' },
      { chiave: 'incassato', etichetta: 'Incassato', formato: 'euro', gruppo: 'Fatturato', nota: 'Base di calcolo delle tasse.' },
      { chiave: 'daIncassare', etichetta: 'Emesso e non incassato', formato: 'euro', gruppo: 'Fatturato' },
      { chiave: 'dovuto', etichetta: 'Dovuto sull\u2019incassato', formato: 'euro', gruppo: 'Tasse' },
      { chiave: 'dovutoPrevisto', etichetta: 'Dovuto previsto a fine anno', formato: 'euro', gruppo: 'Tasse' },
      {
        chiave: 'percentualeAccantonamento',
        etichetta: 'Da accantonare su ogni incasso',
        formato: 'percentuale',
        gruppo: 'Tasse',
        nota: 'Sposta questa quota sul conto tasse appena arriva il bonifico.',
      },
      { chiave: 'netto', etichetta: 'Netto reale partita IVA', formato: 'euro', gruppo: 'Tasse' },
      { chiave: 'pressioneFiscale', etichetta: 'Pressione fiscale', formato: 'percentuale', gruppo: 'Tasse' },
      {
        chiave: 'utilizzoSogliaRicavi',
        etichetta: 'Utilizzo della soglia ricavi',
        formato: 'percentuale',
        gruppo: 'Soglie',
        semaforo: (ctx) =>
          ctx.valori.utilizzoSogliaRicavi > 1
            ? 'Soglia superata'
            : ctx.valori.utilizzoSogliaRicavi > 0.8
              ? 'Soglia vicina'
              : 'OK',
      },
    ]
  },
}
