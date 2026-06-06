import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = { all: 'Todos' }
    return map[key] ?? key
  },
}))

import { FilterBar } from '@/components/ui/FilterBar'
import type { FilterGroup } from '@/components/ui/FilterBar'

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

describe('FilterBar', () => {
  it('renderiza chips para cada opción más el chip Todos implícito', () => {
    render(
      <FilterBar
        groups={groups}
        activeFilters={{}}
        onChange={vi.fn()}
      />
    )
    // type group: Todos + 2 options
    expect(screen.getAllByText('Todos')).toHaveLength(2)
    expect(screen.getByText('Películas')).toBeInTheDocument()
    expect(screen.getByText('Series')).toBeInTheDocument()
    // status group
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('chip Todos activo por defecto cuando activeFilters está vacío', () => {
    render(
      <FilterBar
        groups={[groups[0]]}
        activeFilters={{}}
        onChange={vi.fn()}
      />
    )
    const todosBtn = screen.getByText('Todos')
    expect(todosBtn).toHaveClass('border-accent-positive')
  })

  it('click en chip inactivo llama onChange con key y value correctos', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        groups={[groups[0]]}
        activeFilters={{ type: 'all' }}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByText('Películas'))
    expect(onChange).toHaveBeenCalledWith('type', 'movie')
  })

  it('click en chip activo llama onChange con all (deselecciona)', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        groups={[groups[0]]}
        activeFilters={{ type: 'movie' }}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByText('Películas'))
    expect(onChange).toHaveBeenCalledWith('type', 'all')
  })

  it('chip activo tiene clase border-accent-positive', () => {
    render(
      <FilterBar
        groups={[groups[0]]}
        activeFilters={{ type: 'tv' }}
        onChange={vi.fn()}
      />
    )
    const seriesBtn = screen.getByText('Series')
    expect(seriesBtn).toHaveClass('border-accent-positive')
  })

  it('chip inactivo tiene clase border-border', () => {
    render(
      <FilterBar
        groups={[groups[0]]}
        activeFilters={{ type: 'tv' }}
        onChange={vi.fn()}
      />
    )
    const movieBtn = screen.getByText('Películas')
    expect(movieBtn).toHaveClass('border-border')
  })
})
