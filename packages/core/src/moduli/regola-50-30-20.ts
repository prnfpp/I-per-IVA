import type { Contesto, Contributo, Kpi, Modulo } from '../tipi.js'

/** Mappa fra blocchi della regola e categorie di uscita, sovrascrivibile. */
export const MAPPA_PREDEFINITA: Record<string, string[]> = {
  necessita: ['Casa', 'Macchina', 'P.IVA', 'Cura della persona', 'Studio', 'Salute'],
  svago: ['Abbonamenti', 'Hobby', 'Tempo Libero', 'Altro'],
  risparmio: ['Risparmio'],
}

export const moduloRegola503020: Modulo = {
  id: 'regola503020',
  etichetta: 'Regola 50-30-20',
  descrizione:
    'Ripartizione delle uscite calcolata sul netto disponibile, non sul totale speso: cosi\u2019 si vede se stai davvero risparmiando.',
  obbligatorio: false,
  richiede: ['netto', 'usciteTotali', 'risparmioProgrammato'],
  opzionali: ['nettoDipendenteAnnuo'],
  fornisce: [
    'nettoDisponibile',
    'quotaNecessita',
    'quotaSvago',
    'quotaRisparmio',
    'liquiditaResidua',
  ],

  calcola(ctx: Contesto): Contributo {
    const nettoDisponibile = ctx.valori.netto + (ctx.valori.nettoDipendenteAnnuo ?? 0)

    const perBlocco: Record<string, number> = { necessita: 0, svago: 0, risparmio: 0 }
    for (const u of ctx.dati.uscite) {
      const totale = Math.round(u.costoUnitario * u.ricorrenze)
      if (u.risparmio) {
        perBlocco.risparmio += totale
        continue
      }
      const blocco =
        Object.entries(MAPPA_PREDEFINITA).find(([, cats]) => cats.includes(u.categoria))?.[0] ??
        'svago'
      perBlocco[blocco] += totale
    }

    const allocato = perBlocco.necessita + perBlocco.svago + perBlocco.risparmio
    const residua = nettoDisponibile - allocato

    const quota = (v: number) => (nettoDisponibile > 0 ? v / nettoDisponibile : 0)

    return {
      valori: {
        nettoDisponibile,
        quotaNecessita: quota(perBlocco.necessita),
        quotaSvago: quota(perBlocco.svago),
        quotaRisparmio: quota(perBlocco.risparmio + Math.max(0, residua)),
        liquiditaResidua: residua,
      },
      avvisi:
        residua < 0
          ? [
              {
                livello: 'attenzione',
                modulo: 'regola503020',
                messaggio: 'Le uscite programmate superano il netto disponibile dell\u2019anno.',
              },
            ]
          : [],
    }
  },

  kpi(): Kpi[] {
    return [
      { chiave: 'nettoDisponibile', etichetta: 'Netto disponibile', formato: 'euro', gruppo: 'Regola 50-30-20' },
      { chiave: 'quotaNecessita', etichetta: 'Necessita\u2019', formato: 'percentuale', gruppo: 'Regola 50-30-20', nota: 'Obiettivo 50%.' },
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
