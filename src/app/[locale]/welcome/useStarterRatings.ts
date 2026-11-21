import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { StarterTitle } from '@/lib/recommendations/starter-titles'
import { saveLibraryEntry } from '@/lib/library/actions'
import { SAVE_DEBOUNCE_MS } from './welcome-steps'

type SaveState = 'saving' | 'saved' | 'error'

/** Paso "puntuar": notas que se guardan solas, como "completado" con su nota. */
export function useStarterRatings(locale: 'es' | 'en') {
  const t = useTranslations('onboarding')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({})
  const [rateError, setRateError] = useState('')
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const pending = useRef(new Map<string, () => Promise<void>>())
  // F-26: lo importado de otra app (paso opcional) también cuenta.
  const [importedCount, setImportedCount] = useState(0)
  // Lo que se está guardando ya cuenta: si falla, se descuenta y se avisa.
  const ratedCount = Object.values(saveState).filter((s) => s !== 'error').length + importedCount

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((id) => clearTimeout(id))
  }, [])

  function rate(title: StarterTitle, score: number) {
    setScores((prev) => ({ ...prev, [title.id]: score }))
    setSaveState((prev) => ({ ...prev, [title.id]: 'saving' }))
    setRateError('')

    const save = async () => {
      timers.current.delete(title.id)
      pending.current.delete(title.id)
      try {
        // Saneamiento 9.3: el wrapper tipado de /api/library (lanza ApiError).
        await saveLibraryEntry({ mediaId: title.id, status: 'completed', score })
        setSaveState((prev) => ({ ...prev, [title.id]: 'saved' }))
      } catch {
        setSaveState((prev) => ({ ...prev, [title.id]: 'error' }))
        setScores((prev) => {
          const copy = { ...prev }
          delete copy[title.id]
          return copy
        })
        setRateError(t('rateError', { title: title.title[locale] }))
      }
    }

    const previous = timers.current.get(title.id)
    if (previous) clearTimeout(previous)
    pending.current.set(title.id, save)
    timers.current.set(title.id, setTimeout(() => void save(), SAVE_DEBOUNCE_MS))
  }

  /** Guarda ya lo que esté esperando el debounce (antes de cambiar de paso). */
  async function flushRatings() {
    timers.current.forEach((id) => clearTimeout(id))
    timers.current.clear()
    const saves = Array.from(pending.current.values())
    pending.current.clear()
    await Promise.all(saves.map((save) => save()))
  }

  return { scores, rateError, ratedCount, setImportedCount, rate, flushRatings }
}

export type StarterRatings = ReturnType<typeof useStarterRatings>
