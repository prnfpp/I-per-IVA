import { describe, expect, it } from 'vitest'
import {
  calcola,
  calcolaBustaPaga,
  datiIniziali,
  euro,
  ralDaNetto,
  ripartisciSuIncassi,
  type DatiUtente,
  type Fattura,
  type Uscita,
} from '@iperiva/core'
import { regolePerAnno } from '@iperiva/rules'

/**
 * Scenario di riferimento: partita IVA forfettaria in Gestione Separata,
 * coefficiente 78%, imposta al 15%, anno 2026, 45.040 euro incassati.
 * I valori attesi vengono dal foglio Excel verificato a mano, riga per riga.
 * Se un numero qui cambia, o hai trovato un bug o hai cambiato le regole:
 * in entrambi i casi va spiegato nel commit.
 */

function fattura(mese: number, importo: number, incassata = true): Fattura {
  const giorno = new Date(2026, mese, 0).getDate()
  const data = `2026-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
  return {
    id: `f-${mese}-${importo}`,
    cliente: 'Cliente',
    imponibile: euro(importo),
    dataEmissione: data,
    dataIncasso: incassata ? data : null,
  }
}

function scenarioBase(): DatiUtente {
  const d = datiIniziali(2026)
  d.profilo.coefficiente = 0.78
  d.profilo.regione = 'emilia-romagna'
  d.profilo.comune = 'bologna'
  d.fatture = [
    fattura(1, 3000),
    fattura(2, 3375),
    fattura(3, 3137.5),
    fattura(3, 1870),
    fattura(4, 3187.5),
    fattura(4, 1720),
    fattura(4, 600),
    fattura(5, 3450),
    fattura(6, 3500),
    fattura(7, 3800),
    fattura(8, 1575),
    fattura(9, 3600),
    fattura(9, 1600),
    fattura(10, 3950),
    fattura(11, 3775),
    fattura(12, 2900),
  ]
  return d
}

describe('forfettario in Gestione Separata, anno 2026', () => {
  const { contesto } = calcola(scenarioBase())
  const v = contesto.valori

  it('somma gli incassi per cassa', () => {
    expect(v.incassato).toBe(euro(45040))
    expect(v.fatturatoEmesso).toBe(euro(45040))
    expect(v.daIncassare).toBe(0)
  })

  it('applica il coefficiente di redditivita', () => {
    expect(v.imponibileLordo).toBe(euro(35131.2))
  })

  it('calcola i contributi al 26,07% senza altra copertura', () => {
    expect(v.aliquotaInpsApplicata).toBe(0.2607)
    expect(v.contributi).toBe(euro(9158.7))
  })

  it('deduce i contributi prima di applicare l imposta sostitutiva', () => {
    expect(v.imponibileNetto).toBe(euro(25972.5))
    expect(v.imposta).toBe(euro(3895.88))
  })

  it('arriva al dovuto e al netto reale', () => {
    expect(v.dovuto).toBe(euro(13054.58))
    expect(v.netto).toBe(euro(45040) - euro(13054.58))
    expect(v.pressioneFiscale).toBeCloseTo(0.2898, 4)
  })

  it('propone una percentuale di accantonamento col margine', () => {
    expect(v.percentualeAccantonamento).toBeCloseTo(0.2898 + 0.05, 3)
  })

  it('non segnala il superamento della soglia sotto gli 85.000 euro', () => {
    expect(v.utilizzoSogliaRicavi).toBeCloseTo(45040 / 85000, 4)
    expect(contesto.avvisi.some((a) => a.livello === 'errore')).toBe(false)
  })
})

describe('effetto del lavoro dipendente sull aliquota previdenziale', () => {
  it('scende dal 26,07% al 24% quando c e un altra copertura', () => {
    const d = scenarioBase()
    d.profilo.moduliAttivi = ['dipendente']
    d.dipendente.attivo = true
    d.dipendente.lordoMensile = euro(1800)
    d.dipendente.mensilita = 14

    const { contesto } = calcola(d)
    expect(contesto.valori.aliquotaInpsApplicata).toBe(0.24)
    expect(contesto.valori.contributi).toBe(euro(35131.2 * 0.24))
  })

  it('segnala l esclusione dal forfettario oltre la soglia', () => {
    const d = scenarioBase()
    d.profilo.moduliAttivi = ['dipendente']
    d.dipendente.attivo = true
    d.dipendente.lordoMensile = euro(3000)
    d.dipendente.mensilita = 14
    d.dipendente.redditoAnnoPrecedente = euro(40000)

    const { contesto } = calcola(d)
    expect(
      contesto.avvisi.some((a) => a.modulo === 'dipendente' && a.livello === 'errore'),
    ).toBe(true)
  })
})

describe('busta paga 2026: 1.800 euro lordi su 14 mensilita', () => {
  const d = scenarioBase()
  d.profilo.moduliAttivi = ['dipendente']
  d.dipendente.attivo = true
  d.dipendente.lordoMensile = euro(1800)
  d.dipendente.mensilita = 14
  const { contesto } = calcola(d)
  const esito = calcolaBustaPaga(euro(25200), contesto)

  it('trattiene i contributi al 9,19%', () => {
    expect(esito.contributi).toBe(euro(2315.88))
    expect(esito.imponibile).toBe(euro(22884.12))
  })

  it('applica gli scaglioni IRPEF 2026', () => {
    expect(esito.irpefLorda).toBe(euro(5263.35))
  })

  it('applica detrazione art. 13 e ulteriore detrazione da cuneo', () => {
    expect(esito.detrazioneLavoro).toBe(euro(2378.3))
    expect(esito.ulterioreDetrazione).toBe(euro(1000))
    expect(esito.irpefNetta).toBe(euro(1885.05))
  })

  it('non riconosce il bonus esente sopra i 20.000 euro', () => {
    expect(esito.bonusCuneo).toBe(0)
  })

  it('arriva al netto annuo e al TFR', () => {
    expect(esito.addizionali).toBe(euro(578.97))
    expect(esito.nettoAnnuo).toBe(euro(20420.1))
    expect(esito.tfr).toBe(euro(1740.67))
  })

  it('il simulatore inverso ritrova la RAL a partire dal netto', () => {
    const ral = ralDaNetto(euro(19600), contesto)
    const verifica = calcolaBustaPaga(ral, contesto)
    expect(Math.abs(verifica.nettoAnnuo - euro(19600))).toBeLessThan(euro(1))
  })

  it('riconosce il bonus esente sotto i 20.000 euro, al posto dell ulteriore detrazione', () => {
    const basso = calcolaBustaPaga(euro(18000), contesto)
    // Il bonus si calcola sul reddito da lavoro dipendente, cioe' sull imponibile
    // fiscale, non sulla RAL: 4,8% di 16.345,80.
    expect(basso.imponibile).toBe(euro(16345.8))
    expect(basso.bonusCuneo).toBe(euro(784.6))
    expect(basso.ulterioreDetrazione).toBe(0)
    expect(basso.irpefNetta).toBe(euro(782.72))
  })

  it('il netto cresce col lordo sopra le fasce del bonus cuneo', () => {
    let precedente = -1
    for (let ral = euro(23000); ral <= euro(120000); ral += euro(250)) {
      const netto = calcolaBustaPaga(ral, contesto).nettoAnnuo
      expect(netto).toBeGreaterThan(precedente)
      precedente = netto
    }
  })

  it('documenta i due salti creati dalle fasce del bonus cuneo', () => {
    // Le percentuali 7,1% / 5,3% / 4,8% si applicano per fasce sull intero
    // reddito: superare 8.500 o 15.000 euro di imponibile fa perdere netto.
    // Non e' un bug del calcolo, e' come e' scritta la norma.
    const prima = calcolaBustaPaga(euro(9360), contesto)
    const dopo = calcolaBustaPaga(euro(9370), contesto)
    expect(prima.imponibile).toBeLessThanOrEqual(euro(8500))
    expect(dopo.imponibile).toBeGreaterThan(euro(8500))
    expect(dopo.nettoAnnuo).toBeLessThan(prima.nettoAnnuo)
  })
})

describe('calendario F24 col metodo storico', () => {
  it('spacca il saldo e gli acconti fra giugno e novembre', () => {
    const d = scenarioBase()
    d.annoPrecedente = {
      impostaDovuta: euro(5000),
      contributiDovuti: euro(8000),
      accontiVersati: 0,
    }
    const { contesto } = calcola(d)
    // saldo 13.000 + 40% di 5.000 + metà dell'80% di 8.000
    expect(contesto.valori.f24Giugno).toBe(euro(13000 + 2000 + 3200))
    // 60% di 5.000 + seconda metà dell'80% di 8.000
    expect(contesto.valori.f24Novembre).toBe(euro(3000 + 3200))
  })

  it('resta a zero se non si conoscono i dati dell anno precedente', () => {
    const { contesto } = calcola(scenarioBase())
    expect(contesto.valori.f24Giugno).toBe(0)
    expect(contesto.valori.f24Novembre).toBe(0)
    expect(contesto.avvisi.some((a) => a.modulo === 'acconti' && a.livello === 'info')).toBe(true)
  })

  it('l obiettivo di accantonamento copre saldo e acconti dell anno prossimo', () => {
    const d = scenarioBase()
    d.annoPrecedente = {
      impostaDovuta: euro(3895.88),
      contributiDovuti: euro(9158.7),
      accontiVersati: euro(13054.58),
    }
    const { contesto } = calcola(d)
    const v = contesto.valori
    expect(v.obiettivoFondoTasse).toBe(v.saldoAnnoCorrente + v.accontiAnnoProssimo)
  })

  /**
   * Il fondo tasse paga le due rate F24 mentre l'anno scorre. Quello che va
   * versato durante l'anno e' quindi l'obiettivo piu' le due rate, meno il
   * saldo gia' presente: la vecchia formula obiettivo/12 le ignorava e il
   * fondo chiudeva l'anno corto di tutta la cifra degli F24.
   */
  it('il piano di versamento copre anche le due rate che il fondo paghera', () => {
    const d = scenarioBase()
    d.annoPrecedente = {
      impostaDovuta: euro(3895.88),
      contributiDovuti: euro(9158.7),
      accontiVersati: euro(13054.58),
    }
    d.saldoFondoTasse = euro(4000)
    const { contesto } = calcola(d)
    const v = contesto.valori
    expect(v.daAccantonareNellAnno).toBe(
      v.obiettivoFondoTasse + v.f24Giugno + v.f24Novembre - euro(4000),
    )
    expect(v.accantonamentoMensile).toBe(Math.round(v.daAccantonareNellAnno / 12))
    // A dicembre nel fondo c'e' esattamente l'obiettivo, non meno.
    expect(v.saldoFinaleFondoTasse).toBe(v.obiettivoFondoTasse)
  })

  /**
   * Regressione: prima l'accantonamento aveva un minimo mensile fisso che
   * usciva dal conto corrente anche nei mesi senza incassi, ed era quello a
   * generare lo scoperto che poi l'app addebitava alle spese dell'utente.
   */
  it('non accantona niente nei mesi in cui non e entrato niente', () => {
    const d = datiIniziali(2026)
    d.profilo.coefficiente = 0.78
    d.fatture = [fattura(1, 10000), fattura(2, 10000)]
    d.annoPrecedente = { impostaDovuta: euro(3000), contributiDovuti: euro(7000), accontiVersati: 0 }
    const { contesto } = calcola(d)
    const acc = contesto.serie.accantonamentiMensili
    expect(acc.slice(2).every((v) => v === 0)).toBe(true)
    expect(acc[0]).toBeGreaterThan(0)
    // e mai piu' di quanto quel mese ha incassato
    contesto.serie.incassiMensili.forEach((inc, i) => {
      expect(acc[i]).toBeLessThanOrEqual(inc)
    })
  })

  it('dichiara quello che gli incassi non riescono a coprire invece di prelevarlo', () => {
    const d = datiIniziali(2026)
    d.profilo.coefficiente = 0.78
    d.fatture = [fattura(1, 1000)]
    d.annoPrecedente = {
      impostaDovuta: euro(9000),
      contributiDovuti: euro(9000),
      accontiVersati: 0,
    }
    const { contesto } = calcola(d)
    expect(contesto.valori.accantonamentoNonCoperto).toBeGreaterThan(0)
    expect(
      contesto.avvisi.some((a) => a.modulo === 'acconti' && /non bastano/.test(a.messaggio)),
    ).toBe(true)
  })
})

describe('ripartizione dell accantonamento sugli incassi', () => {
  it('non chiede a un mese piu di quanto ha incassato e ridistribuisce il resto', () => {
    const incassi = [euro(100), euro(1000), 0, euro(500)]
    const { quote, nonCoperto } = ripartisciSuIncassi(euro(800), incassi)
    expect(nonCoperto).toBe(0)
    expect(quote.reduce((a, b) => a + b, 0)).toBe(euro(800))
    quote.forEach((q, i) => expect(q).toBeLessThanOrEqual(incassi[i]))
    expect(quote[2]).toBe(0)
  })

  it('segnala la parte che gli incassi non coprono', () => {
    const { quote, nonCoperto } = ripartisciSuIncassi(euro(5000), [euro(300), euro(200)])
    expect(quote).toEqual([euro(300), euro(200)])
    expect(nonCoperto).toBe(euro(4500))
  })

  it('non tocca niente quando non e entrato niente', () => {
    const { quote, nonCoperto } = ripartisciSuIncassi(euro(1000), Array(12).fill(0))
    expect(quote.every((q) => q === 0)).toBe(true)
    expect(nonCoperto).toBe(euro(1000))
  })
})

describe('uscite: cadenza e categorie', () => {
  function conUscita(extra: Partial<Uscita>): DatiUtente {
    const d = datiIniziali(2026)
    d.profilo.moduliAttivi = ['regola503020']
    d.uscite = [
      {
        id: 'u1',
        categoria: 'Casa',
        voce: 'Affitto',
        costoUnitario: euro(600),
        ricorrenze: 12,
        cadenza: 'ricorrente',
        mese: null,
        risparmio: false,
        ...extra,
      },
    ]
    return d
  }

  it('spalma le voci ricorrenti su dodici mesi', () => {
    const { contesto } = calcola(conUscita({}))
    expect(contesto.serie.speseMensili).toEqual(Array(12).fill(euro(600)))
  })

  it('addebita le voci una tantum nel loro mese', () => {
    const d = conUscita({ cadenza: 'una-tantum', mese: 4, ricorrenze: 1, costoUnitario: euro(520) })
    const { contesto } = calcola(d)
    expect(contesto.serie.speseMensili[3]).toBe(euro(520))
    expect(contesto.serie.speseMensili.filter((v) => v > 0)).toHaveLength(1)
  })

  it('segnala la combinazione contraddittoria invece di correggerla', () => {
    const d = conUscita({ cadenza: 'una-tantum', mese: 5, ricorrenze: 12 })
    const { contesto } = calcola(d)
    expect(contesto.serie.speseMensili[4]).toBe(euro(7200))
    expect(contesto.avvisi.some((a) => a.modulo === 'uscite')).toBe(true)
  })

  /**
   * Regressione: una categoria fuori dall'elenco finiva in silenzio nello
   * svago. Ora resta fuori dalle quote e viene detta.
   */
  it('non assegna d ufficio una categoria senza blocco', () => {
    const d = conUscita({ categoria: 'Auto' })
    d.categorie.push({ nome: 'Auto', blocco: null })
    d.fatture = [fattura(1, 30000)]
    const { contesto } = calcola(d)
    expect(contesto.valori.speseNonAssegnate).toBe(euro(7200))
    expect(contesto.valori.quotaSvago).toBe(0)
    expect(
      contesto.avvisi.some((a) => a.modulo === 'regola503020' && /Auto/.test(a.messaggio)),
    ).toBe(true)
  })

  it('conta la categoria nel blocco che dichiara', () => {
    const d = conUscita({ categoria: 'Auto' })
    d.categorie.push({ nome: 'Auto', blocco: 'necessita' })
    d.fatture = [fattura(1, 30000)]
    const { contesto } = calcola(d)
    expect(contesto.valori.speseNonAssegnate).toBe(0)
    expect(contesto.valori.quotaNecessita).toBeGreaterThan(0)
  })
})

describe('avvisi sui parametri non verificati', () => {
  const avvisoRegole = (d: DatiUtente) =>
    calcola(d).contesto.avvisi.find((a) => a.modulo === 'regole' && /non ancora verificati/.test(a.messaggio))

  it('tace su gestioni e addizionali che il profilo non usa', () => {
    const d = datiIniziali(2026)
    d.profilo.gestione = 'gestione_separata'
    d.profilo.moduliAttivi = []
    expect(avvisoRegole(d)).toBeUndefined()
  })

  it('avvisa sulla gestione scelta quando non e verificata', () => {
    const d = datiIniziali(2026)
    d.profilo.gestione = 'artigiani'
    d.profilo.moduliAttivi = []
    expect(avvisoRegole(d)?.messaggio).toContain('previdenza.artigiani')
  })

  it('avvisa sulle addizionali solo con il modulo dipendente acceso', () => {
    const d = datiIniziali(2026)
    d.profilo.moduliAttivi = ['dipendente']
    expect(avvisoRegole(d)?.messaggio).toContain('lavoroDipendente.addizionali')
  })
})

describe('ISEE', () => {
  it('conta per intero il reddito forfettario e deduce il canone di affitto', () => {
    const d = scenarioBase()
    d.profilo.moduliAttivi = ['isee']
    d.isee.componenti = 1
    d.isee.redditoForfettario = euro(25972.5)
    d.isee.canoneAnnuo = euro(5196)
    const { contesto } = calcola(d)
    expect(contesto.valori.scalaEquivalenza).toBe(1)
    expect(contesto.valori.isr).toBe(euro(25972.5 - 5196))
    expect(contesto.valori.isee).toBe(euro(25972.5 - 5196))
  })

  it('applica la franchigia mobiliare e il 20% sul patrimonio', () => {
    const d = scenarioBase()
    d.profilo.moduliAttivi = ['isee']
    d.isee.componenti = 1
    d.isee.giacenzaMediaConti = euro(20000)
    const { contesto } = calcola(d)
    expect(contesto.valori.ispMobiliare).toBe(euro(14000))
    expect(contesto.valori.ise).toBe(euro(2800))
  })

  it('esclude i titoli di Stato fino a 50.000 euro', () => {
    const d = scenarioBase()
    d.profilo.moduliAttivi = ['isee']
    d.isee.titoliDiStato = euro(45000)
    const { contesto } = calcola(d)
    expect(contesto.valori.ispMobiliare).toBe(0)
  })

  it('usa la franchigia prima casa maggiorata nelle citta metropolitane', () => {
    const d = scenarioBase()
    d.profilo.moduliAttivi = ['isee']
    d.isee.cittaMetropolitana = true
    d.isee.valoreImuPrimaCasa = euro(150000)
    const { contesto } = calcola(d)
    expect(contesto.valori.ispImmobiliare).toBe(Math.round(euro(30000) * (2 / 3)))
  })
})

describe('regole per anno', () => {
  it('nel 2025 la seconda aliquota IRPEF era al 35%', () => {
    expect(regolePerAnno(2025).irpef.scaglioni[1].aliquota).toBe(0.35)
    expect(regolePerAnno(2026).irpef.scaglioni[1].aliquota).toBe(0.33)
  })

  it('dal 2027 la soglia sui redditi da dipendente torna a 30.000 euro', () => {
    expect(regolePerAnno(2026).forfettario.sogliaRedditoDipendente).toBe(35000)
    expect(regolePerAnno(2027).forfettario.sogliaRedditoDipendente).toBe(30000)
  })
})
