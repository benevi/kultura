// ============================================================
// KULTURA — Route Handler: /api/account
// DELETE: elimina la cuenta del usuario autenticado (D2)
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/account')

/**
 * DELETE /api/account — borra la cuenta del usuario autenticado.
 *
 * Borra la fila de `auth.users` vía el admin client (service-role). El
 * esquema tiene `public.users.id` con `ON DELETE CASCADE` hacia
 * `auth.users(id)`, y el resto de tablas (user_media, friendships, lists,
 * list_members, groups, group_members, group_posts, group_invitations,
 * messages, conversation_members, notifications, recommendations, reports)
 * cascadean a su vez desde `public.users(id)` — un solo delete basta.
 * `list_items.added_by` y `suggestions.user_id` son `ON DELETE SET NULL`
 * (conservan el registro sin el autor), comportamiento intencional del
 * esquema, no algo que este endpoint deba corregir.
 */
export async function DELETE(): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:account_delete`, LIMITS.account_delete)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const admin = createAdminClient()
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)

  if (deleteError) {
    log.error('Failed to delete account', { err: deleteError, userId: user.id })
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
