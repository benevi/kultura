import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeAll } from 'vitest'

import { FilterBar } from '@/components/ui/FilterBar'
import type { FilterGroup } from '@/components/ui/FilterBar'

// Radix Popover usa estas APIs del DOM al abrir el portal; jsdom no las trae.
// v3 = TODO popover (incl. single), así que el polyfill cubre todos los kinds.
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

// ── single: trigger-pill → Popover single-select (v3, ya NO chips inline) ─────
describe('FilterBar — single (popover v3)', () => {
  const singleGroup: FilterGroup = {
    key: 'year',
    label: 'Año',
    kind: 'single',
    options: [
      { value: '2025', label: '2025' },
      { value: '2024', label: '2024' },
    ],
  }

  it('cerrado: trigger muestra el label del grupo si no hay valor activo', () => {
    render(<FilterBar groups={[singleGroup]} activeFilters={{}} onChange={vi.fn()} />)
    // Las opciones NO se renderizan hasta abrir el popover.
    expect(screen.getByRole('button', { name: /Año/ })).toBeInTheDocument()
    expect(screen.queryByText('2025')).not.toBeInTheDocument()
  })

  it('abrir popover, seleccionar opción → onChange(key, value)', () => {
    const onChange = vi.fn()
    render(
      <FilterBar groups={[singleGroup]} activeFilters={{ year: 'all' }} onChange={onChange} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Año/ }))
    fireEvent.click(screen.getByText('2025'))
    expect(onChange).toHaveBeenCalledWith('year', '2025')
  })

  it('seleccionar la opción ya activa la DESELECCIONA (emite "all")', () => {
    const onChange = vi.fn()
    render(
      <FilterBar groups={[singleGroup]} activeFilters={{ year: '2025' }} onChange={onChange} />
    )
    // Trigger etiquetado con la opción activa; abre y clica esa misma opción.
    // El trigger es un button; la opción dentro del popover es role=radio.
    fireEvent.click(screen.getByRole('button', { name: '2025' }))
    fireEvent.click(screen.getByRole('radio', { name: '2025' }))
    expect(onChange).toHaveBeenLastCalledWith('year', 'all')
  })

  it('con valor activo, trigger muestra el label de la opción y estilo activo', () => {
    render(
      <FilterBar groups={[singleGroup]} activeFilters={{ year: '2024' }} onChange={vi.fn()} />
    )
    // R3: activo = borde resaltado (border-accent-positive), fondo tenue.
    expect(screen.getByRole('button', { name: '2024' })).toHaveClass('border-accent-positive')
  })

  it('grupo sin kind se comporta como single', () => {
    const onChange = vi.fn()
    const noKind: FilterGroup = { ...singleGroup, kind: undefined }
    render(<FilterBar groups={[noKind]} activeFilters={{ year: 'all' }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Año/ }))
    fireEvent.click(screen.getByText('2024'))
    expect(onChange).toHaveBeenCalledWith('year', '2024')
  })

  it('trigger expone aria-expanded (a11y)', () => {
    render(<FilterBar groups={[singleGroup]} activeFilters={{}} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Año/ })).toHaveAttribute('aria-expanded')
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
    // R3: activo = borde resaltado (border-accent-positive).
    expect(screen.getByRole('button', { name: /Género/ })).toHaveClass('border-accent-positive')
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

describe('FilterBar — align end (sort a la derecha)', () => {
  const sortGroup: FilterGroup = {
    key: 'sort',
    label: 'Ordenar',
    kind: 'single',
    align: 'end',
    options: [
      { value: 'popularity', label: 'Popularidad' },
      { value: 'recent', label: 'Más recientes' },
    ],
  }

  it('trigger con align:end lleva ml-auto', () => {
    render(<FilterBar groups={[sortGroup]} activeFilters={{}} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Ordenar/ })).toHaveClass('ml-auto')
  })

  it('sin align no lleva ml-auto', () => {
    const noAlign: FilterGroup = { ...sortGroup, align: undefined }
    render(<FilterBar groups={[noAlign]} activeFilters={{}} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Ordenar/ })).not.toHaveClass('ml-auto')
  })
})

describe('FilterBar — variant sort ("Ordenar: <valor>")', () => {
  const sortGroup: FilterGroup = {
    key: 'sort',
    label: 'Ordenar',
    kind: 'single',
    align: 'end',
    variant: 'sort',
    sortLabel: 'Ordenar',
    options: [
      { value: 'popularity', label: 'Popularidad' },
      { value: 'recent', label: 'Más recientes' },
    ],
  }

  it('muestra el prefijo "Ordenar:" + el valor activo en el trigger', () => {
    render(
      <FilterBar groups={[sortGroup]} activeFilters={{ sort: 'recent' }} onChange={vi.fn()} />
    )
    const trigger = screen.getByRole('button', { name: /Ordenar:/ })
    expect(trigger).toHaveTextContent('Ordenar:')
    expect(trigger).toHaveTextContent('Más recientes')
  })

  it('sin valor usa la primera opción como predeterminada visible', () => {
    render(<FilterBar groups={[sortGroup]} activeFilters={{}} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Ordenar:/ })).toHaveTextContent('Popularidad')
  })

  it('seleccionar una opción emite onChange(key, value) (string, no array)', () => {
    const onChange = vi.fn()
    render(<FilterBar groups={[sortGroup]} activeFilters={{ sort: 'popularity' }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Ordenar:/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Más recientes' }))
    expect(onChange).toHaveBeenCalledWith('sort', 'recent')
  })
})
