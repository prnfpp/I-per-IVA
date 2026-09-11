import { max0, minimo, mul } from '../denaro.js'
import type { Contesto, Contributo, Kpi, Modulo } from '../tipi.js'

export const moduloIsee: Modulo = {
  id: 'isee',
  etichetta: 'Simulazione ISEE',
  descrizione:
    'Stima l\u2019ISEE con le franchigie e la scala di equivalenza dell\u2019anno. Il reddito forfettario entra per intero.',
  obbligatorio: false,
  richiede: [],
  fornisce: ['isr', 'ispMobiliare', 'ispImmobiliare', 'isp', 'ise', 'isee', 'scalaEquivalenza'],

  regoleUsate() {
    return ['isee']
  },

  calcola(ctx: Contesto): Contributo {
    const r = ctx.regole.isee
    const d = ctx.dati.isee
    const c = Math.max(1, d.componenti)

    // Scala di equivalenza
    const base =
      r.scalaEquivalenza[String(c)] ??
      r.scalaEquivalenza['5'] + (c - 5) * r.scalaEquivalenza.incrementoOltre5
    const maggiorazione =
      d.figliConviventi >= 5
        ? (r.maggiorazioniFigli['5'] ?? 0)
        : (r.maggiorazioniFigli[String(d.figliConviventi)] ?? 0)
    const scala = base + maggiorazione

    // ISR
    const redditi = d.redditoForfettario + d.redditoDipendente + d.altriRedditi
    const dedAffitto = minimo(
      d.canoneAnnuo,
      Math.round(r.deduzioneAffittoMax * 100) +
        Math.round(r.deduzioneAffittoPerFiglioOltreIlSecondo * 100) *
          Math.max(0, d.figliConviventi - 2),
    )
    const dedLavoro = minimo(
      mul(d.redditoDipendente, r.deduzioneLavoroDipendentePercentuale),
      Math.round(r.deduzioneLavoroDipendenteMax * 100),
    )
    const deduzione = Math.max(dedAffitto, dedLavoro)
    const isr = max0(redditi - deduzione)

    // Patrimonio mobiliare
    const titoliRilevanti = max0(d.titoliDiStato - Math.round(r.esclusioneTitoliDiStato * 100))
    const mobiliareLordo = d.giacenzaMediaConti + d.valoreTitoli + titoliRilevanti
    const franchigia =
      minimo(
        Math.round(r.franchigiaMobiliareMax * 100),
        Math.round(r.franchigiaMobiliareBase * 100) +
          Math.round(r.franchigiaMobiliarePerComponente * 100) * (c - 1),
      ) +
      Math.round(r.franchigiaMobiliarePerFiglioOltreIlSecondo * 100) *
        Math.max(0, d.figliConviventi - 2)
    const mobiliare = max0(mobiliareLordo - franchigia)

    // Patrimonio immobiliare
    const franchigiaCasa =
      Math.round(
        (d.cittaMetropolitana
          ? r.franchigiaPrimaCasaCittaMetropolitana
          : r.franchigiaPrimaCasa) * 100,
      ) +
      Math.round(r.franchigiaPrimaCasaPerFiglioOltreIlPrimo * 100) *
        Math.max(0, d.figliConviventi - 1)
    const valoreCasa = max0(d.valoreImuPrimaCasa - d.mutuoResiduo)
    const eccedenzaCasa = mul(max0(valoreCasa - franchigiaCasa), r.quotaEccedenzaPrimaCasa)
    const immobiliare = eccedenzaCasa + d.altriImmobili

    const isp = mobiliare + immobiliare
    const ise = isr + mul(isp, r.quotaPatrimonio)
    const isee = scala > 0 ? Math.round(ise / scala) : 0

    return {
      valori: {
        isr,
        ispMobiliare: mobiliare,
        ispImmobiliare: immobiliare,
        isp,
        ise,
        isee,
        scalaEquivalenza: scala,
      },
      avvisi: [
        {
          livello: 'info',
          modulo: 'isee',
          messaggio: `L\u2019ISEE ${ctx.anno} si calcola sui redditi del ${ctx.anno - r.annoRiferimentoRedditiIndietro} e sul patrimonio al 31 dicembre dello stesso anno. Il valore reale lo produce solo la DSU.`,
        },
        {
          livello: 'info',
          modulo: 'isee',
          messaggio:
            'Per i conti conta la giacenza media annua, non il saldo al 31 dicembre: usare il saldo puo\u2019 falsare parecchio il risultato.',
        },
      ],
    }
  },

  kpi(): Kpi[] {
    return [
      { chiave: 'isee', etichetta: 'ISEE stimato', formato: 'euro', gruppo: 'ISEE' },
      { chiave: 'isr', etichetta: 'Componente reddituale', formato: 'euro', gruppo: 'ISEE' },
      { chiave: 'isp', etichetta: 'Componente patrimoniale', formato: 'euro', gruppo: 'ISEE' },
      { chiave: 'scalaEquivalenza', etichetta: 'Scala di equivalenza', formato: 'numero', gruppo: 'ISEE' },
    ]
  },
}
