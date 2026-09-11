import { describe, expect, it } from 'vitest'
import {
  calcola,
  datiEsempio,
  datiIniziali,
  esporta,
  euro,
  formatta,
  migra,
  moduli,
  ordina,
  ripartisci,
  type Modulo,
} from '@iperiva/core'

const finto = (
  id: string,
  richiede: string[],
  fornisce: string[],
  opzionali: string[] = [],
): Modulo => ({
  id,
  etichetta: id,
  descrizione: '',
  obbligatorio: false,
  richiede,
  opzionali,
  fornisce,
  calcola: () => ({}),
  kpi: () => [],
})

describe('registro e ordinamento dei moduli', () => {
  it('ordina in base alle chiavi, non all ordine di registrazione', () => {
    const a = finto('a', ['x'], ['y'])
    const b = finto('b', [], ['x'])
    const ordinati = ordina([a, b]).map((m) => m.id)
    expect(ordinati).toEqual(['b', 'a'])
  })

  it('rifiuta due moduli che forniscono la stessa chiave', () => {
    expect(() => ordina([finto('a', [], ['x']), finto('b', [], ['x'])])).toThrow(/fornita sia da/)
  })

  it('rifiuta una dipendenza non soddisfatta', () => {
    expect(() => ordina([finto('a', ['manca'], ['y'])])).toThrow(/Dipendenze non soddisfatte/)
  })

  it('rileva le dipendenze circolari', () => {
    expect(() => ordina([finto('a', ['y'], ['x']), finto('b', ['x'], ['y'])])).toThrow(/circolare/)
  })

  it('tollera le dipendenze opzionali assenti', () => {
    expect(() => ordina([finto('a', [], ['y'], ['nonEsiste'])])).not.toThrow()
  })

  it('calcola solo i moduli obbligatori piu quelli attivati', () => {
    const dati = datiIniziali(2026)
    dati.profilo.moduliAttivi = []
    const { moduliCalcolati } = calcola(dati)
    const obbligatori = moduli()
      .filter((m) => m.obbligatorio)
      .map((m) => m.id)
    expect(moduliCalcolati.sort()).toEqual(obbligatori.sort())
  })

  it('gira anche su uno stato completamente vuoto', () => {
    const { contesto } = calcola(datiIniziali(2026))
    expect(contesto.valori.incassato).toBe(0)
    expect(contesto.valori.dovuto).toBe(0)
    expect(Number.isFinite(contesto.valori.saldoFinaleCassa)).toBe(true)
  })
})

describe('denaro', () => {
  it('converte in centesimi interi', () => {
    expect(euro(1234.56)).toBe(123456)
    expect(euro(0.1) + euro(0.2)).toBe(euro(0.3))
  })

  it('ripartisce senza perdere centesimi', () => {
    const parti = ripartisci(100, 3)
    expect(parti.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('formatta in euro con la virgola decimale', () => {
    const testo = formatta(123456)
    expect(testo).toContain(',56')
    expect(testo).toContain('€')
  })
})

describe('file utente', () => {
  it('esporta e reimporta senza perdite', () => {
    const dati = datiIniziali(2026)
    dati.saldoInizialeCassa = euro(5329)
    const riletti = migra(JSON.parse(esporta(dati)))
    expect(riletti.saldoInizialeCassa).toBe(euro(5329))
  })

  it('rifiuta un file scritto da una versione futura', () => {
    expect(() => migra({ schemaVersion: 99 })).toThrow(/piu' recente/)
  })
})

describe('dati di esempio', () => {
  it('calcolano senza errori e producono numeri sensati', () => {
    const { contesto } = calcola(datiEsempio(2026))
    expect(contesto.valori.incassato).toBeGreaterThan(0)
    expect(contesto.valori.daIncassare).toBeGreaterThan(0)
    expect(contesto.valori.dovuto).toBeGreaterThan(0)
    expect(contesto.valori.percentualeAccantonamento).toBeGreaterThan(0.2)
    expect(contesto.valori.percentualeAccantonamento).toBeLessThan(0.5)
    expect(contesto.valori.patrimonioTotale).toBeGreaterThan(0)
  })
})
