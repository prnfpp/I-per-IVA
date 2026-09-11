import { max0, mul } from '../denaro.js'
import type { Contesto, Contributo, Kpi, Modulo, Movimento } from '../tipi.js'

/**
 * Il pezzo che manda in crisi le partite IVA: le tasse escono a giugno e
 * novembre e riguardano l'anno precedente, mentre durante l'anno si accantona
 * per l'anno dopo. Qui le due cose sono tenute separate.
 */
export const moduloAcconti: Modulo = {
  id: 'acconti',
  etichetta: 'Calendario F24 e fondo tasse',
  descrizione:
    'Scadenze di giugno e novembre, obiettivo del fondo tasse e piano di accantonamento mensile.',
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
    'accantonamentoMensile',
    'saldoFondoTasse',
    'gapFondoTasse',
  ],

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
    const mensile = Math.round(obiettivo / 12)

    const incassi = ctx.serie.incassiMensili ?? Array(12).fill(0)
    const accantonamenti = incassi.map((inc) =>
      Math.max(mul(inc, ctx.valori.percentualeAccantonamento), mensile),
    )

    const movimenti: Movimento[] = []
    accantonamenti.forEach((importo, i) => {
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
          'Il fondo tasse e\u2019 sotto l\u2019obiettivo: parte di quello che hai sul conto e\u2019 denaro dell\u2019Agenzia delle Entrate.',
      })
    }
    if (serieFondo.some((v) => v < 0)) {
      avvisi.push({
        livello: 'errore',
        modulo: 'acconti',
        messaggio:
          'Con questo piano il fondo tasse va sotto zero durante l\u2019anno: la rata di giugno o novembre finirebbe sul conto corrente.',
      })
    }
    if (impostaPrec === 0 && inpsPrec === 0) {
      avvisi.push({
        livello: 'info',
        modulo: 'acconti',
        messaggio:
          'Non hai inserito imposta e contributi dovuti per l\u2019anno precedente: il calendario F24 resta a zero e l\u2019obiettivo di accantonamento risulta piu\u2019 alto del reale.',
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
        accantonamentoMensile: mensile,
        saldoFondoTasse: ctx.dati.saldoFondoTasse,
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
      { chiave: 'accantonamentoMensile', etichetta: 'Da accantonare ogni mese', formato: 'euro', gruppo: 'Tasse' },
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
