import { max0, mul } from '../denaro.js'
import type { Contesto, Contributo, Kpi, Modulo, Strumento } from '../tipi.js'

/**
 * Tipi di strumento riconosciuti. E' un elenco chiuso perche' il modulo fa un
 * confronto esatto su 'ETF azionario' per avvisare quando un titolo di rischio
 * e' assegnato a un orizzonte breve: con il testo libero quel controllo si
 * spegne da solo alla prima variante di scrittura.
 */
export const TIPI_STRUMENTO = [
  'ETF azionario',
  'ETF obbligazionario',
  'ETF monetario',
  'Fondo comune',
  'Azione singola',
  'Titolo di Stato',
  'Conto deposito',
  'Altro',
] as const

/** Valore netto di uno strumento, al netto del capital gain sulla sola plusvalenza. */
export function valoreNetto(s: Strumento, aliquota: number, aliquotaStato: number): number {
  const lordo = Math.round(s.prezzoMercato * s.quantita)
  const carico = Math.round(s.prezzoCarico * s.quantita)
  const plus = max0(lordo - carico)
  return lordo - mul(plus, s.titoloDiStato ? aliquotaStato : aliquota)
}

/**
 * Quattro pilastri: liquidita', fondo di emergenza, spese prevedibili,
 * lungo termine. L'orizzonte dichiarato dello strumento decide il pilastro,
 * cosi' un ETF azionario destinato a una spesa fra tre anni si vede.
 */
export const moduloPatrimonio: Modulo = {
  id: 'patrimonio',
  etichetta: 'Patrimonio e quattro pilastri',
  descrizione:
    'Assegna ogni euro al suo orizzonte temporale e confronta i pilastri con gli obiettivi.',
  obbligatorio: false,
  richiede: ['speseCorrenti'],
  opzionali: ['obiettivoFondoTasse'],
  fornisce: [
    'pilastro1',
    'pilastro2',
    'pilastro3',
    'pilastro4',
    'patrimonioTotale',
    'obiettivoFondoEmergenza',
    'coperturaFondoEmergenza',
  ],

  regoleUsate() {
    return ['investimenti']
  },

  calcola(ctx: Contesto): Contributo {
    const inv = ctx.regole.investimenti
    const p = ctx.dati.patrimonio
    const perOrizzonte = { breve: 0, medio: 0, lungo: 0 }
    for (const s of p.strumenti) {
      perOrizzonte[s.orizzonte] += valoreNetto(s, inv.capitalGain, inv.capitalGainTitoliDiStato)
    }

    const pilastro1 = p.liquidita
    const pilastro2 = p.fondoEmergenza + perOrizzonte.breve
    const pilastro3 = p.spesePrevedibili + perOrizzonte.medio
    const pilastro4 = perOrizzonte.lungo

    // Una partita IVA non ha la NASpI: sei mesi di spese, non tre.
    const mesiCopertura = 6
    const obiettivoEmergenza = Math.round((ctx.valori.speseCorrenti / 12) * mesiCopertura)

    const avvisi: Contributo['avvisi'] = []
    if (obiettivoEmergenza > 0 && pilastro2 < obiettivoEmergenza) {
      avvisi.push({
        livello: 'attenzione',
        modulo: 'patrimonio',
        messaggio: `Il fondo di emergenza copre meno di ${mesiCopertura} mesi di spese correnti.`,
      })
    }
    const azionariBreve = p.strumenti.filter((s) => s.orizzonte !== 'lungo' && s.tipo === 'ETF azionario')
    if (azionariBreve.length) {
      avvisi.push({
        livello: 'attenzione',
        modulo: 'patrimonio',
        messaggio:
          'Hai strumenti azionari assegnati a un orizzonte breve o medio: denaro di un pilastro parcheggiato negli strumenti di un altro.',
      })
    }

    return {
      valori: {
        pilastro1,
        pilastro2,
        pilastro3,
        pilastro4,
        patrimonioTotale: pilastro1 + pilastro2 + pilastro3 + pilastro4,
        obiettivoFondoEmergenza: obiettivoEmergenza,
        coperturaFondoEmergenza: obiettivoEmergenza > 0 ? pilastro2 / obiettivoEmergenza : 0,
      },
      avvisi,
    }
  },

  kpi(): Kpi[] {
    return [
      { chiave: 'patrimonioTotale', etichetta: 'Patrimonio totale', formato: 'euro', gruppo: 'Patrimonio' },
      { chiave: 'pilastro2', etichetta: 'Fondo di emergenza', formato: 'euro', gruppo: 'Patrimonio' },
      {
        chiave: 'coperturaFondoEmergenza',
        etichetta: 'Copertura del fondo di emergenza',
        formato: 'percentuale',
        gruppo: 'Patrimonio',
        semaforo: (ctx) => (ctx.valori.coperturaFondoEmergenza < 1 ? 'Sotto sei mesi di spese' : 'OK'),
      },
      { chiave: 'pilastro4', etichetta: 'Investimenti di lungo termine', formato: 'euro', gruppo: 'Patrimonio' },
    ]
  },
}
