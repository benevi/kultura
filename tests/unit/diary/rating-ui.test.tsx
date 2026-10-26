// ============================================================
// F-24 · Interfaz: medias estrellas accesibles, /10, diálogo con diario,
// sello de «Visto» y Biblioteca con diario/favoritos.
// ============================================================

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DiaryConfig, LibraryEntry } from '@/types/library'

vi.mock('next-intl', () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key
  t.has = () => true
  return { useTranslations: () => t, useLocale: () => 'es' }
})

const mockShow = vi.fn()
const mockShowError = vi.fn()
vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: mockShow, showError: mockShowError, dismiss: vi.fn() }),
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ push: mockPush }),
}))
const mockPush = vi.fn()
let search = new URLSearchParams()
vi.mock('next/navigation', () => ({ useSearchParams: () => search }))
vi.mock('@/components/media/MediaGrid', () => ({
  MediaGrid: ({ items }: { items: unknown[] }) => <div data-testid="grid">{items.length}</div>,
}))
vi.mock('@/components/media/PosterImage', () => ({ PosterImage: () => null }))

const mockSave = vi.fn()
const mockFetchDiary = vi.fn()
const mockDeleteLog = vi.fn()
const mockSaveScale = vi.fn()
vi.mock('@/lib/library/actions', () => ({
  saveLibraryEntry: (...a: unknown[]) => mockSave(...a),
  removeFromLibrary: vi.fn(),
  fetchDiaryConfig: (...a: unknown[]) => mockFetchDiary(...a),
  deleteDiaryLog: (...a: unknown[]) => mockDeleteLog(...a),
  saveRatingScale: (...a: unknown[]) => mockSaveScale(...a),
}))

import { StarRating } from '@/components/ui/StarRating'
import { LibraryStatusModal } from '@/components/library/LibraryStatusModal'
import { LibraryAction, __resetDiaryCache } from '@/components/library/LibraryAction'
import { DiaryList } from '@/components/library/DiaryList'
import { LibraryClient } from '@/app/[locale]/(app)/library/LibraryClient'

const ENTRY: LibraryEntry = {
  id: 'e1', userId: 'u', mediaId: 'movie_550', status: 'completed', score: 4, rating10: 7.5, favorite: false,
  watchedAt: '2026-10-01', episodeProgress: null, createdAt: '2026-10-01',
}
const LOG = {
  id: '11111111-1111-4111-8111-111111111111', mediaId: 'movie_550', watchedOn: '2026-10-20', rewatch: true,
  rating10: 9, review: 'El final cambia todo', spoiler: true, privateNote: 'Con Bea', createdAt: 'x',
  title: 'Fight Club', year: 1999,
}
const ON = (scale: 'stars' | 'ten', logs = [] as DiaryConfig['logs']): DiaryConfig => ({ enabled: true, scale, logs })
const modalProps = { mediaType: 'movie', onClose: vi.fn(), loading: false }
const submit = () => fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

beforeEach(() => {
  vi.clearAllMocks()
  __resetDiaryCache()
  search = new URLSearchParams()
})

describe('textos REALES del diario (messages/*.json, sin simular)', () => {
  async function translator(locale: 'es' | 'en') {
    const { createTranslator } = await vi.importActual<typeof import('next-intl')>('next-intl')
    const messages = (await import(`../../../messages/${locale}.json`)).default
    return createTranslator({ locale, messages, namespace: 'diary' })
  }

  it('la nota sobre 10 sale con el separador decimal del idioma', async () => {
    expect((await translator('es'))('ratingOfTen', { value: 7.5 })).toBe('7,5 de 10')
    expect((await translator('en'))('ratingOfTen', { value: 7.5 })).toBe('7.5 out of 10')
  })

  it('el contador de la reseña agrupa miles según el idioma', async () => {
    expect((await translator('es'))('chars', { count: 12, max: 5000 })).toBe('12 / 5000')
    expect((await translator('en'))('chars', { count: 12, max: 5000 })).toBe('12 / 5,000')
  })

  it('borrar un apunte nombra el título', async () => {
    const es = await translator('es')
    // La escala se elige en Ajustes desde F-28 (`settings.ratingScale*`):
    // las claves del diario quedaron sin uso y se borraron (TXT-8).
    expect(es('deleteLog', { title: 'Fight Club', date: '20 oct 2026' })).toBe('Borrar el apunte de «Fight Club» del 20 oct 2026')
    expect(es('deleted', { title: 'Fight Club' })).toBe('Apunte de «Fight Club» borrado')
  })
})

describe('StarRating en medias estrellas', () => {
  it('10 radios "0,5 … 5 estrellas", una sola parada de Tab y nombre del grupo', () => {
    render(<StarRating value={3.5} onChange={vi.fn()} step={0.5} label="Puntuación" />)
    const group = screen.getByRole('radiogroup', { name: 'Puntuación' })
    const radios = within(group).getAllByRole('radio')
    expect(radios).toHaveLength(10)
    expect(radios[0]).toHaveAccessibleName('stars:{"count":0.5}')
    expect(radios[6]).toHaveAccessibleName('stars:{"count":3.5}')
    expect(radios[6]).toHaveAttribute('aria-checked', 'true')
    expect(radios.map((r) => r.getAttribute('tabindex')).filter((x) => x === '0')).toHaveLength(1)
  })

  it('→ sube media estrella y ← baja; clic en la mitad izquierda da x,5', () => {
    const onChange = vi.fn()
    render(<StarRating value={3.5} onChange={onChange} step={0.5} />)
    const radios = screen.getAllByRole('radio')
    fireEvent.keyDown(radios[6], { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(4)
    fireEvent.keyDown(radios[6], { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(3)
    fireEvent.click(radios[8])
    expect(onChange).toHaveBeenLastCalledWith(4.5)
  })

  it('cada mitad mide al menos 24 px de ancho (estrella de 48 px) y tiene foco visible', () => {
    render(<StarRating value={0} onChange={vi.fn()} step={0.5} size="lg" />)
    const star = document.querySelector('[data-star="1"]')!
    expect(star.className).toContain('p-3') // 12 + 24 + 12 = 48 px
    const half = screen.getAllByRole('radio')[0]
    expect(half.className).toContain('w-1/2')
    expect(half.className).toContain('focus-visible:outline-focus-ring')
  })

  it('solo lectura con media estrella: "3,5 de 5"', () => {
    render(<StarRating value={3.5} />)
    expect(screen.getByRole('img')).toHaveAccessibleName('ratingOf:{"value":3.5,"max":5}')
  })

  it('las estrellas enteras de siempre no cambian (5 radios)', () => {
    render(<StarRating value={2} onChange={vi.fn()} label="Puntuación" />)
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })
})

describe('LibraryStatusModal con el diario', () => {
  it('sin diario: estrellas enteras, sin favorito ni diario', () => {
    render(<LibraryStatusModal {...modalProps} current={ENTRY} onSave={vi.fn()} />)
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.queryByText('favorite')).toBeNull()
    expect(screen.queryByText('addToDiary')).toBeNull()
  })

  it('½★: medias estrellas; guardar sin tocar la nota conserva 7,5 (no se pierde precisión)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<LibraryStatusModal {...modalProps} current={ENTRY} onSave={onSave} diary={ON('stars')} />)
    expect(screen.getAllByRole('radio')).toHaveLength(10)
    submit()
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({ rating10: 7.5, score: 4, favorite: false })
    // Ya estaba completado: no se apunta otra vez en el diario por editar.
    expect(onSave.mock.calls[0][0].log).toBeUndefined()
  })

  it('½★: 4,5 estrellas → rating10 9 (y score 5)', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<LibraryStatusModal {...modalProps} current={null} onSave={onSave} diary={ON('stars')} />)
    fireEvent.click(screen.getAllByRole('radio')[8])
    submit()
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({ rating10: 9, score: 5 })
  })

  it('/10: deslizador de 0,5 a 10 con texto "7,5 de 10" y "Quitar nota"', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<LibraryStatusModal {...modalProps} current={ENTRY} onSave={onSave} diary={ON('ten')} />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('min', '0.5')
    expect(slider).toHaveAttribute('max', '10')
    expect(slider).toHaveAttribute('step', '0.5')
    expect(slider).toHaveAttribute('aria-valuetext', 'ratingOfTen:{"value":7.5}')
    fireEvent.change(slider, { target: { value: '8.5' } })
    expect(slider).toHaveAttribute('aria-valuetext', 'ratingOfTen:{"value":8.5}')
    fireEvent.click(screen.getByRole('button', { name: 'clearRating' }))
    expect(slider).toHaveAttribute('aria-valuetext', 'notRated')
    submit()
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({ rating10: null, score: null })
  })

  it('al marcarlo como completado propone el apunte: fecha, revisionado, reseña con spoiler y nota personal', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <LibraryStatusModal
        {...modalProps}
        current={{ ...ENTRY, status: 'in_progress' }}
        onSave={onSave}
        diary={ON('stars', [LOG])}
      />
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'completed' } })
    expect(screen.getByRole('checkbox', { name: /addToDiary/ })).toBeChecked()
    // Ya hay un apunte anterior: se propone como revisionado.
    expect(screen.getByRole('checkbox', { name: /rewatch/ })).toBeChecked()
    const spoiler = screen.getByRole('checkbox', { name: 'spoiler' })
    expect(spoiler).toBeDisabled() // sin reseña no hay spoiler
    fireEvent.change(screen.getByLabelText('review'), { target: { value: 'Mejor la segunda vez' } })
    fireEvent.click(spoiler)
    fireEvent.change(screen.getByLabelText('privateNote'), { target: { value: 'En el cine' } })
    fireEvent.change(screen.getByLabelText('watchedAt'), { target: { value: '2026-10-24' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'favorite' }))
    submit()
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0]).toMatchObject({
      status: 'completed',
      favorite: true,
      watchedAt: '2026-10-24',
      log: { watchedOn: '2026-10-24', rewatch: true, review: 'Mejor la segunda vez', spoiler: true, privateNote: 'En el cine' },
    })
  })

  it('lista los apuntes anteriores (spoiler oculto) y los borra', async () => {
    const onDeleteLog = vi.fn().mockResolvedValue(undefined)
    render(
      <LibraryStatusModal {...modalProps} current={ENTRY} onSave={vi.fn()} diary={ON('ten', [LOG])} onDeleteLog={onDeleteLog} title="Fight Club" />
    )
    expect(screen.getByText('spoilerHidden')).toBeInTheDocument()
    expect(screen.queryByText('El final cambia todo')).toBeNull()
    const del = screen.getByRole('button', { name: /^deleteLog/ })
    expect(del.getAttribute('aria-label')).toContain('"title":"Fight Club"')
    fireEvent.click(del)
    await waitFor(() => expect(onDeleteLog).toHaveBeenCalledWith(LOG.id))
  })

  it('si borrar falla, lo dice dentro del diálogo', async () => {
    const onDeleteLog = vi.fn().mockRejectedValue(new Error('x'))
    render(
      <LibraryStatusModal {...modalProps} current={ENTRY} onSave={vi.fn()} diary={ON('ten', [LOG])} onDeleteLog={onDeleteLog} />
    )
    fireEvent.click(screen.getByRole('button', { name: /^deleteLog/ }))
    await waitFor(() =>
      expect(screen.getAllByRole('alert').some((a) => a.textContent === 'deleteFailed')).toBe(true)
    )
  })
})

describe('LibraryAction con el diario', () => {
  const props = {
    mediaId: 'movie_550',
    mediaCache: { externalId: '550', type: 'movie', title: 'Fight Club' },
    isAuthenticated: true,
  }

  it('pide la escala al abrir y muestra medias estrellas', async () => {
    mockFetchDiary.mockResolvedValue(ON('stars'))
    render(<LibraryAction {...props} initialEntry={null} />)
    fireEvent.click(screen.getByText(/addToLibrary/))
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(10))
    expect(mockFetchDiary).toHaveBeenCalledWith('movie_550')
  })

  it('una sola petición por título aunque se pase el ratón y se abra', async () => {
    mockFetchDiary.mockResolvedValue(ON('stars'))
    render(<LibraryAction {...props} initialEntry={null} />)
    const button = screen.getByText(/addToLibrary/).closest('button')!
    fireEvent.pointerEnter(button)
    fireEvent.focus(button)
    fireEvent.click(button)
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(10))
    expect(mockFetchDiary).toHaveBeenCalledTimes(1)
  })

  it('si la escala no llega, el diálogo de siempre', async () => {
    mockFetchDiary.mockRejectedValue(new Error('500'))
    render(<LibraryAction {...props} initialEntry={null} />)
    fireEvent.click(screen.getByText(/addToLibrary/))
    await waitFor(() => expect(mockFetchDiary).toHaveBeenCalled())
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })

  it('apunte guardado → aviso "biblioteca y diario"; apunte fallido → aviso de error', async () => {
    mockFetchDiary.mockResolvedValue(ON('stars'))
    mockSave.mockResolvedValueOnce({ entry: ENTRY, log: LOG, logFailed: false })
    const { unmount } = render(<LibraryAction {...props} initialEntry={null} />)
    fireEvent.click(screen.getByText(/addToLibrary/))
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(10))
    submit()
    await waitFor(() => expect(mockShow).toHaveBeenCalledWith({ message: 'savedWithLog', type: 'success' }))
    unmount()

    __resetDiaryCache()
    mockSave.mockResolvedValueOnce({ entry: ENTRY, log: null, logFailed: true })
    render(<LibraryAction {...props} initialEntry={null} />)
    fireEvent.click(screen.getByText(/addToLibrary/))
    submit()
    await waitFor(() => expect(mockShowError).toHaveBeenCalledWith('logFailed'))
  })

  describe('sello de «Visto» (DIS-14)', () => {
    let animate: ReturnType<typeof vi.fn>
    beforeEach(() => {
      animate = vi.fn(() => ({ cancel: vi.fn() }))
      ;(Element.prototype as unknown as { animate: unknown }).animate = animate
    })
    afterEach(() => {
      delete (Element.prototype as unknown as { animate?: unknown }).animate
      vi.unstubAllGlobals()
    })

    it('al marcarlo como completado, pegatina ≤ 300 ms con solo transform/opacity y en posición absoluta', async () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
      mockFetchDiary.mockResolvedValue(ON('stars'))
      mockSave.mockResolvedValueOnce({ entry: ENTRY, log: null, logFailed: false })
      render(<LibraryAction {...props} initialEntry={null} />)
      fireEvent.click(screen.getByText(/addToLibrary/))
      submit()
      const stamp = await screen.findByTestId('library-stamp')
      expect(stamp).toHaveAttribute('aria-hidden', 'true')
      expect(stamp.className).toContain('absolute') // no ocupa sitio: CLS 0
      const call = animate.mock.calls.find((c) => c[0]?.[0]?.transform?.includes('rotate(-8deg)'))!
      expect(call).toBeDefined()
      expect(call[1].duration).toBeLessThanOrEqual(300)
      for (const frame of call[0] as Record<string, unknown>[]) {
        expect(Object.keys(frame).every((k) => k === 'transform' || k === 'opacity')).toBe(true)
      }
    })

    it('con movimiento reducido no hay pegatina ni animación', async () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
      mockFetchDiary.mockResolvedValue(ON('stars'))
      mockSave.mockResolvedValueOnce({ entry: ENTRY, log: null, logFailed: false })
      render(<LibraryAction {...props} initialEntry={null} />)
      fireEvent.click(screen.getByText(/addToLibrary/))
      submit()
      await waitFor(() => expect(mockShow).toHaveBeenCalled())
      expect(screen.queryByTestId('library-stamp')).toBeNull()
      expect(animate).not.toHaveBeenCalled()
    })

    it('estrellas en cascada: 40 ms entre una y otra, total ≤ 300 ms', () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
      render(<StarRating value={0} onChange={vi.fn()} />)
      fireEvent.click(screen.getAllByRole('radio')[4])
      expect(animate).toHaveBeenCalledTimes(5)
      const delays = animate.mock.calls.map((c) => c[1].delay)
      expect(delays).toEqual([0, 40, 80, 120, 160])
      for (const c of animate.mock.calls) expect(c[1].delay + c[1].duration).toBeLessThanOrEqual(300)
    })
  })
})

describe('Biblioteca con el diario', () => {
  const entries: LibraryEntry[] = [
    { ...ENTRY, id: 'a', mediaId: 'movie_1', favorite: true },
    { ...ENTRY, id: 'b', mediaId: 'movie_2', favorite: false },
  ]

  it('sin diario: ni vistas, ni escala, ni favoritos', () => {
    render(<LibraryClient entries={entries} />)
    expect(screen.queryByRole('radiogroup', { name: 'view' })).toBeNull()
    expect(screen.queryByText('favorites')).toBeNull()
  })

  it('con diario: vista Colección/Diario y filtro de favoritos', () => {
    search = new URLSearchParams('fav=1')
    render(<LibraryClient entries={entries} diary={{ logs: [], scale: 'stars' }} />)
    expect(screen.getByRole('radiogroup', { name: 'view' })).toBeInTheDocument()
    expect(screen.getByTestId('grid')).toHaveTextContent('1')
  })

  // F-28: la escala ½★ o /10 se elige en Ajustes (tests/unit/calendar-email/settings-form.test.tsx);
  // en la Biblioteca solo queda lo imprescindible.
  it('la escala de notas ya no está en la Biblioteca (pasó a Ajustes)', () => {
    render(<LibraryClient entries={entries} diary={{ logs: [], scale: 'stars' }} />)
    expect(screen.queryByRole('radiogroup', { name: 'scaleLabel' })).toBeNull()
    expect(mockSaveScale).not.toHaveBeenCalled()
  })

  it('?view=diary enseña el diario', () => {
    search = new URLSearchParams('view=diary')
    render(<LibraryClient entries={entries} diary={{ logs: [LOG], scale: 'ten' }} />)
    expect(screen.getByRole('region', { name: 'listLabel' })).toBeInTheDocument()
    expect(screen.getByText('9/10')).toBeInTheDocument()
  })
})

describe('DiaryList', () => {
  it('agrupa por mes, oculta spoilers hasta pulsar y borra', async () => {
    mockDeleteLog.mockResolvedValue(undefined)
    render(<DiaryList logs={[LOG, { ...LOG, id: '22222222-2222-4222-8222-222222222222', watchedOn: '2026-09-02', spoiler: false, review: 'Sin destripes', rewatch: false }]} scale="stars" />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2)
    expect(screen.getAllByText('4,5 ★')).toHaveLength(2)
    expect(screen.queryByText('El final cambia todo')).toBeNull()
    const reveal = screen.getByRole('button', { name: 'showSpoiler' })
    expect(reveal).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(reveal)
    expect(screen.getByText('El final cambia todo')).toBeInTheDocument()
    expect(screen.getByText('Sin destripes')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /^deleteLog/ })[0])
    await waitFor(() => expect(mockDeleteLog).toHaveBeenCalledWith(LOG.id))
    await waitFor(() => expect(screen.queryByText('El final cambia todo')).toBeNull())
    // El aviso nombra la obra.
    expect(mockShow).toHaveBeenCalledWith({ message: 'deleted:{"title":"Fight Club"}', type: 'success' })
  })

  it('vacío → texto de diario vacío', () => {
    render(<DiaryList logs={[]} scale="stars" />)
    expect(screen.getByText('emptyTitle')).toBeInTheDocument()
  })
})
