// ============================================================
// KULTURA — Ajustes: privacidad, importación y borrado (F-12)
// ============================================================

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next-intl', () => ({
  // La clave y, si hay valores, `clave:{json}` para poder comprobarlos.
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => 'es',
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => '/es/settings',
}))

const mockToast = vi.fn()
vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: mockToast, dismiss: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

const mockSignOut = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}))

// `.hex` está obsoleto (F-08): la muestra de color tiene que pintar `.value`.
// Aquí se dan valores distintos para que un `.hex` olvidado se note.
vi.mock('@/lib/constants/avatarColors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/constants/avatarColors')>()
  return {
    ...actual,
    AVATAR_COLORS: actual.AVATAR_COLORS.map((c, i) => ({ ...c, value: `rgb(${i}, 1, 2)`, hex: 'rgb(255, 0, 0)' })),
  }
})

import { SettingsForm } from '@/app/[locale]/(app)/settings/SettingsForm'

const PROPS = {
  initialUsername: 'testuser',
  initialAvatarColor: 'blue',
  initialAvatarIcon: null,
  initialLocale: 'es',
  userEmail: 'test@example.com',
}

function lastBody(): Record<string, unknown> {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
  const patch = calls.filter(([url, init]) => url === '/api/settings' && init?.method === 'PATCH').pop()
  return JSON.parse(patch![1].body as string)
}

describe('SettingsForm — F-12', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
  })

  it('las muestras de color pintan `color.value`, no el `.hex` obsoleto', () => {
    render(<SettingsForm {...PROPS} />)
    expect(screen.getByLabelText('slate').style.backgroundColor).toBe('rgb(0, 1, 2)')
    expect(screen.getByLabelText('blue').style.backgroundColor).toBe('rgb(6, 1, 2)')
  })

  it('guardar sin tocar el nombre no lo envía (un nombre antiguo nunca bloquea el resto)', async () => {
    render(<SettingsForm {...PROPS} />)
    fireEvent.click(screen.getByText('save'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(lastBody()).not.toHaveProperty('username')
  })

  it('un nombre reservado nuevo da error sin llamar a la API', () => {
    render(<SettingsForm {...PROPS} />)
    fireEvent.change(screen.getByDisplayValue('testuser'), { target: { value: 'admin' } })
    fireEvent.click(screen.getByText('save'))
    expect(screen.getByText('errorUsernameReserved')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('el 409 username_reserved de la API se explica como reservado', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'username_reserved' }), { status: 409 }))
    render(<SettingsForm {...PROPS} />)
    fireEvent.change(screen.getByDisplayValue('testuser'), { target: { value: 'otro_nombre' } })
    fireEvent.click(screen.getByText('save'))
    expect(await screen.findByText('errorUsernameReserved')).toBeInTheDocument()
  })

  describe('quién ve la biblioteca (D-04b)', () => {
    const group = () => screen.queryByRole('radiogroup', { name: 'libraryVisibility' })
    const option = (value: string) =>
      within(group()!).getAllByRole('radio').find((r) => (r as HTMLInputElement).value === value)!

    it('sin bandera o sin columna (null) no se enseña el selector', () => {
      render(<SettingsForm {...PROPS} initialLibraryVisibility={null} />)
      expect(group()).not.toBeInTheDocument()
    })

    it('con la bandera: tres opciones, "amigos" marcada por defecto', () => {
      render(<SettingsForm {...PROPS} initialLibraryVisibility="friends" />)
      expect(within(group()!).getAllByRole('radio')).toHaveLength(3)
      expect(option('friends')).toBeChecked()
      expect(option('private')).not.toBeChecked()
    })

    it('elegir "solo yo" y guardar envía library_visibility', async () => {
      render(<SettingsForm {...PROPS} initialLibraryVisibility="friends" />)
      fireEvent.click(option('private'))
      fireEvent.click(screen.getByText('save'))
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(lastBody()).toMatchObject({ library_visibility: 'private' })
    })

    it('sin cambiarla no se envía', async () => {
      render(<SettingsForm {...PROPS} initialLibraryVisibility="public" />)
      fireEvent.click(screen.getByText('save'))
      await waitFor(() => expect(global.fetch).toHaveBeenCalled())
      expect(lastBody()).not.toHaveProperty('library_visibility')
    })
  })

  it('tras importar, avisa de los títulos que no se encontraron (libraryUnresolved)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ libraryImported: 10, listsImported: 1, libraryUnresolved: 3 }), { status: 200 })
    )
    const { container } = render(<SettingsForm {...PROPS} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['{"library":[]}'], 'export.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '{"library":[]}' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByText('importUnresolved:{"count":3}')).toBeInTheDocument()
  })

  it('sin títulos sin resolver no hay aviso', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ libraryImported: 10, listsImported: 1, libraryUnresolved: 0 }), { status: 200 })
    )
    const { container } = render(<SettingsForm {...PROPS} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['{}'], 'export.json')
    Object.defineProperty(file, 'text', { value: async () => '{}' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(mockToast).toHaveBeenCalled())
    expect(screen.queryByText(/importUnresolved/)).not.toBeInTheDocument()
  })

  describe('borrado (ROJO-7)', () => {
    it('el modal enumera lo que se pierde y a quién pasa cada grupo y lista', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            library: 34,
            lists: 3,
            messages: 120,
            friends: 5,
            groups: [
              { name: 'Club', successor: 'lucia_lee' },
              { name: 'Solo', successor: null },
            ],
            sharedLists: [{ name: 'Pelis', successor: 'marcos' }],
            graceDays: 7,
          }),
          { status: 200 }
        )
      )
      render(<SettingsForm {...PROPS} />)
      fireEvent.click(screen.getByText('deleteAccount'))
      const message = await screen.findByText(/deleteSummaryLoses/)
      expect(message.textContent).toContain('deleteSummaryLoses:{"library":34,"lists":3,"messages":120,"friends":5}')
      expect(message.textContent).toContain('deleteSummaryGroupMoves:{"name":"Club","user":"lucia_lee"}')
      expect(message.textContent).toContain('deleteSummaryGroupGone:{"name":"Solo"}')
      expect(message.textContent).toContain('deleteSummaryListMoves:{"name":"Pelis","user":"marcos"}')
      expect(message.textContent).toContain('deleteSummaryGrace:{"days":7}')
    })

    it('con borrado programado, vuelve al login con la fecha', async () => {
      const purgeAt = '2026-11-01T10:00:00.000Z'
      global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) =>
        init?.method === 'DELETE'
          ? new Response(JSON.stringify({ ok: true, scheduled: true, purgeAt }), { status: 200 })
          : new Response(null, { status: 500 })
      )
      render(<SettingsForm {...PROPS} />)
      fireEvent.click(screen.getByText('deleteAccount'))
      fireEvent.click(screen.getByText('deleteAccountConfirmButton'))
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith(
          `/es/login?account=deletion_scheduled&purge_at=${encodeURIComponent(purgeAt)}`
        )
      )
      expect(mockSignOut).toHaveBeenCalledOnce()
    })

    it('con un borrado pendiente se avisa y se puede cancelar', async () => {
      render(<SettingsForm {...PROPS} deletionRequestedAt="2026-10-20T10:00:00.000Z" />)
      expect(screen.getByText(/deletionPending/)).toBeInTheDocument()
      fireEvent.click(screen.getByText('cancelDeletion'))
      await waitFor(() =>
        expect(global.fetch).toHaveBeenCalledWith('/api/account', expect.objectContaining({ method: 'PATCH' }))
      )
      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ cancel_deletion: true })
      await waitFor(() => expect(screen.queryByText(/deletionPending/)).not.toBeInTheDocument())
    })
  })
})
