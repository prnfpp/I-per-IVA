import { z } from 'zod'

/**
 * Schema delle regole fiscali. Ogni file in data/ deve rispettarlo.
 * Il campo `verificato: false` segnala parametri non ancora controllati
 * su fonte primaria: la UI li mostra con un avviso.
 */

const Fonte = {
  fonte: z.string(),
  verificato: z.boolean().default(true),
}

export const minimaleSchema = z.object({
  redditoMinimo: z.number(),
  contributoFisso: z.number(),
  riduzioneNuoveAttivita: z.number(),
})

export const gestioneSchema = z.object({
  etichetta: z.string(),
  aliquotaPiena: z.number(),
  aliquotaRidotta: z.number(),
  massimale: z.number(),
  minimale: minimaleSchema.nullable(),
  accontoPercentuale: z.number(),
  accontoRate: z.array(z.number()),
  scadenzeAcconto: z.array(z.string()),
  scadenzeFisse: z.array(z.string()).optional(),
  ...Fonte,
})

export const regoleSchema = z.object({
  anno: z.number().int(),
  paese: z.literal('IT'),
  aggiornatoIl: z.string().nullable(),

  forfettario: z.object({
    sogliaRicavi: z.number(),
    sogliaUscitaImmediata: z.number(),
    sogliaRedditoDipendente: z.number(),
    aliquotaOrdinaria: z.number(),
    aliquotaStartup: z.number(),
    anniStartup: z.number().int(),
    coefficienti: z.record(z.string(), z.number()),
    ...Fonte,
  }),

  previdenza: z.record(z.string(), gestioneSchema),

  acconti: z.object({
    sogliaUnicaRata: z.number(),
    percentualeTotale: z.number(),
    quotaPrimaRata: z.number(),
    scadenzaSaldoEPrimoAcconto: z.string(),
    scadenzaSecondoAcconto: z.string(),
    ...Fonte,
  }),

  irpef: z.object({
    scaglioni: z.array(z.object({ da: z.number(), aliquota: z.number() })).min(1),
    ...Fonte,
  }),

  lavoroDipendente: z.object({
    contributiDipendente: z.number(),
    tfrDivisore: z.number(),
    tfrFondoGaranzia: z.number(),
    detrazione: z.object({
      importoBase: z.number(),
      soglia1: z.number(),
      soglia2: z.number(),
      soglia3: z.number(),
      quotaFissaFascia2: z.number(),
      quotaVariabileFascia2: z.number(),
      denominatoreFascia2: z.number(),
      quotaFissaFascia3: z.number(),
      denominatoreFascia3: z.number(),
      ...Fonte,
    }),
    cuneoFiscale: z.object({
      sogliaSommaEsente: z.number(),
      percentuali: z.array(z.object({ finoA: z.number(), aliquota: z.number() })),
      ulterioreDetrazione: z.object({
        importoPieno: z.number(),
        sogliaInizio: z.number(),
        sogliaDecalage: z.number(),
        sogliaAzzeramento: z.number(),
      }),
      ...Fonte,
    }),
    addizionali: z.object({
      regionali: z.record(z.string(), z.number()),
      comunali: z.record(z.string(), z.number()),
      ...Fonte,
    }),
  }),

  isee: z.object({
    scalaEquivalenza: z.record(z.string(), z.number()),
    maggiorazioniFigli: z.record(z.string(), z.number()),
    quotaPatrimonio: z.number(),
    deduzioneAffittoMax: z.number(),
    deduzioneAffittoPerFiglioOltreIlSecondo: z.number(),
    deduzioneLavoroDipendentePercentuale: z.number(),
    deduzioneLavoroDipendenteMax: z.number(),
    franchigiaMobiliareBase: z.number(),
    franchigiaMobiliarePerComponente: z.number(),
    franchigiaMobiliareMax: z.number(),
    franchigiaMobiliarePerFiglioOltreIlSecondo: z.number(),
    esclusioneTitoliDiStato: z.number(),
    franchigiaPrimaCasa: z.number(),
    franchigiaPrimaCasaCittaMetropolitana: z.number(),
    franchigiaPrimaCasaPerFiglioOltreIlPrimo: z.number(),
    quotaEccedenzaPrimaCasa: z.number(),
    annoRiferimentoRedditiIndietro: z.number().int(),
    ...Fonte,
  }),

  investimenti: z.object({
    capitalGain: z.number(),
    capitalGainTitoliDiStato: z.number(),
    fondoPensioneDeduzioneMax: z.number(),
    ...Fonte,
  }),
})

export type Regole = z.infer<typeof regoleSchema>
export type Gestione = z.infer<typeof gestioneSchema>
