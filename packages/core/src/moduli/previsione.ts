import { somma } from '../denaro.js'
import type { Contesto, Contributo, Kpi, Modulo } from '../tipi.js'

/**
 * Previsione di fatturato per competenza: la griglia clienti x mesi.
 * E' il modulo che rende utile l'accantonamento gia' a gennaio, quando
 * l'incassato e' ancora quasi zero.
 */
export const moduloPrevisione: Modulo = {
  id: 'previsione',
  etichetta: 'Previsionale di fatturato',
  descrizione:
    'Pianifica quanto pensi di fatturare a ogni cliente, mese per mese, e confrontalo con quello che e\u2019 successo davvero.',
  obbligatorio: false,
  richiede: [],
  fornisce: ['fatturatoPrevisto', 'daFatturare', 'avanzamentoPiano'],

  calcola(ctx: Contesto): Contributo {
    const righe = ctx.dati.previsione
    const perMese = Array(12).fill(0)
    for (const riga of righe) {
      riga.mesi.forEach((v, i) => {
        if (i < 12) perMese[i] += v
      })
    }
    const previsto = somma(perMese)
    const emesso = somma(ctx.dati.fatture.map((f) => f.imponibile))

    return {
      valori: {
        fatturatoPrevisto: previsto,
        daFatturare: Math.max(0, previsto - emesso),
        avanzamentoPiano: previsto > 0 ? emesso / previsto : 0,
      },
      serie: { previsioneMensile: perMese },
      avvisi:
        previsto === 0
          ? [
              {
                livello: 'attenzione',
                modulo: 'previsione',
                messaggio:
                  'La previsione e\u2019 vuota: la percentuale di accantonamento verra\u2019 calcolata solo su quanto hai gia\u2019 incassato.',
              },
            ]
          : [],
    }
  },

  kpi(): Kpi[] {
    return [
      { chiave: 'fatturatoPrevisto', etichetta: 'Fatturato previsto', formato: 'euro', gruppo: 'Fatturato' },
      { chiave: 'daFatturare', etichetta: 'Ancora da fatturare', formato: 'euro', gruppo: 'Fatturato' },
      { chiave: 'avanzamentoPiano', etichetta: 'Avanzamento sul piano', formato: 'percentuale', gruppo: 'Fatturato' },
    ]
  },
}
