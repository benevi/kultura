// ============================================================
// KULTURA — ProfileBio guarda por la API, no directo contra la base
// (F-02: la bio pasaba sin límite por el cliente de Supabase del navegador)
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const { browserClient } = vi.hoisted(() => ({
  // Devuelve un cliente que "funciona" para que la versión vieja no reviente
  // y el test falle por la aserción, no por el mock.
  browserClient: vi.fn(() => ({
    from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  })),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: browserClient }))

import { ProfileBio } from '@/components/profile/ProfileBio'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function openEditor() {
  render(<ProfileBio bio={null} isOwner userId="user-1" />)
  fireEvent.click(screen.getByRole('button', { name: /editBio/ }))
  return screen.getByRole('textbox')
}

describe('ProfileBio', () => {
  it('guarda con PATCH /api/settings y la bio recortada', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    const box = openEditor()
    fireEvent.change(box, { target: { value: '  Me gusta el anime  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'saveBio' }))

    await waitFor(() => expect(screen.getByText('Me gusta el anime')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/settings')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ bio: 'Me gusta el anime' })
    expect(browserClient).not.toHaveBeenCalled()
  })

  it('una bio vacía se envía como null', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    const box = openEditor()
    fireEvent.change(box, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'saveBio' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ bio: null })
  })

  it('si la API falla, no da la bio por guardada y avisa', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 403 }))
    const box = openEditor()
    fireEvent.change(box, { target: { value: 'hola' } })
    fireEvent.click(screen.getByRole('button', { name: 'saveBio' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('bioSaveError')
    // Sigue en edición con el borrador intacto.
    expect(screen.getByRole('textbox')).toHaveValue('hola')
  })

  it('limita el editor a 200 caracteres, igual que la API', () => {
    const box = openEditor()
    expect(box).toHaveAttribute('maxLength', '200')
  })
})
