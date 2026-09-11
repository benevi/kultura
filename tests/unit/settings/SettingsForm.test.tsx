// ============================================================
// KULTURA — SettingsForm unit tests
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'es',
}))

const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => '/es/settings',
}))

vi.mock('@/components/ui/ToastProvider', () => ({
  useToastContext: () => ({ show: vi.fn(), dismiss: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockSignOut = vi.fn().mockResolvedValue({ error: null })
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}))

import { SettingsForm } from '@/app/[locale]/(app)/settings/SettingsForm'

const DEFAULT_PROPS = {
  initialUsername: 'testuser',
  initialAvatarColor: 'blue',
  initialLocale: 'es',
  userEmail: 'test@example.com',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('muestra el username actual en el input', () => {
    render(<SettingsForm {...DEFAULT_PROPS} />)
    const input = screen.getByDisplayValue('testuser')
    expect(input).toBeInTheDocument()
  })

  it('click en color de avatar lo selecciona (ring visible)', () => {
    render(<SettingsForm {...DEFAULT_PROPS} initialAvatarColor="blue" />)
    const redButton = screen.getByLabelText('red')
    fireEvent.click(redButton)
    expect(redButton.className).toContain('ring-2')
  })

  it('username con menos de 3 caracteres muestra error inline sin hacer fetch', () => {
    render(<SettingsForm {...DEFAULT_PROPS} />)
    const input = screen.getByDisplayValue('testuser')
    fireEvent.change(input, { target: { value: 'ab' } })
    const saveButton = screen.getByText('save')
    fireEvent.click(saveButton)
    expect(screen.getByText('errorInvalidUsername')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('username con caracteres especiales muestra error inline sin hacer fetch', () => {
    render(<SettingsForm {...DEFAULT_PROPS} />)
    const input = screen.getByDisplayValue('testuser')
    fireEvent.change(input, { target: { value: 'invalid name!' } })
    const saveButton = screen.getByText('save')
    fireEvent.click(saveButton)
    expect(screen.getByText('errorInvalidUsername')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('botón guardar muestra "saving" durante el fetch', async () => {
    let resolvePromise!: (value: Response) => void
    global.fetch = vi.fn().mockReturnValue(
      new Promise<Response>(resolve => { resolvePromise = resolve })
    )

    render(<SettingsForm {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByText('save'))

    await waitFor(() => {
      expect(screen.getByText('saving')).toBeInTheDocument()
    })

    resolvePromise(new Response(JSON.stringify({ success: true }), { status: 200 }))
  })

  // ── D2/D3: exportar datos + eliminar cuenta ──────────────────────────────────

  it('exportData descarga un JSON (createObjectURL + click en <a download>)', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ library: [] }), { status: 200 })
    )
    const createObjectURL = vi.fn().mockReturnValue('blob:fake-url')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<SettingsForm {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByText('exportData'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/account/export')
      expect(createObjectURL).toHaveBeenCalledOnce()
      expect(clickSpy).toHaveBeenCalledOnce()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
    })

    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('exportData con respuesta no-ok no intenta descargar', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    const createObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL })

    render(<SettingsForm {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByText('exportData'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
    expect(createObjectURL).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('deleteAccount abre el modal de confirmación (no elimina de inmediato)', () => {
    render(<SettingsForm {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByText('deleteAccount'))
    expect(screen.getByText('deleteAccountConfirmTitle')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('confirmar en el modal llama DELETE /api/account, hace signOut y redirige a /login', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    render(<SettingsForm {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByText('deleteAccount'))
    fireEvent.click(screen.getByText('deleteAccountConfirmButton'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/account', { method: 'DELETE' })
      expect(mockSignOut).toHaveBeenCalledOnce()
      expect(mockRouterPush).toHaveBeenCalledWith('/login')
    })
  })

  it('si el DELETE falla, no hace signOut ni redirige', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))

    render(<SettingsForm {...DEFAULT_PROPS} />)
    fireEvent.click(screen.getByText('deleteAccount'))
    fireEvent.click(screen.getByText('deleteAccountConfirmButton'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/account', { method: 'DELETE' })
    })
    expect(mockSignOut).not.toHaveBeenCalled()
    expect(mockRouterPush).not.toHaveBeenCalled()
  })
})
