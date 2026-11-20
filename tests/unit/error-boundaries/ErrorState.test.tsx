/**
 * ErrorState (fase 8.4, C11): el estado de error que comparten los `error.tsx`,
 * sobre `SalaBlockState`. Título como único `h1` con el foco, explicación,
 * «Reintentar» con `reset` y salida a Inicio con recarga completa.
 */
import type { ComponentProps } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => {
    const map: Record<string, string> = {
      'errors.somethingWentWrong': 'Se nos ha escapado un error',
      'errors.unexpectedDescription': 'La página no ha cargado bien.',
      'errors.tryAgain': 'Reintentar',
      'errors.goHome': 'Ir al inicio',
    }
    return map[`${ns}.${key}`] ?? `${ns}.${key}`
  },
  useLocale: () => 'es',
}))

// El Link con idioma de next-intl: aquí, un <a> que pone el prefijo como él.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: ComponentProps<'a'>) => (
    <a href={`/es${href === '/' ? '' : href}`} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/logger', () => ({ loadSentry: () => null }))

import { ErrorState } from '@/components/layout/ErrorState'

afterEach(() => vi.restoreAllMocks())

describe('ErrorState', () => {
  it('pinta el título como único h1 y la explicación', () => {
    render(<ErrorState reset={vi.fn()} />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Se nos ha escapado un error' })).toBeInTheDocument()
    expect(screen.getByText('La página no ha cargado bien.')).toBeInTheDocument()
  })

  it('el título recibe el foco al aparecer, sin aviso doble', () => {
    const { container } = render(<ErrorState reset={vi.fn()} />)
    const titulo = screen.getByRole('heading', { level: 1 })
    expect(titulo).toHaveFocus()
    expect(titulo).toHaveAttribute('tabindex', '-1')
    expect(container.querySelector('[role=alert], [aria-live]')).toBeNull()
  })

  it('es el estado de error de «Sala», con su dibujo oculto a los lectores', () => {
    const { container } = render(<ErrorState reset={vi.fn()} />)
    expect(container.querySelector('[data-sala-block-state=error]')).not.toBeNull()
    expect(container.querySelector('svg[data-sala-tone-icon=error]')?.closest('[aria-hidden=true]')).not.toBeNull()
  })

  it('«Reintentar» llama a reset', () => {
    const reset = vi.fn()
    render(<ErrorState reset={reset} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('la salida lleva a Inicio con el idioma', () => {
    render(<ErrorState reset={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/es/home')
  })

  it('en páginas públicas la salida va a la portada', () => {
    render(<ErrorState reset={vi.fn()} homeHref="/" />)
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/es')
  })

  it('la salida recarga la página entera; con modificador se deja al navegador', () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign })
    render(<ErrorState reset={vi.fn()} />)
    const enlace = screen.getByRole('link', { name: 'Ir al inicio' })

    const conModificador = fireEvent.click(enlace, { ctrlKey: true })
    expect(conModificador).toBe(true)
    expect(assign).not.toHaveBeenCalled()

    const normal = fireEvent.click(enlace)
    expect(normal).toBe(false) // preventDefault: no navega dentro de la app
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/\/es\/home$/))
  })
})
