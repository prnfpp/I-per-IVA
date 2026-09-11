import { regolePerAnno, annoCoperto, parametriDaVerificare } from '@iperiva/rules'
import type { Contesto, Contributo, DatiUtente, Kpi, Modulo } from './tipi.js'

const registro = new Map<string, Modulo>()

export function registra(modulo: Modulo): void {
  if (registro.has(modulo.id)) {
    throw new Error(`Modulo duplicato: ${modulo.id}`)
  }
  registro.set(modulo.id, modulo)
}

export function moduli(): Modulo[] {
  return [...registro.values()]
}

export function modulo(id: string): Modulo | undefined {
  return registro.get(id)
}

/**
 * Ordina i moduli attivi in base alle dipendenze dichiarate.
 * Le dipendenze non sono fra moduli ma fra chiavi: un modulo che richiede
 * `imposta` viene calcolato dopo chi la fornisce. Così aggiungere un modulo
 * non richiede di toccare gli altri.
 */
export function ordina(attivi: Modulo[]): Modulo[] {
  const fornitore = new Map<string, string>()
  for (const m of attivi) {
    for (const chiave of m.fornisce) {
      if (fornitore.has(chiave)) {
        throw new Error(
          `La chiave "${chiave}" è fornita sia da ${fornitore.get(chiave)} sia da ${m.id}`,
        )
      }
      fornitore.set(chiave, m.id)
    }
  }

  const mancanti: string[] = []
  for (const m of attivi) {
    for (const chiave of m.richiede) {
      if (!fornitore.has(chiave)) mancanti.push(`${m.id} richiede "${chiave}"`)
    }
  }
  if (mancanti.length) {
    throw new Error(`Dipendenze non soddisfatte:\n- ${mancanti.join('\n- ')}`)
  }

  const stato = new Map<string, 'aperto' | 'chiuso'>()
  const ordinati: Modulo[] = []
  const perId = new Map(attivi.map((m) => [m.id, m]))

  const visita = (m: Modulo, catena: string[]): void => {
    if (stato.get(m.id) === 'chiuso') return
    if (stato.get(m.id) === 'aperto') {
      throw new Error(`Dipendenza circolare: ${[...catena, m.id].join(' -> ')}`)
    }
    stato.set(m.id, 'aperto')
    const deps = [...m.richiede, ...(m.opzionali ?? [])]
    for (const chiave of deps) {
      const id = fornitore.get(chiave)
      if (id && id !== m.id) visita(perId.get(id)!, [...catena, m.id])
    }
    stato.set(m.id, 'chiuso')
    ordinati.push(m)
  }

  for (const m of attivi) visita(m, [])
  return ordinati
}

function unisci(ctx: Contesto, c: Contributo): void {
  Object.assign(ctx.valori, c.valori ?? {})
  Object.assign(ctx.testi, c.testi ?? {})
  Object.assign(ctx.serie, c.serie ?? {})
  if (c.movimenti) ctx.movimenti.push(...c.movimenti)
  if (c.avvisi) ctx.avvisi.push(...c.avvisi)
}

export interface Risultato {
  contesto: Contesto
  moduliCalcolati: string[]
  kpi: Kpi[]
}

export function calcola(dati: DatiUtente): Risultato {
  const anno = dati.profilo.anno
  const regole = regolePerAnno(anno)

  const ctx: Contesto = {
    anno,
    regole,
    dati,
    valori: {},
    testi: {},
    serie: {},
    movimenti: [],
    avvisi: [],
  }

  if (!annoCoperto(anno)) {
    ctx.avvisi.push({
      livello: 'attenzione',
      modulo: 'regole',
      messaggio: `Non ci sono regole per il ${anno}: sto usando quelle del ${regole.anno}. I numeri sono indicativi.`,
    })
  }
  const attivi = moduli().filter(
    (m) => m.obbligatorio || dati.profilo.moduliAttivi.includes(m.id),
  )
  const ordinati = ordina(attivi)

  // Avvisare su tutti i parametri non verificati significa avvisare quasi
  // sempre su regole che l'utente non usa - le gestioni Artigiani e
  // Commercianti a un professionista in Gestione Separata, le addizionali
  // IRPEF a chi non ha un contratto da dipendente. Un avviso che non si puo'
  // far sparire smette di essere letto, e con lui quelli che contano. Ogni
  // modulo dichiara quali percorsi delle regole legge davvero, e qui si tiene
  // solo l'intersezione.
  const usati = ordinati.flatMap((m) => m.regoleUsate?.(dati) ?? [])
  const pertinente = (percorso: string) =>
    usati.some((u) => percorso === u || percorso.startsWith(`${u}.`) || u.startsWith(`${percorso}.`))
  const daVerificare = parametriDaVerificare(regole).filter((p) => pertinente(p.percorso))
  if (daVerificare.length) {
    ctx.avvisi.push({
      livello: 'info',
      modulo: 'regole',
      messaggio: `Parametri usati da questo calcolo ma non ancora verificati su fonte primaria: ${daVerificare
        .map((p) => (p.fonte ? `${p.percorso} (${p.fonte})` : p.percorso))
        .join('; ')}`,
    })
  }

  for (const m of ordinati) {
    unisci(ctx, m.calcola(ctx))
  }

  return {
    contesto: ctx,
    moduliCalcolati: ordinati.map((m) => m.id),
    kpi: ordinati.flatMap((m) => m.kpi()),
  }
}
