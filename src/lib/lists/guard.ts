// ============================================================
// KULTURA — Guardas comunes de /api/lists/[id]/* (saneamiento 6.2)
// Sesión, límite de peticiones y el id de la ruta (un id que no es uuid es
// una lista que no existe).
// ============================================================

import 'server-only'
import type { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { LIMITS } from '@/lib/rate-limit'
import { apiError, rateLimit, requireUser, type Supabase } from '@/lib/api/route'
import { uuidSchema } from '@/lib/api/contracts/common'

export type ListGuard =
  | { ok: true; user: User; supabase: Supabase; listId: string }
  | { ok: false; response: NextResponse }

export async function guardList(request: Request, params: Promise<{ id: string }>): Promise<ListGuard> {
  const auth = await requireUser()
  if (!auth.ok) return auth
  const limited = await rateLimit(request, { key: 'lists', limit: LIMITS.lists, userId: auth.user.id })
  if (limited) return { ok: false, response: limited }
  const { id } = await params
  if (!uuidSchema.safeParse(id).success) {
    return { ok: false, response: apiError('not_found', { message: 'List not found' }) }
  }
  return { ok: true, user: auth.user, supabase: auth.supabase, listId: id }
}
