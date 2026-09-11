import { euro } from './denaro.js'
import { CATEGORIE_PREDEFINITE, datiIniziali } from './datiIniziali.js'
import type { DatiUtente } from './tipi.js'

/**
 * Dati di esempio per far vedere l'app a qualcuno senza costringerlo a
 * inserire niente. Numeri inventati e volutamente tondi: non appartengono
 * a nessuno.
 */
export function datiEsempio(anno = 2026): DatiUtente {
  const d = datiIniziali(anno)

  d.profilo.coefficiente = 0.78
  d.profilo.annoInizioAttivita = anno - 4
  d.profilo.regione = 'emilia-romagna'
  d.profilo.comune = 'bologna'
  d.profilo.moduliAttivi = ['previsione', 'patrimonio', 'regola503020']

  const clienti = [
    ['Studio Marini', 2500],
    ['Cooperativa Aurora', 1200],
  ] as const

  d.fatture = []
  for (let mese = 1; mese <= 9; mese++) {
    const ultimo = new Date(anno, mese, 0).getDate()
    const data = `${anno}-${String(mese).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
    for (const [cliente, importo] of clienti) {
      d.fatture.push({
        id: `esempio-${cliente}-${mese}`,
        cliente,
        imponibile: euro(importo),
        dataEmissione: data,
        // le ultime due fatture restano da incassare, per mostrare l'avviso
        dataIncasso: mese === 9 ? null : data,
      })
    }
  }

  d.previsione = clienti.map(([cliente, importo]) => ({
    cliente,
    mesi: Array(12).fill(euro(importo)),
  }))

  // categoria, voce, costo, ricorrenze nell'anno, mese (null = ricorrente), risparmio
  const uscite: [string, string, number, number, number | null, boolean][] = [
    ['Casa', 'Affitto', 600, 12, null, false],
    ['Casa', 'Bollette', 90, 12, null, false],
    ['Casa', 'Spesa alimentare', 300, 12, null, false],
    ['P.IVA', 'Commercialista', 700, 1, 3, false],
    ['P.IVA', 'Software e abbonamenti', 40, 12, null, false],
    ['Macchina', 'Carburante', 80, 12, null, false],
    ['Macchina', 'Assicurazione', 520, 1, 4, false],
    ['Macchina', 'Bollo', 200, 1, 5, false],
    ['Cura della persona', 'Dentista e visite', 90, 4, null, false],
    ['Tempo Libero', 'Uscite e sport', 150, 12, null, false],
    ['Tempo Libero', 'Vacanza estiva', 900, 1, 7, false],
    ['Risparmio', 'PAC mensile su ETF', 300, 12, null, true],
  ]
  d.categorie = CATEGORIE_PREDEFINITE.map((c) => ({ ...c }))
  d.uscite = uscite.map(([categoria, voce, costo, ricorrenze, mese, risparmio], i) => ({
    id: `esempio-uscita-${i}`,
    categoria,
    voce,
    costoUnitario: euro(costo),
    ricorrenze,
    cadenza: mese === null ? ('ricorrente' as const) : ('una-tantum' as const),
    mese,
    risparmio,
  }))

  d.annoPrecedente = {
    impostaDovuta: euro(3200),
    contributiDovuti: euro(7600),
    accontiVersati: euro(8000),
  }
  d.saldoInizialeCassa = euro(6500)
  d.saldoFondoTasse = euro(9000)

  d.patrimonio = {
    liquidita: euro(6500),
    fondoEmergenza: euro(11000),
    spesePrevedibili: euro(9000),
    strumenti: [
      {
        id: 'esempio-etf-mondo',
        nome: 'ETF azionario globale',
        tipo: 'ETF azionario',
        orizzonte: 'lungo',
        prezzoCarico: euro(95),
        prezzoMercato: euro(112),
        quantita: 120,
        destinazione: 'Pensione',
        titoloDiStato: false,
      },
      {
        id: 'esempio-monetario',
        nome: 'ETF monetario in euro',
        tipo: 'ETF monetario',
        orizzonte: 'breve',
        prezzoCarico: euro(100),
        prezzoMercato: euro(103),
        quantita: 60,
        destinazione: 'Fondo di emergenza',
        titoloDiStato: false,
      },
    ],
  }

  d.isee = {
    ...d.isee,
    componenti: 1,
    redditoForfettario: euro(21000),
    canoneAnnuo: euro(7200),
    giacenzaMediaConti: euro(12000),
    cittaMetropolitana: true,
  }

  return d
}
