'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { Sparkles, List, UserPlus, Users, Bell } from 'lucide-react'
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
        className="px-3 py-1 text-xs font-semibold bg-accent-positive text-on-accent-positive rounded-full hover:brightness-110 transition-all disabled:opacity-50"
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

function NotificationItem({ notif }: { notif: AppNotification }) {
  const t = useTranslations('notifications')
  const locale = useLocale()
  const p = notif.payload

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

  return (
    <div className={`flex items-start gap-3 p-4 ${!notif.readAt ? 'bg-accent-positive/5' : ''}`}>
      <div className="flex-shrink-0 mt-0.5 text-text-tertiary">
        {notif.type === 'recommendation' ? (
          <Sparkles className="w-5 h-5 text-accent-info" />
        ) : notif.type === 'list_invite' ? (
          <List className="w-5 h-5" />
        ) : notif.type === 'group_invite' ? (
          <Users className="w-5 h-5" />
        ) : (
          <UserPlus className="w-5 h-5" />
        )}
      </div>
      {content}
      <span className="text-xs text-text-tertiary flex-shrink-0 mt-0.5">{relativeDate(notif.createdAt, locale)}</span>
    </div>
  )
}

export function NotificationsList({ notifications }: Props) {
  const t = useTranslations('notifications')

  if (notifications.length === 0) {
    return (
      <div className="bg-surface-default border border-surface-border rounded-xl p-10 text-center flex flex-col items-center gap-3">
        <Bell className="w-8 h-8 text-text-tertiary" />
        <p className="font-medium text-text-primary">{t('noNotifications')}</p>
        <p className="text-sm text-text-tertiary">{t('noNotificationsHint')}</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-default border border-surface-border rounded-xl divide-y divide-surface-border overflow-hidden">
      {notifications.map((n) => (
        <NotificationItem key={n.id} notif={n} />
      ))}
    </div>
  )
}
