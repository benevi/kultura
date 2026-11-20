// ============================================================
// KULTURA — Importar: HTML y cableado de ImportClient (caracterización, C12).
//
// Fija el marcado (textos, clases, orden, ids, aria) de cada fase (elegir
// archivo, leyendo, error, vista previa, importando, en pausa, terminado) y
// qué se llama en cada paso (lectura, `runImport`, avance guardado, informe,
// foco, cancelación), para partir el componente sin cambiar nada. La lectura
// y la importación están simuladas: así se recorren todas las ramas sin red.
//
// Los snapshots fijan el marcado de la refactorización de C12 (partir
// ImportClient sin cambiar lo que se ve). Regenerarlos con `-u` solo si el
// cambio de marcado es deliberado; si no, el fallo es una regresión.
// ============================================================

import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  ImportItem,
  ImportItemResult,
  ParsedImport,
  ImportWarning,
} from '@/lib/import/types'
import type { RunEnd, RunOptions, RunProgress } from '@/lib/import/run'

vi.mock('@/lib/import/i18n', () => ({
  useImportT: () => (key: string, values?: Record<string, unknown>) =>
    `${key}${values ? `(${Object.entries(values).map(([k, v]) => `${k}=${String(v)}`).join(',')})` : ''}`,
}))
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const parseImportFiles = vi.fn()
vi.mock('@/lib/import/parse-file', async (orig) => ({
  ...(await orig<typeof import('@/lib/import/parse-file')>()),
  parseImportFiles: (...args: unknown[]) => parseImportFiles(...args),
}))

const runImport = vi.fn<(opts: RunOptions) => Promise<RunEnd>>()
vi.mock('@/lib/import/run', async (orig) => ({
  ...(await orig<typeof import('@/lib/import/run')>()),
  runImport: (opts: RunOptions) => runImport(opts),
}))

const sendImportBatch = vi.fn()
vi.mock('@/lib/account/client', () => ({ sendImportBatch: (...a: unknown[]) => sendImportBatch(...a) }))

const loadProgress = vi.fn<(userId: string, fp: string) => Map<string, ImportItemResult> | null>()
const saveProgress = vi.fn()
const clearProgress = vi.fn()
vi.mock('@/lib/import/import-storage', () => ({
  loadProgress: (u: string, fp: string) => loadProgress(u, fp),
  saveProgress: (...a: unknown[]) => saveProgress(...a),
  clearProgress: (...a: unknown[]) => clearProgress(...a),
}))

const buildReportCsv = vi.fn((..._a: unknown[]) => 'csv-body')
vi.mock('@/lib/import/report', () => ({ buildReportCsv: (...a: unknown[]) => buildReportCsv(...a) }))

import { ImportClient } from '@/app/[locale]/(app)/settings/import/ImportClient'
import { ImportParseError } from '@/lib/import/types'
import { MAX_FILE_BYTES } from '@/lib/import/limits'

function item(n: number, over: Partial<ImportItem> = {}): ImportItem {
  return { key: `k${n}`, kind: 'movie', title: `Título ${n}`, year: 2000 + n, status: 'completed', rating10: null, watchedAt: null, ...over }
}

const ITEMS: ImportItem[] = [
  item(1, { rating10: 8, logs: [{ watchedOn: '2024-01-01', rewatch: false, rating10: null, review: null, spoiler: false }] }),
  item(2, { status: 'in_progress', kind: 'tv' }),
  item(3, { status: 'pending', year: undefined }),
  item(4, { status: 'abandoned', title: 'Un título larguísimo que pasa de cuarenta caracteres sin duda' }),
]

function parsed(over: Partial<ParsedImport> = {}): ParsedImport {
  return { source: 'letterboxd', items: ITEMS, warnings: [], files: ['export/ratings.csv', 'watched.csv'], ...over }
}

const ALL_WARNINGS: ImportWarning[] = [
  { code: 'skipped_rows', count: 3 },
  { code: 'truncated', count: 12000, max: 10000 },
  { code: 'ambiguous_list' },
  { code: 'no_known_files' },
]

function file(name = 'ratings.csv', size?: number) {
  const f = new File(['x'], name, { type: 'text/csv' })
  if (size !== undefined) Object.defineProperty(f, 'size', { value: size })
  return f
}

function pick(container: HTMLElement, files: File[]) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files } })
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

function progress(over: Partial<RunProgress> = {}): RunProgress {
  return {
    processed: 2,
    total: 4,
    counts: { added: 0, updated: 0, kept: 0, unmatched: 0, excluded: 0, pending: 0, invalid: 0 },
    diaryImported: 0,
    phase: 'running',
    ...over,
  }
}

function results(entries: Array<[string, ImportItemResult['outcome']]>) {
  return new Map(entries.map(([key, outcome]) => [key, { key, outcome }]))
}

beforeEach(() => {
  parseImportFiles.mockReset()
  runImport.mockReset()
  loadProgress.mockReset().mockReturnValue(null)
  saveProgress.mockReset()
  clearProgress.mockReset()
  buildReportCsv.mockClear()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})

async function toPreview(ui = <ImportClient locale="es" userId="user-a" />, p: ParsedImport = parsed()) {
  parseImportFiles.mockResolvedValue(p)
  const r = render(ui)
  pick(r.container, [file()])
  await screen.findByRole('heading', { level: 2, name: /^previewTitle/ })
  return r
}

describe('ImportClient: marcado de cada fase', () => {
  it('demo', () => {
    const { container } = render(<ImportClient locale="es" userId="user-a" isDemo />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('elegir archivo (completo y compacto, en inglés)', () => {
    const full = render(<ImportClient locale="en" userId="user-a" />)
    expect(full.container.innerHTML).toMatchSnapshot()
    full.unmount()
    const compact = render(<ImportClient locale="es" userId="user-a" compact />)
    expect(compact.container.innerHTML).toMatchSnapshot()
  })

  it('arrastrando encima y al salir', () => {
    const { container } = render(<ImportClient locale="es" userId="user-a" />)
    const zone = screen.getByRole('region', { name: 'dropZoneLabel' })
    fireEvent.dragOver(zone)
    expect(zone.className).toMatchSnapshot()
    fireEvent.dragLeave(zone)
    expect(zone.className).toMatchSnapshot()
    expect(container.querySelector('section')).toBe(zone)
  })

  it('leyendo', async () => {
    const d = deferred<ParsedImport>()
    parseImportFiles.mockReturnValue(d.promise)
    const { container } = render(<ImportClient locale="es" userId="user-a" />)
    pick(container, [file()])
    await waitFor(() => expect(parseImportFiles).toHaveBeenCalled())
    expect(container.innerHTML).toMatchSnapshot()
    await act(async () => d.resolve(parsed()))
  })

  it('errores de lectura: demasiado grande, código conocido y error cualquiera', async () => {
    const { container } = render(<ImportClient locale="es" userId="user-a" />)
    pick(container, [file('a.csv', MAX_FILE_BYTES), file('b.csv', 1)])
    expect(await screen.findByRole('alert')).toHaveTextContent('parseErrors.too_large(mb=10)')
    expect(parseImportFiles).not.toHaveBeenCalled()
    expect(container.innerHTML).toMatchSnapshot()

    parseImportFiles.mockRejectedValueOnce(new ImportParseError('unknown_format'))
    pick(container, [file()])
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('parseErrors.unknown_format(mb=10)'))

    parseImportFiles.mockRejectedValueOnce(new Error('boom'))
    pick(container, [file()])
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('parseErrors.corrupt(mb=10)'))
  })

  it('lista vacía: no lee nada y sigue en elegir archivo', async () => {
    const { container } = render(<ImportClient locale="es" userId="user-a" />)
    pick(container, [])
    expect(parseImportFiles).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('soltar archivos lee lo soltado', async () => {
    parseImportFiles.mockResolvedValue(parsed())
    render(<ImportClient locale="es" userId="user-a" />)
    const zone = screen.getByRole('region', { name: 'dropZoneLabel' })
    fireEvent.drop(zone, { dataTransfer: { files: [file('drop.csv')] } })
    await screen.findByRole('heading', { name: /^previewTitle/ })
    expect(parseImportFiles.mock.calls[0][0][0].name).toBe('drop.csv')
    expect(parseImportFiles.mock.calls[0][1]).toEqual({ letterboxd: { ambiguousAs: 'watched' } })
  })

  it('vista previa sencilla', async () => {
    const { container } = await toPreview()
    expect(loadProgress).toHaveBeenCalledWith('user-a', expect.any(String))
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('vista previa con todos los avisos, lista ambigua y avance anterior', async () => {
    loadProgress.mockReturnValue(results([['k1', 'added'], ['k2', 'pending'], ['k3', 'kept']]))
    const { container } = await toPreview(<ImportClient locale="es" userId="user-a" />, parsed({ warnings: ALL_WARNINGS }))
    expect(container.innerHTML).toMatchSnapshot()

    // Cambiar «vistas / pendientes» vuelve a leer los mismos archivos con la opción nueva.
    parseImportFiles.mockClear()
    fireEvent.click(screen.getByRole('radio', { name: 'ambiguousWatchlist' }))
    await waitFor(() => expect(parseImportFiles).toHaveBeenCalledTimes(1))
    expect(parseImportFiles.mock.calls[0][1]).toEqual({ letterboxd: { ambiguousAs: 'watchlist' } })
    await screen.findByRole('heading', { name: /^previewTitle/ })
    expect(screen.getByRole('radio', { name: 'ambiguousWatchlist' })).toBeChecked()

    // «Empezar de cero» borra el avance de la cuenta.
    fireEvent.click(screen.getByRole('button', { name: 'startOver' }))
    expect(clearProgress).toHaveBeenCalledWith('user-a')
    expect(screen.queryByText(/^resumeNote/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'startOver' })).toBeNull()
  })

  it('«Importar otro» desde la vista previa vuelve a elegir archivo', async () => {
    const { container } = await toPreview()
    fireEvent.click(screen.getByRole('button', { name: 'another' }))
    expect(screen.getByRole('button', { name: 'chooseFile' })).toBeInTheDocument()
    expect((container.querySelector('input[type="file"]') as HTMLInputElement).value).toBe('')
  })
})

describe('ImportClient: importar', () => {
  it('progreso, reintento, espera, pausa y reanudar', async () => {
    const previous = results([['k1', 'added']])
    loadProgress.mockReturnValue(previous)
    const { container } = await toPreview()
    const run = deferred<RunEnd>()
    runImport.mockReturnValueOnce(run.promise)
    fireEvent.click(screen.getByRole('button', { name: 'start(count=4)' }))

    expect(runImport).toHaveBeenCalledTimes(1)
    const opts = runImport.mock.calls[0][0]
    expect(opts.source).toBe('letterboxd')
    expect(opts.items).toBe(ITEMS)
    expect(opts.previous).toBe(previous)
    expect(opts.signal?.aborted).toBe(false)
    opts.send({ source: 'letterboxd', items: [] })
    expect(sendImportBatch).toHaveBeenCalled()
    expect(container.innerHTML).toMatchSnapshot()

    act(() => opts.onProgress?.(progress({ processed: 3, diaryImported: 2 })))
    act(() => opts.onBatch?.(results([['k1', 'added'], ['k2', 'unmatched'], ['k3', 'pending']])))
    expect(saveProgress).toHaveBeenLastCalledWith('user-a', expect.any(String), 'letterboxd', expect.any(Map))
    expect(container.innerHTML).toMatchSnapshot()
    act(() => opts.onProgress?.(progress({ phase: 'retrying' })))
    expect(screen.getByRole('status')).toHaveTextContent('retrying')
    act(() => opts.onProgress?.(progress({ phase: 'waiting' })))
    expect(screen.getByRole('status')).toHaveTextContent('waiting')

    fireEvent.click(screen.getByRole('button', { name: 'pause' }))
    expect(opts.signal?.aborted).toBe(true)
    const halfway = results([['k1', 'added'], ['k2', 'unmatched']])
    await act(async () => run.resolve({ status: 'aborted', results: halfway, diaryImported: 0 }))
    expect(saveProgress).toHaveBeenLastCalledWith('user-a', expect.any(String), 'letterboxd', halfway)
    expect(container.innerHTML).toMatchSnapshot()

    runImport.mockResolvedValueOnce({ status: 'done', results: results([['k1', 'added']]), diaryImported: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'resume' }))
    expect(runImport).toHaveBeenCalledTimes(2)
    expect(runImport.mock.calls[1][0].previous).toEqual(halfway)
    await screen.findByRole('heading', { name: 'doneTitle' })
  })

  it.each(['auth', 'demo', 'server', 'network'] as const)('error %s al importar', async (error) => {
    const { container } = await toPreview()
    runImport.mockResolvedValueOnce({ status: 'error', error, results: results([['k1', 'added']]), diaryImported: 0 })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'start(count=4)' })))
    expect(screen.getByRole('status')).toHaveTextContent(`runErrors.${error}`)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('terminado: resumen, foco, no emparejados, informe y otra vez', async () => {
    const onFinished = vi.fn()
    const many = Array.from({ length: 25 }, (_, i) => item(10 + i, { kind: i % 2 ? 'book' : 'movie', title: i === 0 ? 'Película & «rara»' : `Sin pareja ${i}` }))
    const p = parsed({ items: [...ITEMS, ...many] })
    const { container } = await toPreview(<ImportClient locale="es" userId="user-a" onFinished={onFinished} />, p)
    const end = new Map<string, ImportItemResult>([
      ['k1', { key: 'k1', outcome: 'added' }],
      ['k2', { key: 'k2', outcome: 'updated' }],
      ['k3', { key: 'k3', outcome: 'kept' }],
      ['k4', { key: 'k4', outcome: 'pending' }],
      ...many.map((m) => [m.key, { key: m.key, outcome: 'unmatched' as const }] as [string, ImportItemResult]),
    ])
    runImport.mockImplementationOnce(async (opts) => {
      opts.onProgress?.(progress({ diaryImported: 5 }))
      return { status: 'done', results: end, diaryImported: 5 }
    })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'start(count=29)' })))

    const heading = screen.getByRole('heading', { name: 'doneTitle' })
    expect(document.activeElement).toBe(heading)
    expect(onFinished).toHaveBeenCalledWith(3)
    expect(container.innerHTML).toMatchSnapshot()

    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'downloadReport' }))
    expect(buildReportCsv).toHaveBeenCalledTimes(1)
    const [items, res, labels, origin, locale] = buildReportCsv.mock.calls[0]
    expect(items).toBe(p.items)
    expect(res).toEqual(end)
    expect(labels).toMatchSnapshot()
    expect(origin).toBe(window.location.origin)
    expect(locale).toBe('es')
    const a = click.mock.contexts[0] as HTMLAnchorElement
    expect(a.download).toMatch(/^report\.fileName-letterboxd-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(a.href).toBe('blob:x')
    expect(a.isConnected).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')
    click.mockRestore()

    // Reintentar las pendientes vuelve a importar desde lo que hay.
    runImport.mockResolvedValueOnce({ status: 'done', results: end, diaryImported: 0 })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'retryPending' })))
    expect(runImport.mock.calls[1][0].previous).toEqual(end)

    fireEvent.click(screen.getByRole('button', { name: 'another' }))
    expect(screen.getByRole('button', { name: 'chooseFile' })).toBeInTheDocument()
  })

  it('terminado en compacto: sin enlace a la biblioteca ni diario', async () => {
    const { container } = await toPreview(<ImportClient locale="en" userId="user-a" compact />)
    runImport.mockResolvedValueOnce({ status: 'done', results: results([['k1', 'added']]), diaryImported: 0 })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'start(count=4)' })))
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('al desmontar a medias se para el lote siguiente', async () => {
    const r = await toPreview()
    runImport.mockReturnValueOnce(new Promise(() => {}))
    fireEvent.click(screen.getByRole('button', { name: 'start(count=4)' }))
    const signal = runImport.mock.calls[0][0].signal!
    r.unmount()
    expect(signal.aborted).toBe(true)
  })
})
