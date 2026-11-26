'use client'

// ============================================================
// KULTURA — Acciones sobre otra persona en su perfil «Sala» (fase 8.5 P2)
// Amistad, bloquear y denunciar, con las mismas llamadas que
// `FriendshipButton` y `ReportButton`. Lo que cambia respecto a hoy:
// - **«Amigos ✓» ya no borra la amistad de un toque.** El estado se dice con
//   texto («Sois amigos.») y «Dejar de ser amigos» pregunta antes
//   (`SalaConfirmDialog`, con «Cancelar» primero y el foco en él).
// - **«Bloquear»** también en `SalaConfirmDialog`, y en segundo plano
//   (`quiet`): no compite con la acción principal.
// - **Los errores se ven y se anuncian** (`SalaNotice` con «Reintentar»); hoy
//   solo iban al registro y quien pulsaba no se enteraba.
// - **«Solicitud enviada» ya no es un botón muerto**: es texto, con «Cancelar
//   solicitud» al lado. Una solicitud recibida se puede aceptar o rechazar.
// - Botones de 48 px (`SalaButton`) en vez de las pastillas de 32 px.
// - Tras cada acción el foco no se pierde: va al primer botón que queda o,
//   si no queda ninguno, al texto del estado. El resultado se anuncia.
//
// Las hojas de «Sala» las trae la cabecera (`SalaProfile`), que va siempre en
// la misma página. Se carga con `next/dynamic` (`SalaProfileLazy`).
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { SalaButton } from '@/components/sala/SalaButton'
import { SalaConfirmDialog } from '@/components/sala/SalaConfirmDialog'
import { SalaNotice } from '@/components/sala/SalaNotice'
import { ReportButton } from '@/components/social/ReportButton'
import {
  blockUser,
  getBlockState,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
  unblockUser,
} from '@/lib/social/actions'
import type { FriendshipStatusResult } from '@/lib/social/friends'
import { offerPushInContext } from '@/lib/push/offer'
import { createLogger } from '@/lib/logger'

const log = createLogger('SalaProfileSocial')

type Action = 'send' | 'accept' | 'decline' | 'cancel' | 'unfriend' | 'block' | 'unblock'
type Dialog = 'unfriend' | 'block' | null

export interface SalaProfileSocialProps {
  username: string
  targetUserId: string
  initialStatus: FriendshipStatusResult
  /** Id de la amistad (aceptar, rechazar, cancelar o quitar). */
  friendshipId?: string
}

export function SalaProfileSocial({ username, targetUserId, initialStatus, friendshipId }: SalaProfileSocialProps) {
  const t = useTranslations('friends')
  const tm = useTranslations('moderation')
  const tc = useTranslations('common')
  const te = useTranslations('errors')

  const [status, setStatus] = useState<FriendshipStatusResult>(initialStatus)
  const [fId, setFId] = useState<string | undefined>(friendshipId)
  const [busy, setBusy] = useState<Action | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  /** Fallo de una acción sin diálogo: se pinta en el aviso y se puede reintentar. */
  const [failed, setFailed] = useState<{ action: Action; message: string } | null>(null)
  const [announce, setAnnounce] = useState('')
  const [block, setBlock] = useState({ enabled: false, blocked: false })

  const firstRef = useRef<HTMLButtonElement>(null)
  const stateRef = useRef<HTMLParagraphElement>(null)
  const moveFocus = useRef(false)

  useEffect(() => {
    let alive = true
    getBlockState(targetUserId)
      .then((s) => {
        if (alive) setBlock({ enabled: s.enabled, blocked: s.blocked })
      })
      .catch(() => { /* sin moderación disponible: no se pinta «Bloquear» */ })
    return () => { alive = false }
  }, [targetUserId])

  // Tras una acción, el botón pulsado ya no está: el foco va al primero que
  // queda o, si no hay, al texto del estado (que puede recibirlo).
  useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    ;(firstRef.current ?? stateRef.current)?.focus()
  })

  const ERROR: Record<Action, string> = {
    send: t('sendError'),
    accept: t('acceptError'),
    decline: t('declineError'),
    cancel: t('cancelError'),
    unfriend: t('unfriendError'),
    block: tm('blockError'),
    unblock: tm('unblockError'),
  }

  async function run(action: Action) {
    setBusy(action)
    // El aviso de error se queda hasta que algo sale bien: su «Reintentar»
    // puede tener el foco, y si desapareciera el foco se perdería.
    setDialogError(null)
    try {
      if (action === 'send') {
        const id = await sendFriendRequest(targetUserId)
        setFId(id)
        setStatus('pending_sent')
        setAnnounce(t('requestSent'))
        offerPushInContext('friends')
      } else if (action === 'accept' && fId) {
        await respondToFriendRequest(fId, 'accept')
        setStatus('accepted')
        setAnnounce(t('nowFriends'))
        offerPushInContext('friends')
      } else if (action === 'decline' && fId) {
        await respondToFriendRequest(fId, 'decline')
        setStatus('none')
        setFId(undefined)
        setAnnounce(t('requestDeclined'))
      } else if ((action === 'cancel' || action === 'unfriend') && fId) {
        await removeFriend(fId)
        setStatus('none')
        setFId(undefined)
        setAnnounce(action === 'cancel' ? t('requestCancelled') : t('unfriended'))
      } else if (action === 'block') {
        await blockUser(targetUserId)
        // Bloquear borra la amistad: al desbloquear se parte de cero.
        setBlock({ enabled: true, blocked: true })
        setStatus('none')
        setFId(undefined)
        setAnnounce(tm('blockedNotice'))
      } else if (action === 'unblock') {
        await unblockUser(targetUserId)
        setBlock({ enabled: true, blocked: false })
        setAnnounce(tm('unblockedNotice'))
      }
      setDialog(null)
      setFailed(null)
      moveFocus.current = true
    } catch (err) {
      log.error('Profile action failed', { action, err })
      if (action === 'unfriend' || action === 'block') setDialogError(ERROR[action])
      else setFailed({ action, message: ERROR[action] })
    } finally {
      setBusy(null)
    }
  }

  const loading = (action: Action) => ({ loading: busy === action, loadingLabel: tc('loading') })
  const blocked = block.enabled && block.blocked

  let stateText: string | null = null
  if (blocked) stateText = tm('blockedNotice')
  else if (status === 'pending_sent') stateText = t('requestSent')
  else if (status === 'pending_received') stateText = t('requestReceived')
  else if (status === 'accepted') stateText = t('youAreFriends')

  return (
    <div data-sala-profile-social={blocked ? 'blocked' : status} className="flex w-full flex-col gap-3 md:items-end">
      {/* Resultado de cada acción, para el lector de pantalla. Existe desde el principio. */}
      <p role="status" className="sr-only">{announce}</p>
      {/* El error, en una región que ya existía: el aviso de abajo es lo que se ve. */}
      <p role="alert" className="sr-only">{failed?.message ?? ''}</p>

      {stateText ? (
        <p ref={stateRef} tabIndex={-1} className="sala-type-small text-sala-ink-secondary focus:outline-none sala-focused:sala-focus">
          {stateText}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 md:justify-end">
        {blocked ? (
          <SalaButton ref={firstRef} variant="secondary" onClick={() => run('unblock')} {...loading('unblock')}>
            {tm('unblock')}
          </SalaButton>
        ) : status === 'none' ? (
          <SalaButton ref={firstRef} variant="primary" onClick={() => run('send')} {...loading('send')}>
            {t('addFriend')}
          </SalaButton>
        ) : status === 'pending_sent' ? (
          fId ? (
            <SalaButton ref={firstRef} variant="secondary" onClick={() => run('cancel')} {...loading('cancel')}>
              {t('cancelRequest')}
            </SalaButton>
          ) : null
        ) : status === 'pending_received' ? (
          <>
            <SalaButton ref={firstRef} variant="primary" onClick={() => run('accept')} {...loading('accept')}>
              {t('accept')}
            </SalaButton>
            <SalaButton variant="secondary" onClick={() => run('decline')} {...loading('decline')}>
              {t('decline')}
            </SalaButton>
          </>
        ) : (
          <SalaButton ref={firstRef} variant="secondary" onClick={() => setDialog('unfriend')}>
            {t('unfriend')}
          </SalaButton>
        )}
        {block.enabled && !blocked ? (
          <SalaButton variant="quiet" onClick={() => setDialog('block')}>
            {tm('block')}
          </SalaButton>
        ) : null}
        <ReportButton targetType="user" targetId={targetUserId} skin="sala" closeLabel={tc('close')} />
      </div>

      {failed ? (
        <SalaNotice
          tone="error"
          live="off"
          className="w-full max-w-md"
          action={
            <SalaButton variant="secondary" onClick={() => run(failed.action)} {...loading(failed.action)}>
              {te('tryAgain')}
            </SalaButton>
          }
        >
          {failed.message}
        </SalaNotice>
      ) : null}

      <SalaConfirmDialog
        open={dialog === 'unfriend'}
        title={t('unfriendConfirmTitle', { username })}
        message={t('unfriendConfirmBody')}
        confirmLabel={t('unfriend')}
        cancelLabel={tc('cancel')}
        danger
        loading={busy === 'unfriend'}
        loadingLabel={tc('loading')}
        error={dialog === 'unfriend' ? dialogError : null}
        finalFocusRef={firstRef}
        onConfirm={() => run('unfriend')}
        onCancel={() => { setDialog(null); setDialogError(null) }}
      />
      <SalaConfirmDialog
        open={dialog === 'block'}
        title={tm('blockConfirmTitle')}
        message={tm('blockConfirmBody')}
        confirmLabel={tm('block')}
        cancelLabel={tm('cancel')}
        danger
        loading={busy === 'block'}
        loadingLabel={tc('loading')}
        error={dialog === 'block' ? dialogError : null}
        finalFocusRef={firstRef}
        onConfirm={() => run('block')}
        onCancel={() => { setDialog(null); setDialogError(null) }}
      />
    </div>
  )
}
