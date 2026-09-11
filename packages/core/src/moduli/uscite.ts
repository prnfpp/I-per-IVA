import { somma } from '../denaro.js'
import type { Contesto, Contributo, Kpi, Modulo, Movimento, Uscita } from '../tipi.js'

export function totaleUscita(u: Pick<Uscita, 'costoUnitario' | 'ricorrenze'>): number {
  return Math.round(u.costoUnitario * u.ricorrenze)
}

/** Il mese di addebito, oppure null se la voce va spalmata su dodici mesi. */
function meseDiAddebito(u: Uscita): number | null {
  if (u.cadenza !== 'una-tantum') return null
  return u.mese !== null && u.mese >= 1 && u.mese <= 12 ? u.mese : null
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
      const tot = totaleUscita(u)
      const dest = u.risparmio ? risparmi : spese
      const mese = meseDiAddebito(u)
      if (mese !== null) {
        dest[mese - 1] += tot
      } else {
        const quota = Math.round(tot / 12)
        for (let i = 0; i < 12; i++) dest[i] += quota
      }
    }

    const perCategoria: Record<string, number> = {}
    for (const u of uscite) {
      perCategoria[u.categoria] = (perCategoria[u.categoria] ?? 0) + totaleUscita(u)
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

    // Residuo dei file scritti prima che cadenza esistesse: una voce una
    // tantum ripetuta piu' volte addebita tutto nello stesso mese. E' quasi
    // sempre un errore di compilazione, ma i numeri sono dell'utente: si
    // segnala, non si corregge d'ufficio.
    const contraddittorie = uscite.filter((u) => u.cadenza === 'una-tantum' && u.ricorrenze > 1)
    const avvisi: Contributo['avvisi'] = contraddittorie.map((u) => ({
      livello: 'attenzione',
      modulo: 'uscite',
      messaggio: `"${u.voce || u.categoria}" e' una spesa una tantum ripetuta ${u.ricorrenze} volte: l'intero importo viene addebitato nel mese ${u.mese ?? '?'}. Se e' una spesa che torna ogni mese, impostala come ricorrente.`,
    }))

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
      avvisi,
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
