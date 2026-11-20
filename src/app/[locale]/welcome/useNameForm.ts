import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ApiError } from '@/lib/api/client'
import { updateSettings, type SettingsPatch } from '@/lib/settings/client'
import { SETTINGS_ERRORS } from '@/lib/settings/errors'
import { localUsernameError } from './welcome-steps'

interface UseNameFormOptions {
  currentUsername: string
  suggestChange: boolean
  needsTerms: boolean
  /** Avanza al paso siguiente cuando el nombre (y la casilla) quedan guardados. */
  onDone: () => void
}

/** Paso "nombre": nombre público y, si entró con Google, la casilla de edad y términos. */
export function useNameForm({ currentUsername, suggestChange, needsTerms, onDone }: UseNameFormOptions) {
  const t = useTranslations('onboarding')
  const tAuth = useTranslations('auth')

  const [username, setUsername] = useState(suggestChange ? '' : currentUsername)
  const [savedUsername, setSavedUsername] = useState(currentUsername)
  const [usernameError, setUsernameError] = useState('')
  const [termsPending, setTermsPending] = useState(needsTerms)
  const [termsChecked, setTermsChecked] = useState(false)
  const [termsError, setTermsError] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameFailed, setNameFailed] = useState('')
  const usernameRef = useRef<HTMLInputElement>(null)
  const termsRef = useRef<HTMLInputElement>(null)

  /** Escribir en el campo borra el error que hubiera. */
  function changeUsername(value: string) {
    setUsername(value)
    if (usernameError) setUsernameError('')
  }

  /** Marcar la casilla borra su error. */
  function changeTerms(checked: boolean) {
    setTermsChecked(checked)
    if (checked) setTermsError('')
  }

  /**
   * SEG-7: la casilla de edad y términos sigue pendiente (no marcada, o el
   * servidor no tiene la aceptación). Pone el error y, si se pide, lleva el
   * foco a la casilla en cuanto esté pintada.
   */
  function requireTerms({ focus }: { focus: boolean }) {
    setTermsPending(true)
    setTermsError(tAuth('termsRequired'))
    if (focus) requestAnimationFrame(() => termsRef.current?.focus())
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault()
    const value = username.trim()
    const changed = value !== '' && value !== savedUsername

    const localError = localUsernameError(value, changed)
    const nameErr = localError ? t(localError) : ''
    const termsErr = termsPending && !termsChecked ? tAuth('termsRequired') : ''
    setUsernameError(nameErr)
    setTermsError(termsErr)
    setNameFailed('')
    if (nameErr) return usernameRef.current?.focus()
    if (termsErr) return termsRef.current?.focus()

    const body: SettingsPatch = {}
    if (changed) body.username = value
    if (termsPending) body.accept_terms = true
    if (Object.keys(body).length === 0) return onDone()

    setSaving(true)
    try {
      await updateSettings(body)
      if (changed) setSavedUsername(value)
      setTermsPending(false)
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'conflict') {
        setUsernameError(err.message === SETTINGS_ERRORS.usernameReserved ? t('nameReserved') : t('nameTaken'))
        usernameRef.current?.focus()
      } else if (err instanceof ApiError && err.code === 'invalid_input') {
        setUsernameError(t('nameInvalid'))
        usernameRef.current?.focus()
      } else {
        setNameFailed(t('saveError'))
      }
    } finally {
      setSaving(false)
    }
  }

  return {
    username,
    changeUsername,
    savedUsername,
    usernameError,
    termsPending,
    termsChecked,
    changeTerms,
    termsError,
    requireTerms,
    saving,
    nameFailed,
    usernameRef,
    termsRef,
    submitName,
  }
}

export type NameForm = ReturnType<typeof useNameForm>
