import type { Blocco, Contesto, Contributo, Kpi, Modulo } from '../tipi.js'
import { totaleUscita } from './uscite.js'

export const moduloRegola503020: Modulo = {
  id: 'regola503020',
  etichetta: 'Regola 50-30-20',
  descrizione:
    'Ripartizione delle uscite calcolata sul netto disponibile, non sul totale speso: così si vede se stai davvero risparmiando.',
  obbligatorio: false,
  richiede: ['netto', 'usciteTotali', 'risparmioProgrammato'],
  opzionali: ['nettoDipendenteAnnuo'],
  fornisce: [
    'nettoDisponibile',
    'quotaNecessita',
    'quotaSvago',
    'quotaRisparmio',
    'speseNonAssegnate',
    'liquiditaResidua',
  ],

  calcola(ctx: Contesto): Contributo {
    const nettoDisponibile = ctx.valori.netto + (ctx.valori.nettoDipendenteAnnuo ?? 0)

    const blocchi = new Map<string, Blocco | null>(
      ctx.dati.categorie.map((c) => [c.nome, c.blocco]),
    )

    const perBlocco: Record<Blocco, number> = { necessita: 0, svago: 0, risparmio: 0 }
    let nonAssegnate = 0
    const categorieNonAssegnate = new Set<string>()

    for (const u of ctx.dati.uscite) {
      const totale = totaleUscita(u)
      // La spunta "risparmio" e' un fatto di cassa dichiarato sulla riga:
      // vince sul blocco della categoria.
      if (u.risparmio) {
        perBlocco.risparmio += totale
        continue
      }
      const blocco = blocchi.get(u.categoria) ?? null
      if (blocco === null) {
        // Mai un'assegnazione d'ufficio: una categoria senza blocco resta
        // fuori dalle quote e viene segnalata, come faceva il vecchio foglio
        // di calcolo con il suo "il totale deve fare 100%".
        nonAssegnate += totale
        if (u.categoria) categorieNonAssegnate.add(u.categoria)
        continue
      }
      perBlocco[blocco] += totale
    }

    const allocato = perBlocco.necessita + perBlocco.svago + perBlocco.risparmio + nonAssegnate
    const residua = nettoDisponibile - allocato

    const quota = (v: number) => (nettoDisponibile > 0 ? v / nettoDisponibile : 0)

    const avvisi: Contributo['avvisi'] = []
    if (categorieNonAssegnate.size) {
      avvisi.push({
        livello: 'attenzione',
        modulo: 'regola503020',
        messaggio: `Queste categorie non sono assegnate a un blocco e restano fuori dalla regola 50-30-20: ${[...categorieNonAssegnate].join(', ')}. Assegnale nella scheda Uscite.`,
      })
    }
    if (residua < 0) {
      avvisi.push({
        livello: 'attenzione',
        modulo: 'regola503020',
        messaggio: 'Le uscite programmate superano il netto disponibile dell’anno.',
      })
    }

    return {
      valori: {
        nettoDisponibile,
        quotaNecessita: quota(perBlocco.necessita),
        quotaSvago: quota(perBlocco.svago),
        quotaRisparmio: quota(perBlocco.risparmio + Math.max(0, residua)),
        speseNonAssegnate: nonAssegnate,
        liquiditaResidua: residua,
      },
      avvisi,
    }
  },

  kpi(): Kpi[] {
    return [
      { chiave: 'nettoDisponibile', etichetta: 'Netto disponibile', formato: 'euro', gruppo: 'Regola 50-30-20' },
      { chiave: 'quotaNecessita', etichetta: 'Necessità', formato: 'percentuale', gruppo: 'Regola 50-30-20', nota: 'Obiettivo 50%.' },
      { chiave: 'quotaSvago', etichetta: 'Svago', formato: 'percentuale', gruppo: 'Regola 50-30-20', nota: 'Obiettivo 30%.' },
      {
        chiave: 'quotaRisparmio',
        etichetta: 'Risparmio',
        formato: 'percentuale',
        gruppo: 'Regola 50-30-20',
        nota: 'Obiettivo 20%.',
        semaforo: (ctx) => (ctx.valori.quotaRisparmio < 0.2 ? 'Sotto il 20%' : 'OK'),
      },
    ]
  },
}
