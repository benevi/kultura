// ============================================================
// KULTURA — Route Handler: /api/settings
// PATCH: actualiza los campos enviados del perfil (y el onboarding, F-12).
// La lógica está en `lib/settings/service.ts`.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { settingsPatchSchema } from '@/lib/api/contracts/settings'
import { updateSettings } from '@/lib/settings/service'

export async function PATCH(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'settings', limit: LIMITS.settings, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, settingsPatchSchema)
  if (!body.ok) return body.response
  return respond(await updateSettings(auth.supabase, auth.user, body.value))
}
