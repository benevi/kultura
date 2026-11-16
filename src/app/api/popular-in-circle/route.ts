// ============================================================
// KULTURA — Route Handler: /api/popular-in-circle
// GET: títulos más populares entre los amigos del usuario.
//
// Respuesta: `{ data: CircleMediaItem[] }` o `{ error: { code } }`
// (saneamiento 7 y 9).
// ============================================================

import { ok, rateLimit, requireUser } from '@/lib/api/route'
import { getPopularInCircle } from '@/lib/social/circle'

const CIRCLE_LIMIT = { windowMs: 60_000, max: 20 }

/** GET /api/popular-in-circle */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'popular-in-circle', limit: CIRCLE_LIMIT, userId: auth.user.id })
  if (limited) return limited

  return ok(await getPopularInCircle(auth.user.id))
}
