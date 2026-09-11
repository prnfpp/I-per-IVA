/**
 * Tutti gli importi nel core sono centesimi interi.
 * Regola non negoziabile: mai float per il denaro. Le percentuali sono
 * numeri decimali (0.15) e ogni moltiplicazione passa da `mul`, che arrotonda
 * al centesimo con arrotondamento commerciale.
 */
export type Cents = number

export function euro(valore: number): Cents {
  return Math.round(valore * 100)
}

export function inEuro(c: Cents): number {
  return c / 100
}

/** Moltiplica un importo per un'aliquota e arrotonda al centesimo. */
export function mul(c: Cents, aliquota: number): Cents {
  return Math.round(c * aliquota)
}

/** Divide un importo in `n` parti, distribuendo i centesimi di resto. */
export function ripartisci(c: Cents, n: number): Cents[] {
  if (n <= 0) return []
  const base = Math.floor(c / n)
  const resto = c - base * n
  return Array.from({ length: n }, (_, i) => base + (i < Math.abs(resto) ? Math.sign(resto) : 0))
}

export function somma(valori: Cents[]): Cents {
  return valori.reduce((a, b) => a + b, 0)
}

export function max0(c: Cents): Cents {
  return c > 0 ? c : 0
}

export function minimo(a: Cents, b: Cents): Cents {
  return a < b ? a : b
}

export function formatta(c: Cents, locale = 'it-IT'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(inEuro(c))
}

export function formattaPercentuale(p: number, decimali = 1, locale = 'it-IT'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  }).format(p)
}
