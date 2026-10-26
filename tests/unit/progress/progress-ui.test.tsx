// ============================================================
// F-27 · Interfaz del progreso: control por formato accesible (−/+ con
// nombre propio, campo con etiqueta, teclado), «Continúa» con 1 toque y
// actualización optimista que se revierte si falla, propuesta de pasar a
// «Completado» al marcar el final (con diario si F-24 está activo).
// ============================================================

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { renderIntl } from './intl'
import type { ProgressValue } from '@/lib/library/progress'

const mockAdvance = vi.fn()
const mockComplete = vi.fn()
vi.mock('@/lib/library/actions', () => ({
  advanceProgress: (...a: unknown[]) => mockAdvance(...a),
  completeFromProgress: (...a: unknown[]) => mockComplete(...a),
}))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/components/media/PosterImage', () => ({ PosterImage: () => null }))

import { ProgressInput } from '@/components/library/ProgressInput'
import { ContinueProgress } from '@/components/home/ContinueProgress'
import { ContinueRow } from '@/components/home/ContinueRow'

function Controlled(props: { mediaType: string; initial: ProgressValue | null; total?: number | null; referenceHours?: number | null; full?: boolean; spy?: (v: ProgressValue | null) => void }) {
  const [value, setValue] = useState<ProgressValue | null>(props.initial)
  return (
    <ProgressInput
      mediaType={props.mediaType}
      value={value}
      onChange={(v) => {
        props.spy?.(v)
        setValue(v)
      }}
      full={props.full ?? true}
      total={props.total}
      referenceHours={props.referenceHours}
    />
  )
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  mockAdvance.mockReset()
  mockComplete.mockReset()
})

describe('ProgressInput', () => {
  it('libro: páginas con −/+ (de 10 en 10), «de 350» y el % en texto', () => {
    const spy = vi.fn()
    renderIntl(<Controlled mediaType="book" initial={{ page: 120 }} total={350} spy={spy} />)
    const group = screen.getByRole('group', { name: 'Página' })
    expect(within(group).getByText('de 350')).toBeInTheDocument()
    expect(screen.getByText('34 %')).toBeInTheDocument()
    fireEvent.click(within(group).getByRole('button', { name: 'Más páginas' }))
    expect(spy).toHaveBeenLastCalledWith({ page: 130, total: 350 })
    expect(screen.getByRole('spinbutton', { name: 'Página' })).toHaveValue(130)
  })

  it('libro: se cambia a % (convierte lo leído) y se escribe a mano', () => {
    const spy = vi.fn()
    renderIntl(<Controlled mediaType="book" initial={{ page: 175 }} total={350} spy={spy} />)
    fireEvent.click(screen.getByRole('radio', { name: '%' }))
    expect(spy).toHaveBeenLastCalledWith({ percent: 50, total: 350 })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Porcentaje' }), { target: { value: '120' } })
    // Fuera de rango: se ajusta al máximo.
    expect(spy).toHaveBeenLastCalledWith({ percent: 100, total: 350 })
  })

  it('juego: horas de media en media hora y la media de RAWG como referencia', () => {
    const spy = vi.fn()
    renderIntl(<Controlled mediaType="game" initial={{ hours: 12 }} referenceHours={22} spy={spy} />)
    expect(screen.getByText('Media: unas 22 h (RAWG)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Más horas' }))
    expect(spy).toHaveBeenLastCalledWith({ hours: 12.5 })
  })

  it('manga: capítulo y volumen, cada uno con su grupo y botones con nombre', () => {
    renderIntl(<Controlled mediaType="manga" initial={null} total={120} />)
    expect(screen.getByRole('group', { name: 'Capítulo' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Volumen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Un capítulo más' })).toBeEnabled()
    // Sin valor, «menos» no hace nada y está desactivado.
    expect(screen.getByRole('button', { name: 'Un capítulo menos' })).toBeDisabled()
  })

  it('serie: temporada y episodio; «+» desde vacío empieza en el 1', () => {
    const spy = vi.fn()
    renderIntl(<Controlled mediaType="tv" initial={null} total={10} spy={spy} />)
    fireEvent.click(screen.getByRole('button', { name: 'Un episodio más' }))
    expect(spy).toHaveBeenLastCalledWith({ episode: 1, total: 10 })
  })

  it('sin la migración, un libro no tiene control (y una serie sí, como siempre)', () => {
    const { container } = renderIntl(<Controlled mediaType="book" initial={null} full={false} />)
    expect(container).toBeEmptyDOMElement()
    renderIntl(<Controlled mediaType="tv" initial={null} full={false} />)
    expect(screen.getByRole('spinbutton', { name: 'Episodio' })).toBeInTheDocument()
    expect(screen.queryByTestId('progress-summary')).not.toBeInTheDocument()
  })

  it('sin la bandera la temporada empieza en 1, nunca 0 (va al jsonb antiguo)', () => {
    const spy = vi.fn()
    renderIntl(<Controlled mediaType="tv" initial={{ season: 1, episode: 3 }} full={false} spy={spy} />)
    const season = screen.getByRole('spinbutton', { name: 'Temporada' })
    expect(season).toHaveAttribute('min', '1')
    // «−» desde la 1: desactivado.
    expect(screen.getByRole('button', { name: 'Temporada anterior' })).toBeDisabled()
    // Escribir 0 se ajusta a 1.
    fireEvent.change(season, { target: { value: '0' } })
    expect(spy).toHaveBeenLastCalledWith({ season: 1, episode: 3 })
  })

  it('sin la bandera, «+» en una temporada vacía da la 1; con ella se admite la 0 (especiales)', () => {
    const spy = vi.fn()
    renderIntl(<Controlled mediaType="tv" initial={{ episode: 2 }} full={false} spy={spy} />)
    fireEvent.click(screen.getByRole('button', { name: 'Temporada siguiente' }))
    expect(spy).toHaveBeenLastCalledWith({ season: 1, episode: 2 })
    const spy2 = vi.fn()
    renderIntl(<Controlled mediaType="tv" initial={{ season: 1, episode: 2 }} full spy={spy2} />)
    const [, fullSeasonDown] = screen.getAllByRole('button', { name: 'Temporada anterior' })
    fireEvent.click(fullSeasonDown)
    expect(spy2).toHaveBeenLastCalledWith({ season: 0, episode: 2 })
  })

  it('«Limpiar progreso» lo borra', () => {
    const spy = vi.fn()
    renderIntl(<Controlled mediaType="game" initial={{ hours: 3 }} spy={spy} />)
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar progreso' }))
    expect(spy).toHaveBeenLastCalledWith(null)
  })
})

const tvProps = {
  mediaId: 'tv_1399',
  mediaType: 'tv',
  title: 'Juego de tronos',
  status: 'in_progress' as const,
  variant: 'card' as const,
}

describe('Continúa: 1 toque con actualización optimista', () => {
  it('marca el siguiente al instante y luego manda el servidor (cambio de temporada)', async () => {
    const d = deferred<unknown>()
    mockAdvance.mockReturnValueOnce(d.promise)
    renderIntl(<ContinueProgress {...tvProps} progress={{ season: 1, episode: 10, total: 10 }} />)
    expect(screen.getByTestId('progress-label')).toHaveTextContent('T1 · E10 de 10')

    // WCAG 2.5.3: el nombre es el texto visible; el título, en la descripción.
    const next = screen.getByRole('button', { name: '+1 ep.' })
    expect(next).toHaveAccessibleDescription('Marcar el siguiente episodio de «Juego de tronos»')
    fireEvent.click(next)
    // Optimista: sin esperar a la red.
    expect(screen.getByTestId('progress-label')).toHaveTextContent('T1 · E11')
    expect(mockAdvance).toHaveBeenCalledWith('tv_1399')

    await act(async () => {
      d.resolve({ progress: { season: 2, episode: 1, total: 10 }, status: 'in_progress', finished: false, caughtUp: false, diary: false })
    })
    expect(screen.getByTestId('progress-label')).toHaveTextContent('T2 · E1 de 10')
    expect(screen.getByRole('status')).toHaveTextContent('«Juego de tronos»: T2 · E1 de 10')
  })

  it('si falla, vuelve a lo de antes y lo dice (role=alert)', async () => {
    mockAdvance.mockRejectedValueOnce(new Error('Failed to save progress'))
    renderIntl(<ContinueProgress {...tvProps} progress={{ season: 2, episode: 4, total: 10 }} />)
    // El hueco del aviso existe desde el principio, vacío (CLS 0).
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    fireEvent.click(screen.getByTestId('progress-next'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No hemos podido guardar el progreso de «Juego de tronos»'))
    expect(screen.getByTestId('progress-label')).toHaveTextContent('T2 · E4 de 10')
  })

  it('serie al día: se anuncia y no se marca nada', async () => {
    mockAdvance.mockResolvedValueOnce({ progress: { season: 2, episode: 7 }, status: 'in_progress', finished: false, caughtUp: true, diary: false })
    renderIntl(<ContinueProgress {...tvProps} progress={{ season: 2, episode: 7 }} />)
    fireEvent.click(screen.getByTestId('progress-next'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Vas al día con «Juego de tronos»'))
    expect(screen.getByTestId('progress-label')).toHaveTextContent('T2 · E7')
  })

  it('el último episodio propone «Completado» y lo apunta en el diario (F-24 activo)', async () => {
    mockAdvance.mockResolvedValueOnce({ progress: { season: 8, episode: 6, total: 6 }, status: 'in_progress', finished: true, caughtUp: false, diary: true })
    mockComplete.mockResolvedValueOnce({ log: { id: 'l1' }, logFailed: false })
    renderIntl(<ContinueProgress {...tvProps} progress={{ season: 8, episode: 5, total: 6 }} />)
    fireEvent.click(screen.getByTestId('progress-next'))

    const dialog = await screen.findByRole('dialog', { name: '¿Has terminado «Juego de tronos»?' })
    expect(within(dialog).getByText('Has marcado el último episodio. ¿Lo marcamos como visto?')).toBeInTheDocument()
    expect(within(dialog).getByRole('checkbox', { name: 'Apuntarlo en el diario' })).toBeChecked()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, visto' }))

    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith('tv_1399', expect.objectContaining({ log: true })))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('¡Visto!')).toBeInTheDocument()
    expect(screen.queryByTestId('progress-next')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('«Juego de tronos» pasa a Completado y queda en tu diario.')
  })

  it('«Todavía no» lo deja como está; sin diario no hay casilla', async () => {
    mockAdvance.mockResolvedValueOnce({ progress: { episode: 26, total: 26 }, status: 'in_progress', finished: true, caughtUp: false, diary: false })
    renderIntl(<ContinueProgress {...tvProps} mediaId="anime_al-1" mediaType="anime" title="Bebop" progress={{ episode: 25, total: 26 }} />)
    fireEvent.click(screen.getByTestId('progress-next'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Todavía no' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mockComplete).not.toHaveBeenCalled()
    expect(screen.getByTestId('progress-next')).toBeInTheDocument()
  })

  it('libro con % visible y juego con horas (en inglés también)', () => {
    renderIntl(<ContinueProgress {...tvProps} mediaId="book_OL1W" mediaType="book" title="Dune" progress={{ percent: 45 }} />, 'en')
    expect(screen.getByTestId('progress-label')).toHaveTextContent('45% read')
    expect(screen.getByRole('button', { name: '+5%' })).toHaveAccessibleDescription('Add 5% to “Dune”')
    // En % la etiqueta ya lo dice: el porcentaje no se repite al lado.
    expect(screen.getAllByText(/45%/)).toHaveLength(1)
  })

  it('libro con páginas: % hacia abajo (349 de 350 no es un 100 %)', () => {
    renderIntl(<ContinueProgress {...tvProps} mediaId="book_OL1W" mediaType="book" title="Dune" progress={{ page: 349, total: 350 }} />)
    expect(screen.getByText('99 %')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+10 págs.' })).toHaveAccessibleDescription('Sumar 10 páginas a «Dune»')
  })

  it('libro sin progreso: botón neutro «Avanzar» (páginas o % lo decide el servidor)', () => {
    renderIntl(<ContinueProgress {...tvProps} mediaId="book_OL1W" mediaType="book" title="Dune" progress={null} />)
    expect(screen.getByRole('button', { name: 'Avanzar' })).toHaveAccessibleDescription('Avanzar en «Dune»')
  })

  it('juego: «12,5 h de ~22 h» y +1 h', () => {
    renderIntl(<ContinueProgress {...tvProps} mediaId="game_1" mediaType="game" title="Hades" progress={{ hours: 12.5, total: 22 }} />)
    expect(screen.getByTestId('progress-label')).toHaveTextContent('12,5 h de ~22 h')
    expect(screen.getByRole('button', { name: '+1 h' })).toHaveAccessibleDescription('Sumar una hora jugada a «Hades»')
  })
})

describe('ContinueRow', () => {
  it('el botón va fuera del enlace; las películas no tienen botón', () => {
    renderIntl(
      <ContinueRow
        title="Continúa donde lo dejaste"
        fullProgress
        items={[
          { mediaId: 'tv_1399', title: 'Juego de tronos', type: 'tv', status: 'in_progress', progress: { season: 1, episode: 2 } },
          { mediaId: 'movie_550', title: 'El club de la lucha', type: 'movie', status: 'pending', progress: null },
          { mediaId: 'book_OL1W', title: 'Dune', type: 'book', status: 'in_progress', progress: { page: 120, total: 350 } },
        ]}
      />
    )
    const buttons = screen.getAllByTestId('progress-next')
    expect(buttons).toHaveLength(2)
    for (const b of buttons) expect(b.closest('a')).toBeNull()
    expect(screen.getByText('Pág. 120 de 350')).toBeInTheDocument()
  })

  it('sin PROGRESS_V2 solo series y anime llevan botón', () => {
    renderIntl(
      <ContinueRow
        title="Continúa"
        items={[
          { mediaId: 'tv_1399', title: 'Juego de tronos', type: 'tv', status: 'in_progress', progress: null },
          { mediaId: 'book_OL1W', title: 'Dune', type: 'book', status: 'in_progress', progress: null },
        ]}
      />
    )
    expect(screen.getAllByTestId('progress-next')).toHaveLength(1)
  })

  it('vacía no pinta nada', () => {
    const { container } = renderIntl(<ContinueRow title="x" items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
