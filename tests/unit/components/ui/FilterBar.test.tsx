import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = { all: 'Todos' }
    return map[key] ?? key
  },
}))

import { FilterBar } from '@/components/ui/FilterBar'
import type { FilterGroup } from '@/components/ui/FilterBar'

// Radix Popover usa estas APIs del DOM al abrir el portal; jsdom no las trae.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture)
    Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture)
    Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture)
    Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView)
    Element.prototype.scrollIntoView = () => {}
})

const groups: FilterGroup[] = [
  {
    key: 'type',
    label: 'Tipo',
    options: [
      { value: 'movie', label: 'Películas' },
      { value: 'tv', label: 'Series' },
    ],
  },
  {
    key: 'status',
    label: 'Estado',
    options: [
      { value: 'completed', label: 'Completado' },
      { value: 'pending', label: 'Pendiente' },
    ],
  },
]

describe('FilterBar — single (default, backward-compat)', () => {
  it('renderiza chips para cada opción más el chip Todos implícito', () => {
    render(<FilterBar groups={groups} activeFilters={{}} onChange={vi.fn()} />)
    // type group: Todos + 2 options
    expect(screen.getAllByText('Todos')).toHaveLength(2)
    expect(screen.getByText('Películas')).toBeInTheDocument()
    expect(screen.getByText('Series')).toBeInTheDocument()
    // status group
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('chip Todos activo por defecto cuando activeFilters está vacío', () => {
    render(<FilterBar groups={[groups[0]]} activeFilters={{}} onChange={vi.fn()} />)
    const todosBtn = screen.getByText('Todos')
    expect(todosBtn).toHaveClass('bg-accent-positive')
  })

  it('click en chip inactivo llama onChange con key y value correctos', () => {
    const onChange = vi.fn()
    render(
      <FilterBar groups={[groups[0]]} activeFilters={{ type: 'all' }} onChange={onChange} />
    )
    fireEvent.click(screen.getByText('Películas'))
    expect(onChange).toHaveBeenCalledWith('type', 'movie')
  })

  it('click en chip activo llama onChange con all (deselecciona)', () => {
    const onChange = vi.fn()
    render(
      <FilterBar groups={[groups[0]]} activeFilters={{ type: 'movie' }} onChange={onChange} />
    )
    fireEvent.click(screen.getByText('Películas'))
    expect(onChange).toHaveBeenCalledWith('type', 'all')
  })

  it('chip activo usa estilo activo (bg-accent-positive)', () => {
    render(<FilterBar groups={[groups[0]]} activeFilters={{ type: 'tv' }} onChange={vi.fn()} />)
    expect(screen.getByText('Series')).toHaveClass('bg-accent-positive')
  })

  it('chip inactivo usa estilo inactivo (bg-surface-elevated)', () => {
    render(<FilterBar groups={[groups[0]]} activeFilters={{ type: 'tv' }} onChange={vi.fn()} />)
    expect(screen.getByText('Películas')).toHaveClass('bg-surface-elevated')
  })

  it('grupo sin kind se comporta como single (backward-compat)', () => {
    const onChange = vi.fn()
    render(
      <FilterBar groups={[groups[0]]} activeFilters={{ type: 'all' }} onChange={onChange} />
    )
    // Sin kind: emite string, inyecta "all", toggle-off.
    fireEvent.click(screen.getByText('Películas'))
    expect(onChange).toHaveBeenCalledWith('type', 'movie')
  })
})

describe('FilterBar — multi', () => {
  const multiGroup: FilterGroup = {
    key: 'genre',
    label: 'Género',
    kind: 'multi',
    options: [
      { value: 'action', label: 'Acción' },
      { value: 'drama', label: 'Drama' },
      { value: 'comedy', label: 'Comedia' },
    ],
  }

  it('abrir popover, marcar 2 → onChange recibe array; badge = 2', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <FilterBar groups={[multiGroup]} activeFilters={{ genre: [] }} onChange={onChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Género' }))
    fireEvent.click(screen.getByText('Acción'))
    expect(onChange).toHaveBeenLastCalledWith('genre', ['action'])

    // Simula el padre actualizando value tras el primer cambio.
    rerender(
      <FilterBar groups={[multiGroup]} activeFilters={{ genre: ['action'] }} onChange={onChange} />
    )
    fireEvent.click(screen.getByText('Drama'))
    expect(onChange).toHaveBeenLastCalledWith('genre', ['action', 'drama'])

    rerender(
      <FilterBar
        groups={[multiGroup]}
        activeFilters={{ genre: ['action', 'drama'] }}
        onChange={onChange}
      />
    )
    expect(screen.getByTestId('badge-genre')).toHaveTextContent('2')
  })

  it('trigger activo (array no vacío) usa estilo activo', () => {
    render(
      <FilterBar
        groups={[multiGroup]}
        activeFilters={{ genre: ['action'] }}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Género/ })).toHaveClass('bg-accent-positive')
  })
})

describe('FilterBar — searchable', () => {
  const searchGroup: FilterGroup = {
    key: 'platform',
    label: 'Plataforma',
    kind: 'searchable',
    options: [
      { value: 'netflix', label: 'Netflix' },
      { value: 'hbo', label: 'HBO Max' },
      { value: 'prime', label: 'Prime Video' },
    ],
  }

  it('input filtra las options visibles por label', () => {
    render(
      <FilterBar groups={[searchGroup]} activeFilters={{ platform: [] }} onChange={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Plataforma' }))
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('HBO Max')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'net' } })
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.queryByText('HBO Max')).not.toBeInTheDocument()
    expect(screen.queryByText('Prime Video')).not.toBeInTheDocument()
  })
})

describe('FilterBar — min', () => {
  const minGroup: FilterGroup = {
    key: 'score',
    label: 'Nota',
    kind: 'min',
    options: [
      { value: '6', label: '6+' },
      { value: '7', label: '7+' },
      { value: '8', label: '8+' },
    ],
  }

  it('seleccionar opción → onChange(key, value)', () => {
    const onChange = vi.fn()
    render(
      <FilterBar groups={[minGroup]} activeFilters={{ score: 'all' }} onChange={onChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Nota' }))
    fireEvent.click(screen.getByText('7+'))
    expect(onChange).toHaveBeenCalledWith('score', '7')
  })

  it('con value activo, trigger muestra label "X+" y estilo activo', () => {
    // Popover cerrado: "7+" solo aparece en el trigger.
    render(
      <FilterBar groups={[minGroup]} activeFilters={{ score: '7' }} onChange={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: '7+' })).toHaveClass('bg-accent-positive')
  })
})

describe('FilterBar — menu', () => {
  const menuGroup: FilterGroup = {
    key: 'sort',
    label: 'Ordenar',
    kind: 'menu',
    options: [
      { value: 'popular', label: 'Popularidad' },
      { value: 'recent', label: 'Más reciente' },
    ],
  }

  it('trigger muestra la opción activa; seleccionar → onChange', () => {
    const onChange = vi.fn()
    render(
      <FilterBar groups={[menuGroup]} activeFilters={{ sort: 'popular' }} onChange={onChange} />
    )
    // Trigger etiquetado con la opción activa (no "all").
    const trigger = screen.getByRole('button', { name: 'Popularidad' })
    expect(trigger).toBeInTheDocument()

    fireEvent.click(trigger)
    const content = screen.getByText('Más reciente')
    fireEvent.click(content)
    expect(onChange).toHaveBeenCalledWith('sort', 'recent')
  })

  it('sin valor activo, trigger muestra el label del grupo y NO inyecta "all"', () => {
    render(<FilterBar groups={[menuGroup]} activeFilters={{}} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Ordenar' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar' }))
    expect(screen.queryByText('Todos')).not.toBeInTheDocument()
  })
})
