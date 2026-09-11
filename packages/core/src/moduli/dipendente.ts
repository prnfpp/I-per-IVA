import { max0, mul, somma, type Cents } from '../denaro.js'
import type { Contesto, Contributo, Kpi, Modulo } from '../tipi.js'
import type { Regole } from '@iperiva/rules'

export interface EsitoBustaPaga {
  ral: Cents
  contributi: Cents
  imponibile: Cents
  irpefLorda: Cents
  detrazioneLavoro: Cents
  ulterioreDetrazione: Cents
  irpefNetta: Cents
  addizionali: Cents
  bonusCuneo: Cents
  nettoAnnuo: Cents
  tfr: Cents
}

/** IRPEF a scaglioni. Equivalente al SOMMAPRODOTTO del foglio Excel. */
export function irpefLorda(imponibile: Cents, regole: Regole): Cents {
  const s = regole.irpef.scaglioni
  let totale = 0
  for (let i = 0; i < s.length; i++) {
    const da = Math.round(s[i].da * 100)
    const incremento = i === 0 ? s[i].aliquota : s[i].aliquota - s[i - 1].aliquota
    if (imponibile > da) totale += mul(imponibile - da, incremento)
  }
  return max0(totale)
}

export function detrazioneLavoroDipendente(imponibile: Cents, regole: Regole): Cents {
  const d = regole.lavoroDipendente.detrazione
  const s1 = Math.round(d.soglia1 * 100)
  const s2 = Math.round(d.soglia2 * 100)
  const s3 = Math.round(d.soglia3 * 100)
  if (imponibile <= s1) return Math.round(d.importoBase * 100)
  if (imponibile <= s2) {
    return (
      Math.round(d.quotaFissaFascia2 * 100) +
      Math.round(((d.quotaVariabileFascia2 * 100) * (s2 - imponibile)) / (d.denominatoreFascia2 * 100))
    )
  }
  if (imponibile <= s3) {
    return Math.round(((d.quotaFissaFascia3 * 100) * (s3 - imponibile)) / (d.denominatoreFascia3 * 100))
  }
  return 0
}

export function ulterioreDetrazioneCuneo(imponibile: Cents, regole: Regole): Cents {
  const u = regole.lavoroDipendente.cuneoFiscale.ulterioreDetrazione
  const inizio = Math.round(u.sogliaInizio * 100)
  const decalage = Math.round(u.sogliaDecalage * 100)
  const zero = Math.round(u.sogliaAzzeramento * 100)
  const pieno = Math.round(u.importoPieno * 100)
  if (imponibile > inizio && imponibile <= decalage) return pieno
  if (imponibile > decalage && imponibile <= zero) {
    return Math.round((pieno * (zero - imponibile)) / (zero - decalage))
  }
  return 0
}

/**
 * Somma esente da cuneo fiscale (L. 207/2024 art. 1 c. 4).
 * La spettanza dipende dal reddito complessivo; la percentuale si scegli
 * in base al reddito da lavoro dipendente, e l'ultima fascia e' aperta:
 * il tetto di 20.000 euro riguarda la spettanza, non la base di calcolo.
 */
export function bonusCuneo(imponibile: Cents, regole: Regole): Cents {
  const c = regole.lavoroDipendente.cuneoFiscale
  if (imponibile > Math.round(c.sogliaSommaEsente * 100)) return 0
  const fasce = c.percentuali
  for (const fascia of fasce) {
    if (imponibile <= Math.round(fascia.finoA * 100)) return mul(imponibile, fascia.aliquota)
  }
  return mul(imponibile, fasce[fasce.length - 1].aliquota)
}

export function calcolaBustaPaga(ral: Cents, ctx: Contesto): EsitoBustaPaga {
  const r = ctx.regole
  const p = ctx.dati.profilo
  const contributi = mul(ral, r.lavoroDipendente.contributiDipendente)
  const imponibile = ral - contributi
  const lorda = irpefLorda(imponibile, r)
  const detr = detrazioneLavoroDipendente(imponibile, r)
  const ulteriore = ulterioreDetrazioneCuneo(imponibile, r)
  const netta = max0(lorda - detr - ulteriore)
  const aliquotaReg =
    r.lavoroDipendente.addizionali.regionali[p.regione] ??
    r.lavoroDipendente.addizionali.regionali.default
  const aliquotaCom =
    r.lavoroDipendente.addizionali.comunali[p.comune] ??
    r.lavoroDipendente.addizionali.comunali.default
  const addizionali = mul(imponibile, aliquotaReg + aliquotaCom)
  const bonus = bonusCuneo(imponibile, r)
  const tfr =
    Math.round(ral / r.lavoroDipendente.tfrDivisore) - mul(ral, r.lavoroDipendente.tfrFondoGaranzia)

  return {
    ral,
    contributi,
    imponibile,
    irpefLorda: lorda,
    detrazioneLavoro: detr,
    ulterioreDetrazione: ulteriore,
    irpefNetta: netta,
    addizionali,
    bonusCuneo: bonus,
    nettoAnnuo: imponibile - netta - addizionali + bonus,
    tfr,
  }
}

/**
 * Simulatore inverso: dato un netto annuo trova la RAL piu' bassa che lo
 * produce. Non usa ricerca binaria di proposito: la funzione lordo -> netto
 * NON e' monotona sotto i 20.000 euro, perche' le fasce del bonus cuneo
 * (7,1% / 5,3% / 4,8%) creano due salti a 8.500 e 15.000 euro di reddito.
 * Scansione a passi di 100 euro e poi raffinamento al centesimo.
 */
export function ralDaNetto(nettoObiettivo: Cents, ctx: Contesto): Cents {
  const massimo = Math.max(nettoObiettivo * 3, 200_000_00)
  const passo = 100_00
  let candidato = massimo
  for (let ral = 0; ral <= massimo; ral += passo) {
    if (calcolaBustaPaga(ral, ctx).nettoAnnuo >= nettoObiettivo) {
      candidato = ral
      break
    }
  }
  for (let ral = Math.max(0, candidato - passo); ral <= candidato; ral += 100) {
    if (calcolaBustaPaga(ral, ctx).nettoAnnuo >= nettoObiettivo) return ral
  }
  return candidato
}

export const moduloDipendente: Modulo = {
  id: 'dipendente',
  etichetta: 'Lavoro dipendente',
  descrizione:
    'Simulatore lordo/netto con tredicesima e quattordicesima, registro delle buste paga e controllo della soglia che fa perdere il forfettario.',
  obbligatorio: false,
  richiede: [],
  fornisce: [
    'altraCoperturaPrevidenziale',
    'ralSimulata',
    'nettoDipendenteAnnuo',
    'nettoPerMensilita',
    'nettoDipendenteMensile',
    'tfrAnnuo',
    'redditoDipendenteAnno',
    'redditoDipendenteAnnoPrecedente',
    'sogliaRedditoDipendente',
  ],

  calcola(ctx: Contesto): Contributo {
    const d = ctx.dati.dipendente
    const soglia = Math.round(ctx.regole.forfettario.sogliaRedditoDipendente * 100)

    if (!d.attivo) {
      return {
        valori: {
          altraCoperturaPrevidenziale: 0,
          ralSimulata: 0,
          nettoDipendenteAnnuo: 0,
          nettoPerMensilita: 0,
          nettoDipendenteMensile: 0,
          tfrAnnuo: 0,
          redditoDipendenteAnno: 0,
          redditoDipendenteAnnoPrecedente: d.redditoAnnoPrecedente,
          sogliaRedditoDipendente: soglia,
        },
      }
    }

    const ral = d.lordoMensile * d.mensilita
    const esito = calcolaBustaPaga(ral, ctx)

    const bustePagaValide = d.bustePaga.filter((v): v is number => v !== null && v > 0)
    const nettoReale = somma(bustePagaValide)
    const usaBuste = bustePagaValide.length > 0

    const nettoMensileStimato = Math.round(esito.nettoAnnuo / 12)
    const serieNetti = Array.from({ length: 12 }, (_, i) => {
      const reale = d.bustePaga[i]
      if (reale !== null && reale !== undefined && reale > 0) return reale
      return i + 1 >= d.meseInizio ? nettoMensileStimato : 0
    })

    const avvisi: Contributo['avvisi'] = []
    if (d.redditoAnnoPrecedente > soglia) {
      avvisi.push({
        livello: 'errore',
        modulo: 'dipendente',
        messaggio: `I redditi da lavoro dipendente dell\u2019anno precedente superano ${ctx.regole.forfettario.sogliaRedditoDipendente} \u20ac: causa di esclusione dal forfettario, salvo rapporto cessato.`,
      })
    } else if (d.redditoAnnoPrecedente > soglia * 0.85) {
      avvisi.push({
        livello: 'attenzione',
        modulo: 'dipendente',
        messaggio: 'Sei vicino alla soglia dei redditi da lavoro dipendente che fa perdere il forfettario.',
      })
    }
    avvisi.push({
      livello: 'info',
      modulo: 'dipendente',
      messaggio:
        'Seconda causa ostativa che nessun calcolo puo\u2019 verificare: non puoi fatturare in prevalenza al tuo datore di lavoro attuale o dei due anni precedenti.',
    })

    return {
      valori: {
        altraCoperturaPrevidenziale: 1,
        ralSimulata: ral,
        nettoDipendenteAnnuo: usaBuste ? nettoReale : esito.nettoAnnuo,
        nettoPerMensilita: d.mensilita > 0 ? Math.round(esito.nettoAnnuo / d.mensilita) : 0,
        nettoDipendenteMensile: nettoMensileStimato,
        tfrAnnuo: esito.tfr,
        redditoDipendenteAnno: ral,
        redditoDipendenteAnnoPrecedente: d.redditoAnnoPrecedente,
        sogliaRedditoDipendente: soglia,
      },
      serie: { nettiDipendenteMensili: serieNetti },
      movimenti: serieNetti.map((importo, i) => ({
        mese: i + 1,
        importo,
        tipo: 'stipendio' as const,
        descrizione: 'Stipendio netto',
        impattaContoCorrente: true,
      })),
      avvisi,
    }
  },

  kpi(): Kpi[] {
    return [
      { chiave: 'ralSimulata', etichetta: 'RAL', formato: 'euro', gruppo: 'Lavoro dipendente' },
      { chiave: 'nettoPerMensilita', etichetta: 'Netto per mensilita\u2019', formato: 'euro', gruppo: 'Lavoro dipendente' },
      { chiave: 'nettoDipendenteAnnuo', etichetta: 'Netto annuo', formato: 'euro', gruppo: 'Lavoro dipendente' },
      { chiave: 'tfrAnnuo', etichetta: 'TFR maturato', formato: 'euro', gruppo: 'Lavoro dipendente' },
      {
        chiave: 'redditoDipendenteAnnoPrecedente',
        etichetta: 'Compatibilita\u2019 col forfettario',
        formato: 'euro',
        gruppo: 'Soglie',
        semaforo: (ctx) =>
          ctx.valori.redditoDipendenteAnnoPrecedente > ctx.valori.sogliaRedditoDipendente
            ? 'Fuori dal forfettario'
            : 'OK',
      },
    ]
  },
}
