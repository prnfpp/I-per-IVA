import { somma } from '../denaro.js'
import type { Contesto, Contributo, Kpi, Modulo, Movimento } from '../tipi.js'

function totale(u: { costoUnitario: number; ricorrenze: number }): number {
  return Math.round(u.costoUnitario * u.ricorrenze)
}

export const moduloUscite: Modulo = {
  id: 'uscite',
  etichetta: 'Uscite',
  descrizione:
    'Spese e risparmio programmato, con la distinzione fra voci ricorrenti e voci che escono tutte in un mese.',
  obbligatorio: true,
  richiede: [],
  fornisce: ['usciteTotali', 'speseCorrenti', 'risparmioProgrammato'],

  calcola(ctx: Contesto): Contributo {
    const uscite = ctx.dati.uscite
    const spese = Array(12).fill(0)
    const risparmi = Array(12).fill(0)

    for (const u of uscite) {
      const tot = totale(u)
      const dest = u.risparmio ? risparmi : spese
      if (u.mese >= 1 && u.mese <= 12) {
        dest[u.mese - 1] += tot
      } else {
        const quota = Math.round(tot / 12)
        for (let i = 0; i < 12; i++) dest[i] += quota
      }
    }

    const perCategoria: Record<string, number> = {}
    for (const u of uscite) {
      perCategoria[u.categoria] = (perCategoria[u.categoria] ?? 0) + totale(u)
    }

    const movimenti: Movimento[] = []
    spese.forEach((importo, i) =>
      movimenti.push({
        mese: i + 1,
        importo: -importo,
        tipo: 'spesa',
        descrizione: 'Spese correnti',
        impattaContoCorrente: true,
      }),
    )
    risparmi.forEach((importo, i) =>
      movimenti.push({
        mese: i + 1,
        importo: -importo,
        tipo: 'risparmio',
        descrizione: 'Risparmio e investimenti',
        impattaContoCorrente: true,
      }),
    )

    return {
      valori: {
        usciteTotali: somma(spese) + somma(risparmi),
        speseCorrenti: somma(spese),
        risparmioProgrammato: somma(risparmi),
        ...Object.fromEntries(
          Object.entries(perCategoria).map(([k, v]) => [`categoria.${k}`, v]),
        ),
      },
      serie: { speseMensili: spese, risparmiMensili: risparmi },
      movimenti,
    }
  },

  kpi(): Kpi[] {
    return [
      { chiave: 'speseCorrenti', etichetta: 'Spese correnti', formato: 'euro', gruppo: 'Uscite' },
      { chiave: 'risparmioProgrammato', etichetta: 'Risparmio programmato', formato: 'euro', gruppo: 'Uscite' },
      { chiave: 'usciteTotali', etichetta: 'Uscite totali', formato: 'euro', gruppo: 'Uscite' },
    ]
  },
}
