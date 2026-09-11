import { regoleSchema, type Regole } from './schema.js'
import it2025 from '../data/it-2025.json' with { type: 'json' }
import it2026 from '../data/it-2026.json' with { type: 'json' }
import it2027 from '../data/it-2027.json' with { type: 'json' }

export * from './schema.js'

const grezze: Record<number, unknown> = {
  2025: it2025,
  2026: it2026,
  2027: it2027,
}

export const anniDisponibili = Object.keys(grezze)
  .map(Number)
  .sort((a, b) => a - b)

const cache = new Map<number, Regole>()

/**
 * Restituisce le regole validate per l'anno richiesto.
 * Se l'anno non esiste usa il più recente disponibile e lo segnala,
 * perché è meglio un calcolo dichiaratamente approssimato che nessun calcolo.
 */
export function regolePerAnno(anno: number): Regole {
  if (cache.has(anno)) return cache.get(anno)!
  const disponibile = grezze[anno] ? anno : anniDisponibili[anniDisponibili.length - 1]
  const parsed = regoleSchema.parse(grezze[disponibile])
  cache.set(anno, parsed)
  return parsed
}

export function annoCoperto(anno: number): boolean {
  return Boolean(grezze[anno])
}

/** Elenco dei parametri non ancora verificati su fonte primaria. */
export function parametriDaVerificare(regole: Regole): string[] {
  const out: string[] = []
  const visita = (nodo: unknown, percorso: string) => {
    if (!nodo || typeof nodo !== 'object') return
    const obj = nodo as Record<string, unknown>
    if (obj.verificato === false) out.push(percorso || '(radice)')
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') visita(v, percorso ? `${percorso}.${k}` : k)
    }
  }
  visita(regole, '')
  return out
}
