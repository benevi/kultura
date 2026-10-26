// ============================================================
// KULTURA — /notifications (Server Component)
// Lista de notificaciones del usuario. Marca todas como leídas al cargar.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { PageHeading } from '@/components/layout/PageHeading'
import { IconBell } from '@/components/icons'
import { redirect } from 'next/navigation'
import { getNotifications, markAllRead } from '@/lib/social/notifications'
import { NotificationsList } from './NotificationsList'
import { getTranslations } from 'next-intl/server'
import { createLogger } from '@/lib/logger'
import type { Metadata } from 'next'

const log = createLogger('notifications')

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notifications')
  return { title: `${t('title')}` }
}

export default async function NotificationsPage() {
  const supabase = await createClient()
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
    <main className="page-grid [&>*]:max-w-2xl py-8">
      <PageHeading icon={IconBell}>{t('title')}</PageHeading>
      {fetchError ? (
        <div className="bg-surface-default border border-surface-border rounded-bento p-10 text-center text-sm text-text-tertiary">
          {t('loadError')}
        </div>
      ) : (
        <NotificationsList notifications={notifications} />
      )}
    </main>
  )
}
