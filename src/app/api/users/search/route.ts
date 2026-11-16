// ============================================================
// KULTURA — GET /api/users/search?q=username
// Busca usuarios por username (solo autenticados).
//
// Respuesta: `{ data: UserSearchResult[] }` o `{ error: { code } }`
// (saneamiento 7 y 9). Con menos de 2 caracteres, `{ data: [] }`.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { apiError, ok, rateLimit, requireUser } from '@/lib/api/route'
import { escapeLikePattern } from '@/lib/utils/escape-like'
import { createLogger } from '@/lib/logger'

const log = createLogger('users/search')

/** Longitud máxima de la consulta (un nombre de usuario no pasa de 30). */
const MAX_QUERY_LENGTH = 40

interface UserSearchResult {
  id: string
  username: string
  avatar_color: string
  avatar_initials: string
}

export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  // F-13 (D-21): por usuario y compartido entre instancias si hay Upstash.
  const limited = await rateLimit(request, { key: 'users_search', limit: LIMITS.users_search, userId: auth.user.id })
  if (limited) return limited

  const q = new URL(request.url).searchParams.get('q')?.trim().slice(0, MAX_QUERY_LENGTH)
  if (!q || q.length < 2) return ok<UserSearchResult[]>([])

  const { data, error } = await auth.supabase
    .from('users')
    .select('id, username, avatar_color, avatar_initials')
    .ilike('username', `%${escapeLikePattern(q)}%`)
    .neq('id', auth.user.id)
    .limit(8)

  if (error) {
    log.error(`búsqueda de usuarios: ${error.message}`)
    return apiError('internal')
  }
  return ok<UserSearchResult[]>(data ?? [])
}
