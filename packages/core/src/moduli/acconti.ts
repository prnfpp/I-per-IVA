import { max0, mul, type Cents } from '../denaro.js'
import type { Contesto, Contributo, Kpi, Modulo, Movimento } from '../tipi.js'

/**
 * Ripartisce un importo sui mesi in proporzione a quanto e' entrato, senza
 * mai chiedere a un mese piu' di quello che ha incassato.
 *
 * E' la regola che distingue un accantonamento da un prelievo: il denaro per
 * le tasse esce dagli incassi, non dal saldo. Nei mesi a zero non si tocca
 * niente. Quello che gli incassi non riescono a coprire torna indietro come
 * `nonCoperto`, perche' sia detto invece che prelevato in silenzio.
 */
export function ripartisciSuIncassi(
  totale: Cents,
  incassi: Cents[],
): { quote: Cents[]; nonCoperto: Cents } {
  const quote = incassi.map(() => 0)
  let residuo = max0(totale)

  // Piu' giri: quando un mese tocca il suo tetto, la parte che avrebbe dovuto
  // assorbire viene ridistribuita su quelli che hanno ancora capienza.
  for (let giro = 0; giro < incassi.length && residuo > 0; giro++) {
    const aperti = incassi.map((_, i) => i).filter((i) => quote[i] < incassi[i])
    const base = aperti.reduce((a, i) => a + incassi[i], 0)
    if (base <= 0) break

    let mosso = 0
    for (const i of aperti) {
      const rimasto = residuo - mosso
      if (rimasto <= 0) break
      const vuole = Math.min(Math.round((residuo * incassi[i]) / base), rimasto)
      const puo = Math.min(vuole, incassi[i] - quote[i])
      quote[i] += puo
      mosso += puo
    }
    if (mosso <= 0) break
    residuo -= mosso
  }

  return { quote, nonCoperto: max0(residuo) }
}

/**
 * Il pezzo che manda in crisi le partite IVA: le tasse escono a giugno e
 * novembre e riguardano l'anno precedente, mentre durante l'anno si accantona
 * per l'anno dopo. Qui le due cose sono tenute separate.
 */
export const moduloAcconti: Modulo = {
  id: 'acconti',
  etichetta: 'Calendario F24 e fondo tasse',
  descrizione:
    'Scadenze di giugno e novembre, obiettivo del fondo tasse e piano di accantonamento sugli incassi.',
  obbligatorio: true,
  richiede: ['imposta', 'contributi', 'impostaPrevista', 'contributiPrevisti', 'percentualeAccantonamento'],
  fornisce: [
    'f24Giugno',
    'f24Novembre',
    'usciteFiscaliAnno',
    'accontiVersatiAnno',
    'saldoAnnoCorrente',
    'accontiAnnoProssimo',
    'obiettivoFondoTasse',
    'daAccantonareNellAnno',
    'accantonamentoMensile',
    'accantonamentoNonCoperto',
    'saldoFondoTasse',
    'saldoFinaleFondoTasse',
    'gapFondoTasse',
  ],

  regoleUsate(dati) {
    return ['acconti', `previdenza.${dati.profilo.gestione}`]
  },

  calcola(ctx: Contesto): Contributo {
    const a = ctx.regole.acconti
    const gestione = ctx.regole.previdenza[ctx.dati.profilo.gestione]
    const prec = ctx.dati.annoPrecedente

    const sogliaUnica = Math.round(a.sogliaUnicaRata * 100)
    const impostaPrec = prec.impostaDovuta
    const inpsPrec = prec.contributiDovuti

    // Acconti calcolati col metodo storico sull'anno precedente.
    const accontoImpostaTotale =
      impostaPrec < sogliaUnica ? impostaPrec : mul(impostaPrec, a.percentualeTotale)
    const accontoImpostaGiugno =
      impostaPrec < sogliaUnica ? 0 : mul(accontoImpostaTotale, a.quotaPrimaRata)
    const accontoImpostaNovembre = accontoImpostaTotale - accontoImpostaGiugno

    const accontoInpsTotale = mul(inpsPrec, gestione.accontoPercentuale)
    const rate = gestione.accontoRate.length ? gestione.accontoRate : [0.5, 0.5]
    const accontoInpsGiugno = mul(accontoInpsTotale, rate[0])
    const accontoInpsNovembre = accontoInpsTotale - accontoInpsGiugno

    const saldoPrecedente = max0(impostaPrec + inpsPrec - prec.accontiVersati)

    const f24Giugno = saldoPrecedente + accontoImpostaGiugno + accontoInpsGiugno
    const f24Novembre = accontoImpostaNovembre + accontoInpsNovembre
    const accontiVersatiAnno = accontoImpostaTotale + accontoInpsTotale

    // Obiettivo di accantonamento: quello che uscira' l'anno prossimo.
    const saldoAnnoCorrente = max0(
      ctx.valori.impostaPrevista + ctx.valori.contributiPrevisti - accontiVersatiAnno,
    )
    const accontiProssimi =
      (ctx.valori.impostaPrevista < sogliaUnica
        ? ctx.valori.impostaPrevista
        : mul(ctx.valori.impostaPrevista, a.percentualeTotale)) +
      mul(ctx.valori.contributiPrevisti, gestione.accontoPercentuale)
    const obiettivo = saldoAnnoCorrente + accontiProssimi

    // Quanto deve entrare nel fondo durante l'anno perche' a dicembre ci sia
    // l'obiettivo, dopo aver pagato le due rate. Il saldo gia' presente conta,
    // e le due uscite di giugno e novembre pure: ignorarle - come faceva il
    // semplice obiettivo/12 - lasciava il fondo corto di tutta la cifra degli F24.
    const daAccantonare = max0(
      obiettivo + f24Giugno + f24Novembre - ctx.dati.saldoFondoTasse,
    )

    const incassi = ctx.serie.incassiMensili ?? Array(12).fill(0)
    const { quote: accantonamenti, nonCoperto } = ripartisciSuIncassi(daAccantonare, incassi)
    const mensile = Math.round(daAccantonare / 12)

    const movimenti: Movimento[] = []
    accantonamenti.forEach((importo, i) => {
      if (importo === 0) return
      movimenti.push({
        mese: i + 1,
        importo: -importo,
        tipo: 'accantonamento',
        descrizione: 'Trasferimento al fondo tasse',
        impattaContoCorrente: true,
      })
    })
    const meseGiugno = Number(a.scadenzaSaldoEPrimoAcconto.split('-')[0])
    const meseNovembre = Number(a.scadenzaSecondoAcconto.split('-')[0])
    movimenti.push({
      mese: meseGiugno,
      importo: -f24Giugno,
      tipo: 'f24',
      descrizione: `Saldo ${ctx.anno - 1} e primo acconto ${ctx.anno}`,
      impattaContoCorrente: false,
    })
    movimenti.push({
      mese: meseNovembre,
      importo: -f24Novembre,
      tipo: 'f24',
      descrizione: `Secondo acconto ${ctx.anno}`,
      impattaContoCorrente: false,
    })

    // Andamento del fondo tasse: si alimenta ogni mese e si scarica sugli F24.
    let saldo = ctx.dati.saldoFondoTasse
    const serieFondo = accantonamenti.map((acc, i) => {
      saldo += acc
      if (i + 1 === meseGiugno) saldo -= f24Giugno
      if (i + 1 === meseNovembre) saldo -= f24Novembre
      return saldo
    })

    const avvisi: Contributo['avvisi'] = []
    const gap = ctx.dati.saldoFondoTasse - obiettivo
    if (gap < 0) {
      avvisi.push({
        livello: 'attenzione',
        modulo: 'acconti',
        messaggio:
          'Il fondo tasse e’ sotto l’obiettivo: parte di quello che hai sul conto e’ denaro dell’Agenzia delle Entrate.',
      })
    }
    if (nonCoperto > 0) {
      avvisi.push({
        livello: 'attenzione',
        modulo: 'acconti',
        messaggio:
          'Gli incassi dell’anno non bastano ad alimentare il fondo tasse: al piano mancano dei soldi che dovrai trovare altrove. Non li ho tolti dal conto corrente d’ufficio.',
      })
    }
    if (serieFondo.some((v) => v < 0)) {
      avvisi.push({
        livello: 'errore',
        modulo: 'acconti',
        messaggio:
          'Con questo piano il fondo tasse va sotto zero durante l’anno: la rata di giugno o novembre finirebbe sul conto corrente.',
      })
    }
    if (impostaPrec === 0 && inpsPrec === 0) {
      avvisi.push({
        livello: 'info',
        modulo: 'acconti',
        messaggio:
          'Non hai inserito imposta e contributi dovuti per l’anno precedente: il calendario F24 resta a zero e l’obiettivo di accantonamento risulta piu’ alto del reale.',
      })
    }

    return {
      valori: {
        f24Giugno,
        f24Novembre,
        usciteFiscaliAnno: f24Giugno + f24Novembre,
        accontiVersatiAnno,
        saldoAnnoCorrente,
        accontiAnnoProssimo: accontiProssimi,
        obiettivoFondoTasse: obiettivo,
        daAccantonareNellAnno: daAccantonare,
        accantonamentoMensile: mensile,
        accantonamentoNonCoperto: nonCoperto,
        saldoFondoTasse: ctx.dati.saldoFondoTasse,
        saldoFinaleFondoTasse: serieFondo[11] ?? ctx.dati.saldoFondoTasse,
        gapFondoTasse: gap,
      },
      serie: { accantonamentiMensili: accantonamenti, fondoTasseProgressivo: serieFondo },
      movimenti,
      avvisi,
    }
  },

  kpi(): Kpi[] {
    return [
      { chiave: 'f24Giugno', etichetta: 'In uscita a giugno', formato: 'euro', gruppo: 'Tasse' },
      { chiave: 'f24Novembre', etichetta: 'In uscita a novembre', formato: 'euro', gruppo: 'Tasse' },
      { chiave: 'obiettivoFondoTasse', etichetta: 'Obiettivo fondo tasse', formato: 'euro', gruppo: 'Tasse' },
      {
        chiave: 'daAccantonareNellAnno',
        etichetta: 'Da versare sul fondo quest’anno',
        formato: 'euro',
        gruppo: 'Tasse',
        nota: 'Comprende le due rate F24 che il fondo paghera’ a giugno e novembre.',
      },
      {
        chiave: 'accantonamentoMensile',
        etichetta: 'Media mensile',
        formato: 'euro',
        gruppo: 'Tasse',
        nota: 'Riferimento: il versamento vero segue gli incassi, mese per mese.',
      },
      {
        chiave: 'gapFondoTasse',
        etichetta: 'Scoperto sul fondo tasse',
        formato: 'euro',
        gruppo: 'Tasse',
        semaforo: (ctx) => (ctx.valori.gapFondoTasse < 0 ? 'Sotto obiettivo' : 'OK'),
      },
    ]
  },
}
