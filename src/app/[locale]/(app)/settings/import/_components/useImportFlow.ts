// ============================================================
// KULTURA — Estado de la importación (F-26, D-15)
//
// Fases, lectura del archivo, importación por lotes con pausa y reanudación,
// y el avance guardado en este navegador (por cuenta). Lo usa ImportClient y
// reparte a cada fase solo lo que necesita.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { parseImportFiles } from '@/lib/import/parse-file'
import { countResults, fingerprint, runImport, type RunProgress } from '@/lib/import/run'
import { sendImportBatch } from '@/lib/account/client'
import { MAX_FILE_BYTES } from '@/lib/import/limits'
import { ImportParseError, type ImportItemResult, type ParseErrorCode, type ParsedImport } from '@/lib/import/types'
import { clearProgress, loadProgress, saveProgress } from '@/lib/import/import-storage'

type Phase = 'idle' | 'reading' | 'preview' | 'running' | 'paused' | 'done' | 'error'
type RunErrorCode = 'auth' | 'demo' | 'server' | 'network'
type AmbiguousAs = 'watched' | 'watchlist'

interface Options {
  /** Cuenta de la sesión: el avance guardado en este navegador es por cuenta. */
  userId: string
  isDemo: boolean
  /** Al terminar: cuántos títulos quedan en la biblioteca gracias a la importación. */
  onFinished?: (inLibrary: number) => void
}

export function useImportFlow({ userId, isDemo, onFinished }: Options) {
  const abortRef = useRef<AbortController | null>(null)
  const statusRef = useRef<HTMLHeadingElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [files, setFiles] = useState<File[]>([])
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [ambiguousAs, setAmbiguousAs] = useState<AmbiguousAs>('watched')
  const [parseError, setParseError] = useState<ParseErrorCode | null>(null)
  const [previous, setPrevious] = useState<Map<string, ImportItemResult> | null>(null)
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const [results, setResults] = useState<Map<string, ImportItemResult>>(new Map())
  const [diary, setDiary] = useState(0)
  const [runError, setRunError] = useState<RunErrorCode | null>(null)

  // Al salir de la página a medias, se para el lote siguiente (lo hecho queda).
  useEffect(() => () => abortRef.current?.abort(), [])

  // El foco va al resumen al terminar (el lector lo anuncia).
  useEffect(() => {
    if (phase === 'done') statusRef.current?.focus()
  }, [phase])

  async function read(list: File[], as: AmbiguousAs = ambiguousAs) {
    setParseError(null)
    setRunError(null)
    if (list.length === 0) return
    if (list.reduce((n, f) => n + f.size, 0) > MAX_FILE_BYTES) {
      setParseError('too_large')
      setPhase('error')
      return
    }
    setPhase('reading')
    try {
      const inputs = await Promise.all(list.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })))
      const result = await parseImportFiles(inputs, { letterboxd: { ambiguousAs: as } })
      setFiles(list)
      setParsed(result)
      const stored = loadProgress(userId, fingerprint(result.source, result.items))
      setPrevious(stored)
      setResults(stored ?? new Map())
      setPhase('preview')
    } catch (e) {
      setParseError(e instanceof ImportParseError ? e.code : 'corrupt')
      setPhase('error')
    }
  }

  /** Lista ambigua de Letterboxd: se vuelve a leer con la opción elegida. */
  function chooseAmbiguous(option: AmbiguousAs) {
    setAmbiguousAs(option)
    void read(files, option)
  }

  async function start(from: Map<string, ImportItemResult> | null) {
    if (!parsed || isDemo) return
    const fp = fingerprint(parsed.source, parsed.items)
    const controller = new AbortController()
    abortRef.current = controller
    setRunError(null)
    setPhase('running')
    const end = await runImport({
      source: parsed.source,
      items: parsed.items,
      send: sendImportBatch,
      previous: from ?? undefined,
      signal: controller.signal,
      onProgress: (p) => {
        setProgress(p)
        setDiary(p.diaryImported)
      },
      onBatch: (r) => {
        setResults(new Map(r))
        saveProgress(userId, fp, parsed.source, r)
      },
    })
    abortRef.current = null
    setResults(new Map(end.results))
    saveProgress(userId, fp, parsed.source, end.results)
    if (end.status === 'error') {
      setRunError(end.error)
      setPhase('paused')
      return
    }
    if (end.status === 'aborted') {
      setPhase('paused')
      return
    }
    setPhase('done')
    const c = countResults(end.results)
    onFinished?.(c.added + c.updated + c.kept)
  }

  /** Para tras el lote en curso (lo hecho queda guardado). */
  function pause() {
    abortRef.current?.abort()
  }

  /** Olvida lo importado antes con este archivo: se vuelve a mandar todo. */
  function startOver() {
    clearProgress(userId)
    setPrevious(null)
    setResults(new Map())
  }

  function reset() {
    abortRef.current?.abort()
    setPhase('idle')
    setParsed(null)
    setFiles([])
    setParseError(null)
    setRunError(null)
    setProgress(null)
    setResults(new Map())
    setPrevious(null)
    setDiary(0)
  }

  return {
    statusRef,
    phase,
    parsed,
    ambiguousAs,
    parseError,
    previous,
    progress,
    results,
    diary,
    runError,
    read,
    chooseAmbiguous,
    start,
    pause,
    startOver,
    reset,
  }
}

export type ImportFlow = ReturnType<typeof useImportFlow>
