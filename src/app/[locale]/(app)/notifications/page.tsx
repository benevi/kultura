// ============================================================
// KULTURA — /notifications (Server Component)
// Lista de notificaciones del usuario. Marca todas como leídas al cargar.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getNotifications, markAllRead } from '@/lib/social/notifications'
import { NotificationsList } from './NotificationsList'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

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
    console.error('[notifications] getNotifications failed:', e)
    fetchError = true
  }

  if (!fetchError) {
    markAllRead(user.id).catch((err) => console.error('markAllRead failed:', err))
  }

  return (
    <main className="max-w-2xl mx-auto px-4 md:px-8 py-8">
      <h1 className="font-display text-3xl mb-8">{t('title')}</h1>
      {fetchError ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center text-sm text-muted">
          {t('loadError')}
        </div>
      ) : (
        <NotificationsList notifications={notifications} />
      )}
    </main>
  )
}
