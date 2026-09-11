import { useCallback, useEffect, useMemo, useState } from 'react'
import { calcola, datiEsempio, datiIniziali, esporta, migra, type DatiUtente } from '@iperiva/core'

const CHIAVE = 'quadro:dati:v1'

function carica(): DatiUtente {
  try {
    const grezzo = localStorage.getItem(CHIAVE)
    if (!grezzo) return datiIniziali()
    return migra(JSON.parse(grezzo))
  } catch (e) {
    console.warn('Dati locali non leggibili, riparto da zero.', e)
    return datiIniziali()
  }
}

export function useStato() {
  const [dati, setDati] = useState<DatiUtente>(carica)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(CHIAVE, JSON.stringify(dati))
  }, [dati])

  const risultato = useMemo(() => {
    try {
      setErrore(null)
      return calcola(dati)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e))
      return null
    }
  }, [dati])

  const aggiorna = useCallback((fn: (d: DatiUtente) => void) => {
    setDati((precedente) => {
      const copia = structuredClone(precedente)
      fn(copia)
      return copia
    })
  }, [])

  const scarica = useCallback(() => {
    const blob = new Blob([esporta(dati)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quadro-${dati.profilo.anno}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [dati])

  const importa = useCallback(async (file: File) => {
    const testo = await file.text()
    setDati(migra(JSON.parse(testo)))
  }, [])

  const azzera = useCallback(() => setDati(datiIniziali(dati.profilo.anno)), [dati.profilo.anno])

  const caricaEsempio = useCallback(() => setDati(datiEsempio(dati.profilo.anno)), [dati.profilo.anno])

  const vuoto = dati.fatture.length === 0 && dati.uscite.length === 0

  return { dati, aggiorna, risultato, errore, scarica, importa, azzera, caricaEsempio, vuoto }
}
