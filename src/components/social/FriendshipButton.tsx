'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'
import { InlineConfirm, useRestoreFocus } from '@/components/social/ReportButton'
import {
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  getBlockState,
  blockUser,
  unblockUser,
} from '@/lib/social/actions'
import { createLogger } from '@/lib/logger'
import { F0 } from '@/lib/design/f0-tokens'
import type { FriendshipStatusResult } from '@/lib/social/friends'

const log = createLogger('FriendshipButton')

interface FriendshipButtonProps {
  /** Estado inicial de la relación */
  initialStatus: FriendshipStatusResult
  /** ID del usuario objetivo */
  targetUserId: string
  /** ID de la amistad (necesario para accept/decline/remove) */
  friendshipId?: string
  /**
   * F-11: muestra "Bloquear" (si la moderación está activa). Por defecto sí
   * (perfil); en listas de resultados se desactiva para no recargar.
   */
  allowBlock?: boolean
}

/**
 * Bloquear / desbloquear (F-11). Pregunta a la API si está disponible
 * (MODERATION_V2 y migración aplicada); si no, no pinta nada.
 */
function BlockControl({
  targetUserId,
  onBlockedChange,
}: {
  targetUserId: string
  onBlockedChange: (blocked: boolean) => void
}) {
  const t = useTranslations('moderation')
  const [enabled, setEnabled] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const { ref: triggerRef, restore } = useRestoreFocus()

  useEffect(() => {
    let alive = true
    getBlockState(targetUserId)
      .then((s) => {
        if (!alive) return
        setEnabled(s.enabled)
        setBlocked(s.blocked)
        if (s.blocked) onBlockedChange(true)
      })
      .catch(() => { /* sin moderación disponible: no se pinta */ })
    return () => { alive = false }
    // onBlockedChange es estable a efectos prácticos (setter del padre).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId])

  if (!enabled) return null

  async function run(action: 'block' | 'unblock') {
    setBusy(true)
    setError(null)
    try {
      if (action === 'block') await blockUser(targetUserId)
      else await unblockUser(targetUserId)
      const next = action === 'block'
      setBlocked(next)
      setConfirming(false)
      setAnnounce(next ? t('blockedNotice') : t('unblockedNotice'))
      onBlockedChange(next)
      restore()
    } catch (err) {
      log.error('Failed to change block', { err })
      setError(action === 'block' ? t('blockError') : t('unblockError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Anuncio para lectores de pantalla del resultado (bloqueado / desbloqueado). */}
      <p role="status" className="sr-only">{announce}</p>
      {blocked ? (
        <>
          <p className="text-xs" style={{ color: F0.textSecondary }}>{t('blockedNotice')}</p>
          <KButton
            ref={triggerRef}
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => run('unblock')}
            className="rounded-full font-bold border-2"
            style={{ borderColor: F0.stroke, color: F0.textSecondary }}
          >
            {t('unblock')}
          </KButton>
          {error && <p role="alert" className="text-xs text-accent-danger">{error}</p>}
        </>
      ) : confirming ? (
        <InlineConfirm
          title={t('blockConfirmTitle')}
          body={t('blockConfirmBody')}
          confirmLabel={t('block')}
          cancelLabel={t('cancel')}
          loading={busy}
          error={error}
          onConfirm={() => run('block')}
          onCancel={() => {
            setConfirming(false)
            setError(null)
            restore()
          }}
        />
      ) : (
        <KButton
          ref={triggerRef}
          variant="secondary"
          size="sm"
          onClick={() => setConfirming(true)}
          className="text-xs text-text-tertiary hover:text-accent-danger hover:border-accent-danger"
        >
          {t('block')}
        </KButton>
      )}
    </div>
  )
}

export function FriendshipButton(props: FriendshipButtonProps) {
  const [blocked, setBlocked] = useState(false)
  // Una vez bloqueado, la amistad ya no existe: al desbloquear se parte de cero.
  const [wasBlocked, setWasBlocked] = useState(false)

  if (props.allowBlock === false) return <FriendshipAction {...props} />

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Con bloqueo no hay botón de amistad: bloquear ya la ha borrado. */}
      {!blocked && (
        <FriendshipAction
          key={wasBlocked ? 'reset' : 'initial'}
          targetUserId={props.targetUserId}
          initialStatus={wasBlocked ? 'none' : props.initialStatus}
          friendshipId={wasBlocked ? undefined : props.friendshipId}
        />
      )}
      <BlockControl
        targetUserId={props.targetUserId}
        onBlockedChange={(next) => {
          setBlocked(next)
          if (next) setWasBlocked(true)
        }}
      />
    </div>
  )
}

function FriendshipAction({
  initialStatus,
  targetUserId,
  friendshipId: initialFriendshipId,
}: FriendshipButtonProps) {
  const t = useTranslations('friends')
  const [status, setStatus] = useState<FriendshipStatusResult>(initialStatus)
  const [fId, setFId] = useState<string | undefined>(initialFriendshipId)
  const [loading, setLoading] = useState(false)

  async function handleSendRequest() {
    setLoading(true)
    try {
      await sendFriendRequest(targetUserId)
      setStatus('pending_sent')
    } catch (err) {
      log.error('Failed to send friend request', { err })
    } finally {
      setLoading(false)
    }
  }

  async function handleAccept() {
    if (!fId) return
    setLoading(true)
    try {
      await respondToFriendRequest(fId, 'accept')
      setStatus('accepted')
    } catch (err) {
      log.error('Failed to accept friend request', { err })
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    if (!fId) return
    setLoading(true)
    try {
      await removeFriend(fId)
      setStatus('none')
      setFId(undefined)
    } catch (err) {
      log.error('Failed to remove friend', { err })
    } finally {
      setLoading(false)
    }
  }

  if (status === 'none') {
    return (
      <KButton
        variant="primary"
        size="sm"
        loading={loading}
        onClick={handleSendRequest}
        className="rounded-full font-extrabold"
        style={{ background: F0.pink, color: F0.onPink }}
      >
        {t('addFriend')}
      </KButton>
    )
  }

  if (status === 'pending_sent') {
    return (
      <KButton
        variant="secondary"
        size="sm"
        disabled
        className="rounded-full font-bold border-2"
        style={{ borderColor: F0.stroke, color: F0.muted }}
      >
        {t('requestSent')}
      </KButton>
    )
  }

  if (status === 'pending_received') {
    return (
      <KButton
        variant="primary"
        size="sm"
        loading={loading}
        onClick={handleAccept}
        className="rounded-full font-extrabold"
        style={{ background: F0.pink, color: F0.onPink }}
      >
        {t('accept')}
      </KButton>
    )
  }

  // accepted — pill secundario estándar (sin color de "peligro": F0 no define
  // un matiz propio para eso entre los 6 acentos decorativos de DISENO.md).
  return (
    <KButton
      variant="secondary"
      size="sm"
      loading={loading}
      onClick={handleRemove}
      className="rounded-full font-bold border-2 hover:opacity-90"
      style={{ borderColor: F0.stroke, color: F0.textSecondary }}
    >
      {t('friends')} ✓
    </KButton>
  )
}
