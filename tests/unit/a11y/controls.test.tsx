/**
 * ACC-2/3/10/14/16 — controles: radiogroups con flechas, conmutadores con
 * `aria-pressed`, autocompletado como combobox, formulario de sugerencias con
 * errores anunciados y textos de accesibilidad traducidos.
 */
import { useState } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? ns + '.' : ''}${key}${values ? JSON.stringify(values) : ''}`,
  useLocale: () => 'es',
}))

const mockPush = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { AvatarIconPicker } from '@/components/ui/AvatarIconPicker'
import { FilterChip } from '@/components/ui/FilterChip'
import { TabButton } from '@/components/ui/TabButton'
import { Spinner } from '@/components/ui/Spinner'
import { CloseButton } from '@/components/ui/CloseButton'
import { FilterBar } from '@/components/ui/FilterBar'
import { SearchBar } from '@/components/search/SearchBar'
import { SuggestionsForm } from '@/app/[locale]/(app)/suggestions/SuggestionsForm'
import { AVATAR_ICON_KEYS } from '@/components/icons/avatars'

function Segmented() {
  const [value, setValue] = useState('private')
  return (
    <SegmentedControl
      ariaLabel="Visibilidad"
      value={value}
      onChange={setValue}
      options={[
        { value: 'private', label: 'Privada' },
        { value: 'public', label: 'Pública' },
      ]}
    />
  )
}

describe('SegmentedControl (radiogroup)', () => {
  it('una parada de Tab y las flechas cambian la selección y el foco', () => {
    render(<Segmented />)
    const [priv, pub] = screen.getAllByRole('radio')
    expect(priv).toHaveAttribute('tabindex', '0')
    expect(pub).toHaveAttribute('tabindex', '-1')
    priv.focus()
    fireEvent.keyDown(priv, { key: 'ArrowRight' })
    expect(pub).toHaveAttribute('aria-checked', 'true')
    expect(document.activeElement).toBe(pub)
    fireEvent.keyDown(pub, { key: 'ArrowRight' }) // vuelta al principio
    expect(priv).toHaveAttribute('aria-checked', 'true')
  })
})

describe('AvatarIconPicker (radiogroup)', () => {
  it('nombres traducidos por prop y flechas', () => {
    const onChange = vi.fn()
    render(
      <AvatarIconPicker value={null} onChange={onChange} label="Personaje" noneLabel="Sin personaje" iconLabel={(k) => `icon:${k}`} />
    )
    const group = screen.getByRole('radiogroup', { name: 'Personaje' })
    const radios = screen.getAllByRole('radio')
    expect(group).toBeInTheDocument()
    expect(radios).toHaveLength(AVATAR_ICON_KEYS.length + 1)
    expect(radios[1]).toHaveAccessibleName(`icon:${AVATAR_ICON_KEYS[0]}`)
    expect(radios.filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1)
    radios[0].focus()
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(AVATAR_ICON_KEYS[0])
  })
})

describe('conmutadores con estado', () => {
  it('FilterChip y TabButton exponen aria-pressed', () => {
    render(
      <>
        <FilterChip label="Pendientes" active />
        <FilterChip label="Completados" />
        <TabButton active onClick={vi.fn()}>Amigos</TabButton>
      </>
    )
    expect(screen.getByRole('button', { name: 'Pendientes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Completados' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Amigos' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('FilterBar', () => {
  it('las opciones `radio` van dentro de un radiogroup con el nombre del filtro (axe aria-required-parent)', async () => {
    render(
      <FilterBar
        groups={[{ key: 'year', label: 'Año', options: [{ value: '2026', label: '2026', icon: '📅' }] }]}
        activeFilters={{}}
        onChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('filter-trigger-year'))
    const group = await screen.findByRole('radiogroup', { name: 'Año' })
    // El emoji no forma parte del nombre.
    expect(group.querySelector('[role=radio]')).toHaveAccessibleName('2026')
  })
})

describe('Spinner y CloseButton', () => {
  it('Spinner: con etiqueta es un estado con nombre; sin ella, decorativo', () => {
    const { rerender, container } = render(<Spinner label="Cargando…" />)
    expect(screen.getByRole('status', { name: 'Cargando…' })).toBeInTheDocument()
    rerender(<Spinner />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('CloseButton: nombre obligatorio y 44 px', () => {
    render(<CloseButton label="Cerrar" />)
    const button = screen.getByRole('button', { name: 'Cerrar' })
    expect(button.className).toContain('h-11')
    expect(button.className).toContain('w-11')
  })
})

describe('SearchBar (combobox, ACC-14)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 'movie_1', externalId: '1', type: 'movie', title: 'Dune', year: 2021 },
          { id: 'movie_2', externalId: '2', type: 'movie', title: 'Dune: Parte dos', year: 2024 },
        ],
      })
    )
  })
  afterEach(() => vi.useRealTimers())

  async function typeAndWait(value: string) {
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value } })
    await act(async () => {
      vi.advanceTimersByTime(450)
    })
    vi.useRealTimers()
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'))
    return input
  }

  it('anuncia el número de sugerencias y ↓/↑ mueven aria-activedescendant', async () => {
    render(<SearchBar />)
    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveAttribute('aria-autocomplete', 'list')
    await typeAndWait('dune')
    const listbox = screen.getByRole('listbox', { name: 'search.suggestionsLabel' })
    expect(input).toHaveAttribute('aria-controls', listbox.id)
    expect(screen.getByText('search.suggestionsCount{"count":2}')).toHaveAttribute('role', 'status')
    const options = screen.getAllByRole('option')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id)
  })

  it('Enter con una sugerencia resaltada la elige; Esc cierra', async () => {
    render(<SearchBar />)
    const input = await typeAndWait('dune')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockPush).toHaveBeenCalledWith('/search?q=Dune%3A%20Parte%20dos&type=movie')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('SuggestionsForm (ACC-2/3)', () => {
  it('campos etiquetados y tipo como conmutadores en un grupo con nombre', () => {
    render(<SuggestionsForm />)
    expect(screen.getByRole('textbox', { name: 'suggestions.subjectLabel' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'suggestions.descriptionLabel' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'suggestions.typeLabel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'suggestions.typeFeature' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'suggestions.typeBug' }))
    expect(screen.getByRole('button', { name: 'suggestions.typeBug' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('enviar vacío: cada error enlazado y anunciado, foco al primer campo', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<SuggestionsForm />)
    fireEvent.click(screen.getByRole('button', { name: 'suggestions.submit' }))
    const subject = screen.getByRole('textbox', { name: 'suggestions.subjectLabel' })
    const description = screen.getByRole('textbox', { name: 'suggestions.descriptionLabel' })
    expect(subject).toHaveAttribute('aria-invalid', 'true')
    expect(subject).toHaveAccessibleDescription('suggestions.errorSubjectShort')
    expect(description).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(document.activeElement).toBe(subject)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('el éxito se anuncia y recibe el foco', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201 }))
    render(<SuggestionsForm />)
    fireEvent.change(screen.getByRole('textbox', { name: 'suggestions.subjectLabel' }), { target: { value: 'Asunto' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'suggestions.descriptionLabel' }), {
      target: { value: 'Una descripción suficientemente larga' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'suggestions.submit' }))
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('suggestions.success')
    expect(document.activeElement).toBe(status)
  })
})
