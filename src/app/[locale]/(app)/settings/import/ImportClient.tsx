'use client'

// ============================================================
// KULTURA — Importar desde otras apps (F-26, D-15)
//
// 1) Elegir o soltar el archivo tal cual lo da la otra app (ZIP, CSV, XML o
//    .xml.gz). Se lee aquí, en el navegador. 2) Vista previa: qué se ha
//    reconocido y cuánto. 3) Importar por lotes con progreso, pausa y
//    reanudación. 4) Resumen, informe CSV descargable y lista de lo que no se
//    pudo emparejar con enlace a la búsqueda.
//
// Lo usan Ajustes → Importar y, en compacto, el paso opcional del onboarding.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { cn } from '@/lib/utils/index'
import { parseImportFiles, summarizeImport } from '@/lib/import/parse-file'
import { buildReportCsv, type ReportLabels } from '@/lib/import/report'
import { countResults, fingerprint, runImport, type RunProgress, type SendBatch } from '@/lib/import/run'
import { MAX_FILE_BYTES, MAX_IMPORT_ITEMS } from '@/lib/import/limits'
import {
  IMPORT_OUTCOMES,
  IMPORT_SOURCES,
  ImportParseError,
  type ImportItemResult,
  type ImportOutcome,
  type ParseErrorCode,
  type ParsedImport,
} from '@/lib/import/types'
import { loadProgress, saveProgress } from './import-storage'

type Phase = 'idle' | 'reading' | 'preview' | 'running' | 'paused' | 'done' | 'error'
type RunErrorCode = 'auth' | 'demo' | 'server' | 'network'

const MB = Math.round(MAX_FILE_BYTES / 1024 / 1024)
const UNMATCHED_SHOWN = 20
const ACCEPT = '.zip,.csv,.xml,.gz,text/csv,application/zip,application/xml,text/xml,application/gzip'

/** Envía un lote al servidor (el orquestador decide qué hacer con cada respuesta). */
const sendBatch: SendBatch = async (request, signal) => {
  const res = await fetch('/api/account/import/external', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  })
  if (res.ok) return { ok: true, data: await res.json() }
  const retry = Number(res.headers.get('Retry-After'))
  return { ok: false, status: res.status, retryAfterSeconds: Number.isFinite(retry) ? retry : undefined }
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export interface ImportClientProps {
  locale: 'es' | 'en'
  isDemo?: boolean
  /** Versión del onboarding: sin instrucciones por app ni enlace a la biblioteca. */
  compact?: boolean
  /** Al terminar: cuántos títulos quedan en la biblioteca gracias a la importación. */
  onFinished?: (inLibrary: number) => void
}

export function ImportClient({ locale, isDemo = false, compact = false, onFinished }: ImportClientProps) {
  const t = useTranslations('import')
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const statusRef = useRef<HTMLHeadingElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [files, setFiles] = useState<File[]>([])
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [ambiguousAs, setAmbiguousAs] = useState<'watched' | 'watchlist'>('watched')
  const [parseError, setParseError] = useState<ParseErrorCode | null>(null)
  const [previous, setPrevious] = useState<Map<string, ImportItemResult> | null>(null)
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const [results, setResults] = useState<Map<string, ImportItemResult>>(new Map())
  const [diary, setDiary] = useState(0)
  const [runError, setRunError] = useState<RunErrorCode | null>(null)
  const [dragging, setDragging] = useState(false)

  // Al salir de la página a medias, se para el lote siguiente (lo hecho queda).
  useEffect(() => () => abortRef.current?.abort(), [])

  // El foco va al resumen al terminar (el lector lo anuncia).
  useEffect(() => {
    if (phase === 'done') statusRef.current?.focus()
  }, [phase])

  async function read(list: File[], as: 'watched' | 'watchlist' = ambiguousAs) {
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
      const stored = loadProgress(fingerprint(result.source, result.items))
      setPrevious(stored)
      setResults(stored ?? new Map())
      setPhase('preview')
    } catch (e) {
      setParseError(e instanceof ImportParseError ? e.code : 'corrupt')
      setPhase('error')
    }
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
      send: sendBatch,
      previous: from ?? undefined,
      signal: controller.signal,
      onProgress: (p) => {
        setProgress(p)
        setDiary(p.diaryImported)
      },
      onBatch: (r) => {
        setResults(new Map(r))
        saveProgress(fp, parsed.source, r)
      },
    })
    abortRef.current = null
    setResults(new Map(end.results))
    saveProgress(fp, parsed.source, end.results)
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
    if (inputRef.current) inputRef.current.value = ''
  }

  function downloadReport() {
    if (!parsed) return
    const labels: ReportLabels = {
      headers: {
        title: t('report.title'),
        year: t('report.year'),
        result: t('report.result'),
        matchedTitle: t('report.matchedTitle'),
        matchedYear: t('report.matchedYear'),
        method: t('report.method'),
        link: t('report.link'),
      },
      outcomes: Object.fromEntries(IMPORT_OUTCOMES.map((o) => [o, t(`report.outcomes.${o}`)])) as Record<ImportOutcome, string>,
      methods: {
        tmdb: t('report.methods.tmdb'),
        imdb: t('report.methods.imdb'),
        tvdb: t('report.methods.tvdb'),
        mal: t('report.methods.mal'),
        isbn: t('report.methods.isbn'),
        title_year: t('report.methods.title_year'),
        title: t('report.methods.title'),
      },
    }
    const csv = buildReportCsv(parsed.items, results, labels, window.location.origin, locale)
    download(`${t('report.fileName')}-${parsed.source}-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8')
  }

  if (isDemo) {
    return (
      <p role="status" className="rounded-20 bg-surface-default px-5 py-4 font-body text-sm text-text-secondary sm:px-6">
        {t('demo')}
      </p>
    )
  }

  const summary = parsed ? summarizeImport(parsed.items) : null
  const counts = countResults(results)
  const done = previous ? Array.from(previous.values()).filter((r) => r.outcome !== 'pending').length : 0
  const unmatched = parsed ? parsed.items.filter((i) => results.get(i.key)?.outcome === 'unmatched') : []
  const card = 'rounded-20 bg-surface-default px-5 py-5 sm:px-6'
  const sourceName = parsed ? t(`sources.${parsed.source}.name`) : ''

  return (
    <div className="flex flex-col gap-5">
      {(phase === 'idle' || phase === 'reading' || phase === 'error') && (
        <>
          {!compact && (
            <div className="flex flex-col gap-2">
              <p className="font-body text-[15px] text-text-secondary">{t('intro')}</p>
              <p className="font-body text-sm text-text-tertiary">{t('keepNote')}</p>
            </div>
          )}

          <section
            aria-label={t('dropZoneLabel')}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              void read(Array.from(e.dataTransfer.files))
            }}
            className={cn(
              'flex flex-col items-center gap-3 rounded-20 border-2 border-dashed px-5 py-8 text-center transition-colors',
              dragging ? 'border-accent-pink bg-surface-elevated' : 'border-surface-border bg-surface-default'
            )}
          >
            {/* Input oculto y fuera del orden de Tab: lo maneja el botón (patrón de Ajustes). */}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => void read(Array.from(e.target.files ?? []))}
            />
            <KButton type="button" size="lg" loading={phase === 'reading'} onClick={() => inputRef.current?.click()}>
              {t('chooseFile')}
            </KButton>
            <p className="font-body text-sm text-text-tertiary">
              {phase === 'reading'
                ? t('reading')
                : t('dropHint', { mb: MB, max: MAX_IMPORT_ITEMS.toLocaleString(locale) })}
            </p>
            <p className="max-w-[52ch] font-body text-xs text-text-tertiary">{t('privacy')}</p>
          </section>

          {parseError && (
            <p role="alert" className="rounded-[14px] bg-accent-danger/10 px-[18px] py-3 font-body text-sm text-accent-danger">
              {t(`parseErrors.${parseError}`, { mb: MB })}
            </p>
          )}

          {!compact && (
            <section aria-labelledby="import-howto" className="flex flex-col gap-2">
              <h2 id="import-howto" className="mb-1 text-[13px] font-extrabold uppercase tracking-wide text-text-tertiary">
                {t('howTo')}
              </h2>
              <div className="flex flex-col divide-y divide-surface-border overflow-hidden rounded-20 bg-surface-default">
                {IMPORT_SOURCES.map((source) => (
                  <details key={source} className="group px-5 py-4 sm:px-6">
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 font-body text-sm font-bold text-text-primary focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">
                      {t(`sources.${source}.name`)}
                      <span aria-hidden="true" className="text-text-tertiary transition-transform group-open:rotate-180">
                        ▾
                      </span>
                    </summary>
                    <p className="pb-1 pt-2 font-body text-sm text-text-secondary">{t(`sources.${source}.how`)}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {phase === 'preview' && parsed && summary && (
        <section aria-labelledby="import-preview" className={cn(card, 'flex flex-col gap-4')}>
          <h2 id="import-preview" className="font-display text-xl font-bold text-text-primary">
            {t('previewTitle', { source: sourceName, count: summary.total })}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {(['completed', 'in_progress', 'pending', 'abandoned'] as const).map((s) =>
              summary.byStatus[s] > 0 ? (
                <li key={s} className="rounded-pill bg-surface-elevated px-3 py-1.5 font-body text-sm font-bold text-text-primary">
                  {t(`summary.${s}`, { count: summary.byStatus[s] })}
                </li>
              ) : null
            )}
            {summary.rated > 0 ? (
              <li className="rounded-pill bg-surface-elevated px-3 py-1.5 font-body text-sm font-bold text-text-primary">
                {t('summary.rated', { count: summary.rated })}
              </li>
            ) : null}
            {summary.logs > 0 ? (
              <li className="rounded-pill bg-surface-elevated px-3 py-1.5 font-body text-sm font-bold text-text-primary">
                {t('summary.logs', { count: summary.logs })}
              </li>
            ) : null}
          </ul>
          <p className="break-words font-body text-xs text-text-tertiary">
            {t('previewFiles', { files: parsed.files.map((f) => f.split('/').pop()).join(', ') })}
          </p>

          {parsed.warnings.map((w) => (
            <p key={w.code} className="rounded-[14px] bg-surface-elevated px-[18px] py-3 font-body text-sm text-text-secondary">
              {w.code === 'skipped_rows'
                ? t('warnings.skipped_rows', { count: w.count })
                : w.code === 'truncated'
                  ? t('warnings.truncated', { count: w.count, max: w.max })
                  : t(`warnings.${w.code}`)}
            </p>
          ))}

          {parsed.warnings.some((w) => w.code === 'ambiguous_list') && (
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">{t('warnings.ambiguous_list')}</legend>
              {(['watched', 'watchlist'] as const).map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[14px] bg-surface-elevated px-4 py-3 font-body text-sm font-bold text-text-primary',
                    ambiguousAs === option && 'ring-2 ring-accent-pink'
                  )}
                >
                  <input
                    type="radio"
                    name="import-ambiguous"
                    checked={ambiguousAs === option}
                    onChange={() => {
                      setAmbiguousAs(option)
                      void read(files, option)
                    }}
                    className="h-5 w-5 flex-shrink-0 cursor-pointer accent-accent-pink"
                  />
                  {option === 'watched' ? t('ambiguousWatched') : t('ambiguousWatchlist')}
                </label>
              ))}
            </fieldset>
          )}

          <p className="font-body text-sm text-text-tertiary">{t('keepNote')}</p>
          {done > 0 ? (
            <p role="status" className="font-body text-sm font-bold text-text-secondary">
              {t('resumeNote', { done, total: summary.total })}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <KButton type="button" variant="secondary" size="lg" onClick={reset}>
              {t('another')}
            </KButton>
            <KButton type="button" size="lg" onClick={() => void start(previous)}>
              {t('start', { count: summary.total })}
            </KButton>
          </div>
        </section>
      )}

      {(phase === 'running' || phase === 'paused') && parsed && (
        <section aria-labelledby="import-running" className={cn(card, 'flex flex-col gap-4')}>
          <h2 id="import-running" className="font-display text-xl font-bold text-text-primary">
            {sourceName}
          </h2>
          <ProgressBar label={t('progressLabel')} value={progress?.processed ?? 0} max={parsed.items.length} />
          <p role="status" className="font-body text-sm text-text-secondary">
            {phase === 'paused'
              ? runError
                ? t(`runErrors.${runError}`)
                : t('paused')
              : progress?.phase === 'retrying'
                ? t('retrying')
                : progress?.phase === 'waiting'
                  ? t('waiting')
                  : t('running', { processed: progress?.processed ?? 0, total: parsed.items.length })}
          </p>
          <Counts counts={counts} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {phase === 'running' ? (
              <KButton type="button" variant="secondary" size="lg" onClick={() => abortRef.current?.abort()}>
                {t('pause')}
              </KButton>
            ) : runError !== 'demo' && runError !== 'auth' ? (
              <KButton type="button" size="lg" onClick={() => void start(results)}>
                {t('resume')}
              </KButton>
            ) : null}
          </div>
        </section>
      )}

      {phase === 'done' && parsed && (
        <section aria-labelledby="import-done" className={cn(card, 'flex flex-col gap-4')}>
          <h2 id="import-done" ref={statusRef} tabIndex={-1} className="font-display text-xl font-bold text-text-primary outline-none">
            {t('doneTitle')}
          </h2>
          <Counts counts={counts} />
          {diary > 0 ? <p className="font-body text-sm text-text-secondary">{t('diaryImported', { count: diary })}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <KButton type="button" variant="secondary" onClick={downloadReport}>
              {t('downloadReport')}
            </KButton>
            {counts.pending > 0 ? (
              <KButton type="button" variant="secondary" onClick={() => void start(results)}>
                {t('retryPending')}
              </KButton>
            ) : null}
            {!compact && (
              <KButton asChild>
                <Link href={`/${locale}/library`}>{t('toLibrary')}</Link>
              </KButton>
            )}
          </div>

          {unmatched.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="font-body text-sm font-extrabold text-text-primary">{t('unmatchedTitle')}</h3>
              <ul className="flex flex-col divide-y divide-surface-border">
                {unmatched.slice(0, UNMATCHED_SHOWN).map((item) => (
                  <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="min-w-0 font-body text-sm text-text-secondary">
                      {item.title}
                      {item.year ? ` (${item.year})` : ''}
                    </span>
                    <Link
                      href={`/${locale}/discover?type=${item.kind}&page=1&q=${encodeURIComponent(item.title)}`}
                      className="inline-flex min-h-[44px] items-center font-body text-sm font-bold text-accent-pink underline-offset-4 hover:underline"
                    >
                      {t('searchFor', { title: item.title.length > 40 ? `${item.title.slice(0, 40)}…` : item.title })}
                    </Link>
                  </li>
                ))}
              </ul>
              {unmatched.length > UNMATCHED_SHOWN ? (
                <p className="font-body text-xs text-text-tertiary">
                  {t('unmatchedMore', { count: unmatched.length - UNMATCHED_SHOWN })}
                </p>
              ) : null}
            </div>
          ) : null}

          <KButton type="button" variant="secondary" className="self-start" onClick={reset}>
            {t('another')}
          </KButton>
        </section>
      )}
    </div>
  )
}

function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-elevated"
    >
      <div className="h-full rounded-pill bg-accent-pink transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Recuento por resultado (solo lo que no es cero). */
function Counts({ counts }: { counts: Record<ImportOutcome, number> }) {
  const t = useTranslations('import')
  const order: ImportOutcome[] = ['added', 'updated', 'kept', 'unmatched', 'pending', 'excluded', 'invalid']
  return (
    <ul className="flex flex-wrap gap-2">
      {order.map((o) =>
        counts[o] > 0 ? (
          <li
            key={o}
            className={cn(
              'rounded-pill px-3 py-1.5 font-body text-sm font-bold',
              o === 'added' ? 'bg-accent-lime text-on-accent-lime' : 'bg-surface-elevated text-text-primary'
            )}
          >
            {t(`counts.${o}`, { count: counts[o] })}
          </li>
        ) : null
      )}
    </ul>
  )
}
