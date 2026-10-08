'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { IconSparkles, IconLists, IconUserPlus, IconGroups, IconBell } from '@/components/icons'
import { useToastContext } from '@/components/ui/ToastProvider'
import type { AppNotification } from '@/lib/social/notifications'

interface Props {
  notifications: AppNotification[]
}

function relativeDate(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return rtf.format(-mins, 'minute')
  const hours = Math.floor(mins / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 30) return rtf.format(-days, 'day')
  const months = Math.floor(days / 30)
  if (months < 12) return rtf.format(-months, 'month')
  return rtf.format(-Math.floor(months / 12), 'year')
}

function InviteActions({ invitationId }: { invitationId: string }) {
  const t = useTranslations('notifications')
  const router = useRouter()
  const { show } = useToastContext()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function respond(action: 'accept' | 'reject') {
    setLoading(true)
    try {
      const res = await fetch(`/api/groups/invitations/${invitationId}`, {
        method: action === 'accept' ? 'PATCH' : 'DELETE',
      })
      if (!res.ok) {
        show({ message: t('inviteActionError'), type: 'error' })
        setLoading(false)
        return
      }
      show({
        message: action === 'accept' ? t('inviteAccepted') : t('inviteRejected'),
        type: 'success',
      })
      setDone(true)
      router.refresh()
    } catch {
      show({ message: t('inviteActionError'), type: 'error' })
      setLoading(false)
    }
  }

  if (done) return null

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={() => respond('accept')}
        disabled={loading}
        className="px-3 py-1 text-xs font-semibold bg-accent-pink text-on-accent-pink rounded-full hover:brightness-110 transition-all disabled:opacity-50"
      >
        {t('accept')}
      </button>
      <button
        onClick={() => respond('reject')}
        disabled={loading}
        className="px-3 py-1 text-xs font-semibold bg-surface2 text-muted rounded-full hover:bg-accent-danger/10 hover:text-accent-danger transition-colors disabled:opacity-50"
      >
        {t('reject')}
      </button>
    </div>
  )
}

/** Color del icono por tipo: acentos decorativos de la paleta F0 (tokens). */
const TYPE_ACCENT: Record<string, { fg: string }> = {
  recommendation: { fg: 'var(--accent-blue)' },
  list_invite: { fg: 'var(--accent-lime)' },
  group_invite: { fg: 'var(--accent-orange)' },
  friend_request: { fg: 'var(--accent-purple)' },
}

function NotificationItem({ notif }: { notif: AppNotification }) {
  const t = useTranslations('notifications')
  const locale = useLocale()
  const p = notif.payload
  const accent = TYPE_ACCENT[notif.type] ?? TYPE_ACCENT.friend_request

  let content: React.ReactNode = null

  if (notif.type === 'recommendation') {
    const fromUsername = p.fromUsername as string | undefined
    const mediaTitle = p.mediaTitle as string | undefined
    const mediaId = p.mediaId as string | undefined
    const message = p.message as string | undefined
    const mediaType = mediaId?.split('_')[0] ?? null
    const mediaExternalId = mediaId?.split('_').slice(1).join('_') ?? null
    content = (
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary">
          {fromUsername ? (
            <Link href={`/profile/${fromUsername}`} className="font-medium hover:text-accent-info transition-colors">
              {fromUsername}
            </Link>
          ) : null}
          {' '}{t('recommendedYou')}{' '}
          {mediaType && mediaExternalId && mediaTitle ? (
            <Link href={`/media/${mediaType}/${mediaExternalId}`} className="font-medium hover:text-accent-info transition-colors">
              {mediaTitle}
            </Link>
          ) : (mediaTitle ?? null)}
        </p>
        {message && (
          <p className="text-xs text-text-tertiary mt-0.5 truncate">&ldquo;{message}&rdquo;</p>
        )}
      </div>
    )
  } else if (notif.type === 'list_invite') {
    const fromUsername = p.fromUsername as string | undefined
    const listName = p.listName as string | undefined
    const listId = p.listId as string | undefined
    content = (
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary">
          {fromUsername ? (
            <Link href={`/profile/${fromUsername}`} className="font-medium hover:text-accent-info transition-colors">
              {fromUsername}
            </Link>
          ) : null}
          {' '}{t('invitedYou')}{' '}
          {listId && listName ? (
            <Link href={`/lists/${listId}`} className="font-medium hover:text-accent-info transition-colors">
              {listName}
            </Link>
          ) : (listName ?? null)}
        </p>
      </div>
    )
  } else if (notif.type === 'group_invite') {
    const fromUsername = p.fromUsername as string | undefined
    const groupName = p.groupName as string | undefined
    const groupId = p.groupId as string | undefined
    const invitationId = p.invitationId as string | undefined
    content = (
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary">
          {fromUsername ? (
            <Link href={`/profile/${fromUsername}`} className="font-medium hover:text-accent-info transition-colors">
              {fromUsername}
            </Link>
          ) : null}
          {' '}{t('groupInvite')}{' '}
          {groupId && groupName ? (
            <Link href={`/groups/${groupId}`} className="font-medium hover:text-accent-info transition-colors">
              {groupName}
            </Link>
          ) : (groupName ?? null)}
        </p>
        {invitationId && !notif.readAt && <InviteActions invitationId={invitationId} />}
      </div>
    )
  }

  const unread = !notif.readAt

  // Artboard: filas SUELTAS (gap 10, radio 18), fondo --surface si NO está
  // leída y transparente si lo está, punto pink de 8px a la derecha. Antes era
  // una tarjeta única con divide-y y el "no leída" en tinte verde.
  return (
    <li
      className={`flex items-center gap-4 rounded-18 px-5 py-4 ${unread ? 'bg-surface-default' : 'bg-transparent'}`}
    >
      <div
        className="flex-shrink-0 w-[42px] h-[42px] rounded-[14px] bg-surface-elevated flex items-center justify-center"
        style={{ color: accent.fg }}
      >
        {notif.type === 'recommendation' ? (
          <IconSparkles className="w-5 h-5" />
        ) : notif.type === 'list_invite' ? (
          <IconLists className="w-5 h-5" />
        ) : notif.type === 'group_invite' ? (
          <IconGroups className="w-5 h-5" />
        ) : (
          <IconUserPlus className="w-5 h-5" />
        )}
      </div>
      {content}
      <span className="text-xs text-text-tertiary flex-shrink-0 whitespace-nowrap">{relativeDate(notif.createdAt, locale)}</span>
      {unread && (
        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-accent-pink">
          <span className="sr-only">{t('unread')}</span>
        </span>
      )}
    </li>
  )
}

export function NotificationsList({ notifications }: Props) {
  const t = useTranslations('notifications')

  if (notifications.length === 0) {
    return (
      <div className="bg-surface-default rounded-18 p-10 text-center flex flex-col items-center gap-3 max-w-[720px]">
        <IconBell className="w-8 h-8 text-text-tertiary" />
        <p className="font-bold text-text-primary">{t('noNotifications')}</p>
        <p className="text-sm text-text-tertiary">{t('noNotificationsHint')}</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2.5 max-w-[720px]">
      {notifications.map((n) => (
        <NotificationItem key={n.id} notif={n} />
      ))}
    </ul>
  )
}
