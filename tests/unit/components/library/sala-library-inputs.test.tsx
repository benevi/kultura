// ============================================================
// Fase 8.5 · F2b: piezas del diálogo de biblioteca en «Sala».
// La nota (deslizador en las tres escalas), el progreso con la piel de Sala,
// la paleta que se lleva un diálogo y el sello plano.
// ============================================================

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
  useLocale: () => 'es',
}))

import { SalaRatingInput } from '@/components/library/sala/SalaRatingInput'
import { ProgressInput } from '@/components/library/ProgressInput'
import { paletteFromElement, workPaletteVars } from '@/lib/design/sala-palette'
import { playSalaStamp } from '@/lib/library/motion'
import type { ImagePalette, ThemePalette } from '@/lib/design/image-palette'

describe('SalaRatingInput', () => {
  it('escala de 10: medios puntos, el valor en cifras y su texto para el lector', () => {
    const onChange = vi.fn()
    render(<SalaRatingInput mode="ten" rating10={7.5} onChange={onChange} labelId="l" />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('min', '0.5')
    expect(slider).toHaveAttribute('max', '10')
    expect(slider).toHaveAttribute('step', '0.5')
    expect(slider).toHaveAttribute('aria-valuetext', 'ratingOfTen:{"value":7.5}')
    expect(screen.getByText('7,5')).toBeInTheDocument()
    fireEvent.change(slider, { target: { value: '9' } })
    expect(onChange).toHaveBeenLastCalledWith(9)
  })

  it('estrellas: ½ a 5, guarda en rating10', () => {
    const onChange = vi.fn()
    render(<SalaRatingInput mode="stars" rating10={7} onChange={onChange} labelId="l" />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveValue('3.5')
    fireEvent.change(slider, { target: { value: '4.5' } })
    expect(onChange).toHaveBeenLastCalledWith(9)
  })

  it('escala de siempre: 1-5 enteras; sin nota, «sin puntuar» y sin botón de quitar', () => {
    const onChange = vi.fn()
    render(<SalaRatingInput mode="legacy" rating10={null} onChange={onChange} labelId="l" />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuetext', 'notRated')
    expect(screen.queryByRole('button', { name: 'clearRating' })).toBeNull()
    fireEvent.change(slider, { target: { value: '2' } })
    expect(onChange).toHaveBeenLastCalledWith(4)
  })

  it('con nota: «Quitar nota» de 48 px la deja en null', () => {
    const onChange = vi.fn()
    render(<SalaRatingInput mode="ten" rating10={6} onChange={onChange} labelId="l" />)
    const clear = screen.getByRole('button', { name: 'clearRating' })
    expect(clear.className).toContain('min-h-sala-target')
    fireEvent.click(clear)
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})

describe('ProgressInput variant="sala"', () => {
  it('mismos campos y lógica; botones −/+ de 48 px y «Limpiar progreso» de Sala', () => {
    const onChange = vi.fn()
    render(<ProgressInput mediaType="book" value={{ page: 120 }} total={400} onChange={onChange} variant="sala" />)
    const plus = screen.getByRole('button', { name: 'increase:{"unit":"page"}' })
    expect(plus.className).toContain('h-sala-target')
    expect(plus.className).toContain('w-sala-target')
    fireEvent.click(plus)
    expect(onChange).toHaveBeenLastCalledWith({ page: 130, total: 400 })
    const clear = screen.getByTestId('clear-progress')
    expect(clear).toHaveTextContent('clearProgress')
    expect(clear.className).toContain('min-h-sala-target')
    // El modo (páginas o %) no se dice solo con color: es un grupo de radios con texto.
    expect(screen.getByRole('radio', { name: 'modePages' })).toBeChecked()
  })

  it('sin variante, la de siempre (sin clases de Sala)', () => {
    const { container } = render(<ProgressInput mediaType="tv" value={{ season: 1, episode: 3 }} onChange={() => {}} />)
    expect(container.innerHTML).not.toContain('sala-')
  })
})

describe('paletteFromElement', () => {
  const theme = (c: string): ThemePalette => ({
    background: c,
    panel: c,
    ink: c,
    inkSecondary: c,
    accent: c,
    accentInk: c,
    band: c,
    bandInk: c,
    border: c,
  })

  it('lee la paleta que dejó workPaletteVars en el contenedor', () => {
    const palette: ImagePalette = { neutral: false, light: theme('#eeeeee'), dark: theme('#111111') }
    const el = document.createElement('div')
    for (const [k, v] of Object.entries(workPaletteVars(palette))) el.style.setProperty(k, v)
    expect(paletteFromElement(el)).toEqual(palette)
  })

  it('sin paleta (o a medias): undefined, los neutros', () => {
    expect(paletteFromElement(null)).toBeUndefined()
    const el = document.createElement('div')
    el.style.setProperty('--sala-work-dark-ink', '#fff')
    expect(paletteFromElement(el)).toBeUndefined()
  })
})

describe('playSalaStamp', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('plano: escala y opacidad, sin giro', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const animate = vi.fn()
    const el = { animate } as unknown as Element
    expect(playSalaStamp(el)).toBe(true)
    const frames = animate.mock.calls[0][0] as Array<{ transform: string }>
    expect(frames.every((f) => !f.transform.includes('rotate'))).toBe(true)
  })

  it('con movimiento reducido no se anima', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const animate = vi.fn()
    expect(playSalaStamp({ animate } as unknown as Element)).toBe(false)
    expect(animate).not.toHaveBeenCalled()
  })
})
