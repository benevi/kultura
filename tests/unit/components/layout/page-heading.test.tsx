import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PageHeading } from '@/components/layout/PageHeading'

// E-PAGE-HEADING: el canvas encabeza todas las pantallas autenticadas con un
// display de 42px/700 y un emoji decorativo. En el código había nueve tamaños
// distintos para el mismo elemento.

describe('PageHeading', () => {
  it('es un h1, que es lo que nombra la pantalla', () => {
    render(<PageHeading>Tus listas</PageHeading>)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tus listas')
  })

  it('usa el display 42px/700 del canvas', () => {
    render(<PageHeading>Grupos</PageHeading>)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.className).toContain('font-display')
    expect(h1.className).toContain('md:text-[42px]')
    expect(h1.className).toContain('font-bold')
  })

  // El emoji es decoración: no puede ensuciar el nombre accesible de la
  // pantalla ni obligar a repetirlo en cada traducción.
  it('el emoji va aria-hidden y fuera del texto traducido', () => {
    const { container } = render(<PageHeading emoji="📋">Tus listas</PageHeading>)
    const hidden = container.querySelector('[aria-hidden="true"]')
    expect(hidden).toHaveTextContent('📋')
    expect(screen.getByRole('heading', { level: 1, name: 'Tus listas' })).toBeInTheDocument()
  })

  it('sin emoji no pinta nada decorativo', () => {
    const { container } = render(<PageHeading>Ajustes</PageHeading>)
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('la acción primaria va a la derecha del título', () => {
    render(<PageHeading action={<button type="button">+ Nueva lista</button>}>Tus listas</PageHeading>)
    expect(screen.getByRole('button', { name: '+ Nueva lista' })).toBeInTheDocument()
  })
})
