// ============================================================
// KULTURA — Notifications Queries (servidor)
// Helpers server-side para notificaciones del usuario.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { DbNotification } from '@/types/supabase'

export interface AppNotification {
  id: string
  type: 'recommendation' | 'list_invite' | 'group_invite'
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

function mapNotification(row: DbNotification): AppNotification {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, payload, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(`Failed to fetch notifications: ${error.message}`)

  return (data as DbNotification[]).map(mapNotification)
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)

  if (error) return 0

  return count ?? 0
}

export async function markAllRead(userId: string): Promise<void> {
  const supabase = createClient()

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
}

export async function markOneRead(notificationId: string, userId: string): Promise<void> {
  const supabase = createClient()

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .is('read_at', null)
}
