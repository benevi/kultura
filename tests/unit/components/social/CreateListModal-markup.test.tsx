// ============================================================
// KULTURA — «Crear lista» de hoy: HTML del diálogo (caracterización, fase 8.5 L2).
//
// Fija lo que pinta hoy `CreateListModal` (plantillas, nombre, formato,
// descripción, visibilidad, colaborativa, el error del nombre y el de alta)
// para que sacar su estado a `useCreateListForm` y la versión de «Sala»
// (`SalaCreateListDialog`, solo con `SALA_LISTAS`) lo dejen EXACTAMENTE
// igual. La instantánea se sacó antes de tocar el diálogo.
// ============================================================

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? ns + '.' : ''}${key}${values ? JSON.stringify(values) : ''}`,
  useLocale: () => 'es',
}))
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { CreateListModal } from '@/components/social/CreateListModal'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})

/** El diálogo cuelga de `<body>`: se mira el cuerpo entero, sin los ids generados. */
function html() {
  return document.body.innerHTML.replace(/«r[0-9a-z]+»|:r[0-9a-z]+:|_r_[0-9a-z]+_/g, 'ID')
}

describe('CreateListModal (sin «Sala»): marcado de hoy', () => {
  it('al abrir', () => {
    render(<CreateListModal onClose={vi.fn()} />)
    expect(html()).toMatchSnapshot()
  })

  it('franquicia (formato fijo en mixta), descripción, pública y colaborativa', () => {
    render(<CreateListModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: /lists\.template\.franchise/ }))
    fireEvent.change(screen.getByRole('textbox', { name: /lists\.descriptionLabel/ }), { target: { value: 'Todo Dune' } })
    fireEvent.click(screen.getByRole('radio', { name: /lists\.visibilityPublic/ }))
    fireEvent.click(screen.getByRole('checkbox'))
    expect(html()).toMatchSnapshot()
  })

  it('sin nombre: el error del campo', () => {
    render(<CreateListModal onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'lists.create' }))
    expect(html()).toMatchSnapshot()
  })

  it('si el alta falla: el error del diálogo', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => ({ error: { code: 'internal' } }) })
    render(<CreateListModal onClose={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'lists.listName' }), { target: { value: 'X' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'lists.create' }))
    })
    await waitFor(() => expect(screen.getByText('lists.errorCreate')).toBeInTheDocument())
    expect(html()).toMatchSnapshot()
  })
})
