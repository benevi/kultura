// ============================================================
// KULTURA — GET /api/users/search?q=username
// Busca usuarios por username (solo autenticados)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimitDistributed, LIMITS } from '@/lib/rate-limit'

/**
 * Escapa los comodines de `LIKE` (`%`, `_`) y la barra: buscar "%" o "_" no
 * debe convertirse en "todos los usuarios" ni en un patrón caro.
 */
function escapeLikePattern(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Longitud máxima de la consulta (un nombre de usuario no pasa de 30). */
const MAX_QUERY_LENGTH = 40

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // F-13 (D-21): por usuario y compartido entre instancias si hay Upstash.
  const rl = await checkRateLimitDistributed(`users_search:${user.id}`, LIMITS.users_search)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds), 'Cache-Control': 'no-store' },
      }
    )
  }

  const q = req.nextUrl.searchParams.get('q')?.trim().slice(0, MAX_QUERY_LENGTH)
  if (!q || q.length < 2) return NextResponse.json({ users: [] })

  const { data } = await supabase
    .from('users')
    .select('id, username, avatar_color, avatar_initials')
    .ilike('username', `%${escapeLikePattern(q)}%`)
    .neq('id', user.id)
    .limit(8)

  return NextResponse.json({ users: data ?? [] })
}
