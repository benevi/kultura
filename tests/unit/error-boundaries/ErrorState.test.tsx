/**
 * ErrorState (fase 8.4, C11): el estado de error que comparten los `error.tsx`,
 * sobre `SalaBlockState`. Título como único `h1` con el foco, explicación,
 * «Reintentar» con `reset` y salida a Inicio (un `<a>`, recarga completa).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

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

vi.mock('next/navigation', () => ({ useParams: () => ({ locale: 'es' }) }))

vi.mock('@/lib/logger', () => ({ loadSentry: () => null }))

import { ErrorState } from '@/components/layout/ErrorState'

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

  it('la salida lleva a Inicio con el idioma, con un <a> que recarga el documento', () => {
    render(<ErrorState reset={vi.fn()} />)
    const enlace = screen.getByRole('link', { name: 'Ir al inicio' })
    expect(enlace).toHaveAttribute('href', '/es/home')
    expect(enlace.tagName).toBe('A')
    expect(enlace).not.toHaveAttribute('target')
  })

  it('en páginas públicas la salida va a la portada', () => {
    render(<ErrorState reset={vi.fn()} homeHref="/" />)
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/es')
  })
})
