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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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
})
