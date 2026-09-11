import type { Contesto, Contributo, Kpi, Modulo } from '../tipi.js'

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
  fornisce: ['entrateAnno', 'saldoFinaleCassa', 'saldoMinimoCassa', 'meseSaldoMinimo'],

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

    return {
      valori: {
        entrateAnno: entrate.reduce((a, b) => a + b, 0),
        saldoFinaleCassa: progressivo[11],
        saldoMinimoCassa: minimo,
        meseSaldoMinimo: meseMinimo,
      },
      serie: { entrateMensili: entrate, usciteMensili: uscite, saldoProgressivo: progressivo },
      avvisi:
        minimo < 0
          ? [
              {
                livello: 'errore',
                modulo: 'cassa',
                messaggio: `Il conto corrente va in rosso al mese ${meseMinimo}. Sposta una spesa o rateizza, prima che accada.`,
              },
            ]
          : [],
    }
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
