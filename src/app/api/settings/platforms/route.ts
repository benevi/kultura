// ============================================================
// KULTURA — Route Handler: /api/settings/platforms (saneamiento 9.2)
// PUT: guarda «Mis plataformas» (lista completa y región).
// La lógica está en `lib/settings/service.ts`.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { platformsPutSchema } from '@/lib/api/contracts/settings'
import { updatePlatforms } from '@/lib/settings/service'

export async function PUT(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, {
    key: 'settings_platforms',
    limit: LIMITS.settings_platforms,
    userId: auth.user.id,
  })
  if (limited) return limited
  const body = await parseBody(request, platformsPutSchema)
  if (!body.ok) return body.response
  return respond(await updatePlatforms(auth.supabase, auth.user, body.value))
}
