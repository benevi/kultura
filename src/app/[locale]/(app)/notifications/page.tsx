// ============================================================
// KULTURA — /notifications (Server Component)
// Lista de notificaciones del usuario. Marca todas como leídas al cargar.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getNotifications, markAllRead } from '@/lib/social/notifications'
import { NotificationsList } from './NotificationsList'
import { getTranslations } from 'next-intl/server'
import { createLogger } from '@/lib/logger'
import type { Metadata } from 'next'

const log = createLogger('notifications')

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notifications')
  return { title: `${t('title')} · KULTURA` }
}

export default async function NotificationsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('notifications')

  let notifications: Awaited<ReturnType<typeof getNotifications>> = []
  let fetchError = false
  try {
    notifications = await getNotifications(user.id)
  } catch (e) {
    log.error('getNotifications failed', { err: e })
    fetchError = true
  }

  if (!fetchError) {
    markAllRead(user.id).catch((err) => log.error('markAllRead failed', { err }))
  }

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-14 pt-2 pb-14">
      <h1 className="font-display text-[34px] md:text-[42px] font-bold text-text-primary mb-7">
        {t('title')} <span aria-hidden="true">🔔</span>
      </h1>
      {fetchError ? (
        <div className="bg-surface-default rounded-[20px] p-10 text-center text-sm text-text-tertiary">
          {t('loadError')}
        </div>
      ) : (
        <NotificationsList notifications={notifications} />
      )}
    </main>
  )
}
