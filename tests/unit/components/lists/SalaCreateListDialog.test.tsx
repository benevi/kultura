// ============================================================
// KULTURA — «Crear lista» en «Sala» (fase 8.5 L2): diálogo con nombre, todos
// los campos etiquetados, privada marcada, «Franquicia» fija el formato, el
// error del nombre en el campo con el foco, el del alta dentro del diálogo y
// lo que se envía (el mismo alta que el diálogo de hoy).
// ============================================================

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? ns + '.' : ''}${key}${values ? JSON.stringify(values) : ''}`,
  useLocale: () => 'es',
}))
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

import { SalaCreateListDialog } from '@/components/lists/sala/SalaCreateListDialog'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

function name() {
  return screen.getByRole('textbox', { name: /lists\.listName/ })
}

describe('SalaCreateListDialog', () => {
  it('diálogo con nombre, campos etiquetados, privada marcada y «Cancelar» antes que «Crear»', () => {
    render(<SalaCreateListDialog onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'lists.createList' })
    for (const el of Array.from(dialog.querySelectorAll<HTMLElement>('input, select, textarea, button'))) {
      expect(el, el.outerHTML.slice(0, 120)).toHaveAccessibleName()
    }
    expect(screen.getByRole('radiogroup', { name: /lists\.templateLabel/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /lists\.template\.free/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /lists\.visibilityPrivate/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /lists\.visibilityPublic/ })).toHaveAccessibleDescription(/lists\.visibilityPublicHint/)
    expect(screen.getByRole('combobox', { name: /lists\.mediaType/ })).toHaveValue('movie')
    expect(screen.getByRole('switch', { name: /lists\.collaborative/ })).not.toBeChecked()
    expect(name()).toHaveAttribute('placeholder', 'lists.namePlaceholder')
    const buttons = Array.from(dialog.querySelectorAll('button')).map((b) => b.textContent)
    expect(buttons.indexOf('common.cancel')).toBeLessThan(buttons.indexOf('lists.create'))
  })

  it('«Franquicia» fija el formato en «Varios formatos» y cambia el ejemplo del nombre', () => {
    render(<SalaCreateListDialog onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: /lists\.template\.franchise/ }))
    expect(screen.queryByRole('combobox', { name: /lists\.mediaType/ })).toBeNull()
    expect(screen.getByText('lists.mediaTypeMixed')).toBeInTheDocument()
    expect(name()).toHaveAttribute('placeholder', 'lists.franchiseNamePlaceholder')
  })

  it('sin nombre: el error va en el campo, se anuncia y el foco vuelve a él; no se envía nada', () => {
    render(<SalaCreateListDialog onClose={vi.fn()} />)
    fireEvent.submit(screen.getByTestId('sala-create-list-form'))
    expect(name()).toHaveAttribute('aria-invalid', 'true')
    expect(name()).toHaveAccessibleDescription(/lists\.nameRequired/)
    expect(document.activeElement).toBe(name())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('crea con una sola petición, con lo elegido, y va a la lista', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ data: { id: 'l9' } }) })
    const onClose = vi.fn()
    render(<SalaCreateListDialog onClose={onClose} />)
    fireEvent.click(screen.getByRole('radio', { name: /lists\.template\.ranking/ }))
    fireEvent.change(name(), { target: { value: '  Mis 10 de terror ' } })
    fireEvent.change(screen.getByRole('combobox', { name: /lists\.mediaType/ }), { target: { value: 'game' } })
    fireEvent.change(screen.getByRole('textbox', { name: /lists\.descriptionLabel/ }), { target: { value: 'Por orden' } })
    fireEvent.click(screen.getByRole('radio', { name: /lists\.visibilityPublic/ }))
    fireEvent.click(screen.getByRole('switch', { name: /lists\.collaborative/ }))
    await act(async () => {
      fireEvent.submit(screen.getByTestId('sala-create-list-form'))
    })
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/lists/l9'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      name: 'Mis 10 de terror',
      mediaType: 'game',
      isCollaborative: true,
      isPublic: true,
      description: 'Por orden',
      template: 'ranking',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('si el alta falla, el error se anuncia dentro del diálogo y no navega', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => ({ error: { code: 'internal' } }) })
    render(<SalaCreateListDialog onClose={vi.fn()} />)
    fireEvent.change(name(), { target: { value: 'X' } })
    await act(async () => {
      fireEvent.submit(screen.getByTestId('sala-create-list-form'))
    })
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => a.textContent?.includes('lists.errorCreate'))).toBe(true))
    expect(mockPush).not.toHaveBeenCalled()
  })
})
