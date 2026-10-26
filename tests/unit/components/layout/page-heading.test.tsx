import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageHeading } from '@/components/layout/PageHeading'
import { IconLists } from '@/components/icons'

// E-PAGE-HEADING: el canvas encabeza todas las pantallas autenticadas con un
// display de 42px/700 y un emoji decorativo. En el código había nueve tamaños
// distintos para el mismo elemento.

describe('PageHeading', () => {
  it('es un h1, que es lo que nombra la pantalla', () => {
    render(<PageHeading>Tus listas</PageHeading>)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tus listas')
  })

  it('usa el display 40px/700 de la escala (text-4xl)', () => {
    render(<PageHeading>Grupos</PageHeading>)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.className).toContain('font-display')
    expect(h1.className).toContain('md:text-4xl')
    expect(h1.className).toContain('font-bold')
  })

  // El icono es decoración (sustituye al emoji del canvas, VOZ.md): no puede
  // ensuciar el nombre accesible de la pantalla.
  it('el icono va aria-hidden y fuera del texto traducido', () => {
    const { container } = render(<PageHeading icon={IconLists}>Tus listas</PageHeading>)
    const hidden = container.querySelector('svg[aria-hidden="true"]')
    expect(hidden).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Tus listas' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tus listas')
  })

  it('sin icono no pinta nada decorativo', () => {
    const { container } = render(<PageHeading>Ajustes</PageHeading>)
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('la acción primaria va a la derecha del título', () => {
    render(<PageHeading action={<button type="button">+ Nueva lista</button>}>Tus listas</PageHeading>)
    expect(screen.getByRole('button', { name: '+ Nueva lista' })).toBeInTheDocument()
  })
})
