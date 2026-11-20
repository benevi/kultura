// ============================================================
// KULTURA — Ajustes: HTML y cableado de SettingsForm (caracterización, C12).
//
// Fija el marcado (textos, clases, orden, ids, aria) y qué función del hook
// llama cada control, para partir el componente sin cambiar nada. El estado
// sale de un `useAccountSettings` simulado: así se recorren todas las ramas
// (correo semanal, push, borrado pendiente, modal…) sin red.
// ============================================================

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRef } from 'react'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? `${ns}.` : ''}${key}${values ? `(${Object.values(values).join(',')})` : ''}`,
  useLocale: () => 'es',
}))
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let state: Record<string, any>
vi.mock('@/hooks/useAccountSettings', () => ({ useAccountSettings: () => state }))

import { SettingsForm } from '@/app/[locale]/(app)/settings/SettingsForm'

const PROPS = {
  initialUsername: 'ana',
  initialAvatarColor: 'blue',
  initialAvatarIcon: null,
  initialLocale: 'es',
  userEmail: 'ana@example.com',
}

function makePush(over: Record<string, unknown> = {}) {
  return { state: 'off', otherDevices: 0, notice: null, enable: vi.fn(), disable: vi.fn(), ...over }
}

function baseState(over: Record<string, unknown> = {}) {
  return {
    username: 'ana',
    avatarColor: 'blue',
    setAvatarColor: vi.fn(),
    avatarIcon: null,
    setAvatarIcon: vi.fn(),
    locale: 'es',
    setLocale: vi.fn(),
    saving: false,
    usernameError: '',
    exporting: false,
    importing: false,
    deleteModalOpen: false,
    setDeleteModalOpen: vi.fn(),
    deleting: false,
    deletionSummary: null,
    deletePassword: '',
    setDeletePassword: vi.fn(),
    deleteError: '',
    pendingDeletion: null,
    cancellingDeletion: false,
    libraryVisibility: null,
    setLibraryVisibility: vi.fn(),
    importUnresolved: 0,
    ratingScale: null,
    scaleState: 'idle',
    weeklyEmail: null,
    weeklyState: 'idle',
    emailFormOpen: false,
    setEmailFormOpen: vi.fn(),
    newEmail: '',
    setNewEmail: vi.fn(),
    emailError: '',
    setEmailError: vi.fn(),
    emailSending: false,
    emailSentTo: null,
    setEmailSentTo: vi.fn(),
    importInputRef: createRef<HTMLInputElement>(),
    push: makePush({ state: 'hidden' }),
    newEmailRef: createRef<HTMLInputElement>(),
    usernameRef: createRef<HTMLInputElement>(),
    handleUsernameChange: vi.fn(),
    handleSave: vi.fn(),
    handleRatingScale: vi.fn(),
    handleWeeklyEmail: vi.fn(),
    handleChangeEmail: vi.fn((e: Event) => e.preventDefault()),
    handleExportData: vi.fn(),
    handleImportData: vi.fn(),
    openDeleteModal: vi.fn(),
    deletionMessage: vi.fn(() => 'mensaje-borrado'),
    handleCancelDeletion: vi.fn(),
    handleDeleteAccount: vi.fn(),
    ...over,
  }
}

/** Todo a la vista: cada sección opcional, el modal y los avisos. */
function fullState() {
  return baseState({
    pendingDeletion: '2026-01-10T12:00:00.000Z',
    cancellingDeletion: true,
    usernameError: 'errorInvalidUsername',
    emailFormOpen: true,
    newEmail: 'nuevo@example.com',
    emailError: 'errorEmail',
    emailSending: true,
    emailSentTo: 'nuevo@example.com',
    avatarIcon: 'cat',
    ratingScale: 'ten',
    scaleState: 'saved',
    weeklyEmail: { weekly: true, consentedAt: '2026-02-03T10:00:00.000Z' },
    weeklyState: 'on',
    push: makePush({ state: 'on', otherDevices: 2, notice: null }),
    libraryVisibility: 'friends',
    importUnresolved: 3,
    exporting: true,
    importing: true,
    saving: true,
    deleteModalOpen: true,
    deleting: true,
    deletePassword: 'x',
    deleteError: 'deleteAccountError',
  })
}

beforeEach(() => {
  state = baseState()
})

describe('SettingsForm: HTML (caracterización)', () => {
  it('mínimo: sin secciones opcionales', () => {
    render(<SettingsForm {...PROPS} />)
    expect(document.body.innerHTML).toMatchSnapshot()
  })

  it('completo: todas las secciones, avisos y el modal abierto', () => {
    state = fullState()
    render(
      <SettingsForm
        {...PROPS}
        emailConfirmed
        graceDays={30}
        hasPassword
        platformsSlot={<section data-testid="platforms">plataformas</section>}
        initialLibraryVisibility="friends"
        initialRatingScale="ten"
      />
    )
    expect(document.body.innerHTML).toMatchSnapshot()
  })

  it('demo: sin cambio de credenciales, interruptores bloqueados, correo confirmado', () => {
    state = baseState({
      weeklyEmail: { weekly: false, consentedAt: null },
      push: makePush({ state: 'off', otherDevices: 3 }),
      ratingScale: 'stars',
      scaleState: 'error',
    })
    render(<SettingsForm {...PROPS} isDemo emailConfirmed />)
    expect(document.body.innerHTML).toMatchSnapshot()
  })

  it('modal sin contraseña (solo Google) y botón guardar en reposo', () => {
    state = baseState({ deleteModalOpen: true })
    render(<SettingsForm {...PROPS} hasPassword={false} />)
    expect(document.body.innerHTML).toMatchSnapshot()
  })

  it.each(['idle', 'saving', 'on', 'off', 'pending', 'cooldown', 'dailyLimit', 'busy', 'error', 'stale', 'unconfirmed', 'sendFailed'])(
    'correo semanal en estado %s',
    (weeklyState) => {
      state = baseState({ weeklyEmail: { weekly: false, consentedAt: null }, weeklyState })
      render(<SettingsForm {...PROPS} />)
      expect(document.getElementById('email')!.outerHTML).toMatchSnapshot()
    }
  )

  it.each([
    ['unsupported', null],
    ['ios_install', null],
    ['denied', null],
    ['off', null],
    ['on', null],
    ['saving', null],
    ['off', 'allOff'],
    ['off', 'dismissed'],
    ['on', 'error'],
  ])('push en estado %s con aviso %s', (pushState, notice) => {
    state = baseState({ push: makePush({ state: pushState, notice, otherDevices: 1 }) })
    render(<SettingsForm {...PROPS} />)
    expect(document.getElementById('push')!.outerHTML).toMatchSnapshot()
  })

  it('push cargando u oculto: no hay sección', () => {
    state = baseState({ push: makePush({ state: 'loading' }) })
    const { unmount } = render(<SettingsForm {...PROPS} />)
    expect(document.getElementById('push')).toBeNull()
    unmount()
    state = baseState({ push: makePush({ state: 'hidden' }) })
    render(<SettingsForm {...PROPS} />)
    expect(document.getElementById('push')).toBeNull()
  })
})

describe('SettingsForm: cada control llama a su función del hook', () => {
  it('cambio de correo: abrir, escribir, enviar y cancelar', () => {
    render(<SettingsForm {...PROPS} />)
    fireEvent.click(screen.getByText('settings.changeEmail'))
    expect(state.setEmailFormOpen).toHaveBeenCalledWith(true)
    expect(state.setEmailSentTo).toHaveBeenCalledWith(null)
    expect(state.setEmailError).toHaveBeenCalledWith('')
  })

  it('formulario de correo abierto: escribir, enviar y cancelar', () => {
    state = baseState({ emailFormOpen: true })
    render(<SettingsForm {...PROPS} />)
    expect(screen.queryByText('settings.changeEmail')).toBeNull()
    fireEvent.change(screen.getByLabelText('settings.newEmail'), { target: { value: 'b@c.d' } })
    expect(state.setNewEmail).toHaveBeenCalledWith('b@c.d')
    fireEvent.click(screen.getByText('settings.changeEmailSubmit'))
    expect(state.handleChangeEmail).toHaveBeenCalledOnce()
    vi.mocked(state.setEmailError).mockClear()
    fireEvent.click(screen.getByText('settings.changeEmailCancel'))
    expect(state.setEmailFormOpen).toHaveBeenCalledWith(false)
    expect(state.setNewEmail).toHaveBeenLastCalledWith('')
    expect(state.setEmailError).toHaveBeenCalledWith('')
  })

  it('perfil: nombre, color, personaje e idioma', () => {
    render(<SettingsForm {...PROPS} />)
    fireEvent.change(screen.getByLabelText('settings.username'), { target: { value: 'bea' } })
    expect(state.handleUsernameChange).toHaveBeenCalledWith('bea')
    fireEvent.click(screen.getByRole('radio', { name: 'settings.avatarColors.red' }))
    expect(state.setAvatarColor).toHaveBeenCalledWith('red')
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(state.setLocale).toHaveBeenCalledWith('en')
    expect(screen.getByRole('radiogroup', { name: 'settings.avatarIcon' })).toBeInTheDocument()
  })

  it('preferencias: escala de notas', () => {
    state = baseState({ ratingScale: 'stars' })
    render(<SettingsForm {...PROPS} />)
    fireEvent.click(screen.getByRole('radio', { name: 'settings.ratingScaleTen' }))
    expect(state.handleRatingScale).toHaveBeenCalledWith('ten')
  })

  it('correo semanal: el interruptor llama con el valor marcado', () => {
    state = baseState({ weeklyEmail: { weekly: false, consentedAt: null } })
    render(<SettingsForm {...PROPS} />)
    fireEvent.click(screen.getByRole('switch', { name: 'settings.weeklyEmail' }))
    expect(state.handleWeeklyEmail).toHaveBeenCalledWith(true)
  })

  it('push: activar, desactivar, en todos, y nada mientras se guarda', () => {
    state = baseState({ push: makePush({ state: 'off', otherDevices: 1 }) })
    const { unmount } = render(<SettingsForm {...PROPS} />)
    fireEvent.click(screen.getByRole('switch', { name: 'push.settings.label' }))
    expect(state.push.enable).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByText('push.settings.disableAll'))
    expect(state.push.disable).toHaveBeenCalledWith(true)
    unmount()

    state = baseState({ push: makePush({ state: 'on' }) })
    const second = render(<SettingsForm {...PROPS} />)
    fireEvent.click(screen.getByRole('switch', { name: 'push.settings.label' }))
    expect(state.push.disable).toHaveBeenCalledOnce()
    second.unmount()

    state = baseState({ push: makePush({ state: 'saving', otherDevices: 1 }) })
    render(<SettingsForm {...PROPS} />)
    fireEvent.click(screen.getByRole('switch', { name: 'push.settings.label' }))
    fireEvent.click(screen.getByText('push.settings.disableAll'))
    expect(state.push.enable).not.toHaveBeenCalled()
    expect(state.push.disable).not.toHaveBeenCalled()
  })

  it('privacidad: elegir quién ve la biblioteca', () => {
    state = baseState({ libraryVisibility: 'friends' })
    render(<SettingsForm {...PROPS} />)
    const priv = document.querySelector('input[name="library-visibility"][value="private"]') as HTMLInputElement
    expect(screen.getByRole('radiogroup', { name: 'settings.libraryVisibility' })).toContainElement(priv)
    fireEvent.click(priv)
    expect(state.setLibraryVisibility).toHaveBeenCalledWith('private')
  })

  it('zona de peligro: exportar, importar, borrar, cancelar borrado y guardar', () => {
    state = baseState({ pendingDeletion: '2026-01-10T12:00:00.000Z' })
    render(<SettingsForm {...PROPS} />)
    fireEvent.click(screen.getByText('settings.exportData'))
    expect(state.handleExportData).toHaveBeenCalledOnce()

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(state.importInputRef.current).toBe(fileInput)
    const clickSpy = vi.spyOn(fileInput, 'click')
    fireEvent.click(screen.getByText('settings.importData'))
    expect(clickSpy).toHaveBeenCalledOnce()
    fireEvent.change(fileInput)
    expect(state.handleImportData).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByText('settings.deleteAccount'))
    expect(state.openDeleteModal).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByText('settings.cancelDeletion'))
    expect(state.handleCancelDeletion).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByText('settings.save'))
    expect(state.handleSave).toHaveBeenCalledOnce()
  })

  it('modal de borrado: contraseña, confirmar y cancelar', () => {
    state = baseState({ deleteModalOpen: true })
    render(<SettingsForm {...PROPS} />)
    expect(state.deletionMessage).toHaveBeenCalledWith(null)
    fireEvent.change(screen.getByLabelText('settings.deletePasswordLabel'), { target: { value: 'k' } })
    expect(state.setDeletePassword).toHaveBeenCalledWith('k')
    fireEvent.click(screen.getByText('settings.deleteAccountConfirmButton'))
    expect(state.handleDeleteAccount).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByText('settings.deleteAccountCancel'))
    expect(state.setDeleteModalOpen).toHaveBeenCalledWith(false)
  })

  it('las referencias del hook apuntan a sus campos', () => {
    state = baseState({ emailFormOpen: true })
    render(<SettingsForm {...PROPS} />)
    expect(state.usernameRef.current).toBe(screen.getByLabelText('settings.username'))
    expect(state.newEmailRef.current).toBe(screen.getByLabelText('settings.newEmail'))
  })
})
