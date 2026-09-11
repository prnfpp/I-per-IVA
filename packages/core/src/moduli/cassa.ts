import { formatta } from '../denaro.js'
import type { Contesto, Contributo, Kpi, Modulo } from '../tipi.js'

const MESI_ESTESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]

/**
 * La cassa non ha logica propria: e' un riduttore sui movimenti che gli altri
 * moduli hanno emesso. Aggiungere un modulo che genera movimenti significa
 * vederlo comparire qui senza toccare una riga di questo file.
 */
export const moduloCassa: Modulo = {
  id: 'cassa',
  etichetta: 'Cassa mensile',
  descrizione: 'Saldo del conto corrente mese per mese, con saldo progressivo.',
  obbligatorio: true,
  richiede: ['usciteTotali'],
  opzionali: ['obiettivoFondoTasse', 'nettoDipendenteAnnuo'],
  fornisce: [
    'entrateAnno',
    'saldoFinaleCassa',
    'saldoMinimoCassa',
    'meseSaldoMinimo',
    'mesePrimoScoperto',
  ],

  calcola(ctx: Contesto): Contributo {
    const entrate = Array(12).fill(0)
    const uscite = Array(12).fill(0)

    for (const m of ctx.movimenti) {
      if (!m.impattaContoCorrente) continue
      const i = m.mese - 1
      if (i < 0 || i > 11) continue
      if (m.importo >= 0) entrate[i] += m.importo
      else uscite[i] += -m.importo
    }

    let saldo = ctx.dati.saldoInizialeCassa
    const progressivo = entrate.map((e, i) => {
      saldo += e - uscite[i]
      return saldo
    })

    const minimo = Math.min(...progressivo)
    const meseMinimo = progressivo.indexOf(minimo) + 1
    // Il mese da nominare e' il primo in cui il conto va sotto, non il
    // peggiore: e' quello prima del quale bisogna intervenire.
    const primoRosso = progressivo.findIndex((v) => v < 0) + 1

    return {
      valori: {
        entrateAnno: entrate.reduce((a, b) => a + b, 0),
        saldoFinaleCassa: progressivo[11],
        saldoMinimoCassa: minimo,
        meseSaldoMinimo: meseMinimo,
        mesePrimoScoperto: primoRosso,
      },
      serie: { entrateMensili: entrate, usciteMensili: uscite, saldoProgressivo: progressivo },
      avvisi:
        minimo < 0
          ? [
              {
                livello: 'errore',
                modulo: 'cassa',
                messaggio: `Il conto corrente va sotto zero a ${MESI_ESTESI[primoRosso - 1]} e tocca il minimo a ${MESI_ESTESI[meseMinimo - 1]}, a ${formatta(minimo)}. Vanno trovati ${formatta(-minimo)} entro allora, oppure spostata piu' avanti una spesa di pari importo.`,
              },
            ]
          : [],
    }
  },

  descriviSerie() {
    return [
      { chiave: 'entrateMensili', etichetta: 'Entrate sul conto', tipo: 'flusso' as const },
      { chiave: 'usciteMensili', etichetta: 'Uscite dal conto', tipo: 'flusso' as const },
      { chiave: 'saldoProgressivo', etichetta: 'Conto corrente', tipo: 'saldo' as const },
    ]
  },

  kpi(): Kpi[] {
    return [
      { chiave: 'entrateAnno', etichetta: 'Entrate dell\u2019anno', formato: 'euro', gruppo: 'Cassa' },
      { chiave: 'saldoFinaleCassa', etichetta: 'Conto corrente a fine anno', formato: 'euro', gruppo: 'Cassa' },
      {
        chiave: 'saldoMinimoCassa',
        etichetta: 'Mese peggiore',
        formato: 'euro',
        gruppo: 'Cassa',
        semaforo: (ctx) => (ctx.valori.saldoMinimoCassa < 0 ? 'Scoperto in qualche mese' : 'OK'),
      },
    ]
  },
}
