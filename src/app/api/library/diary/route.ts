// ============================================================
// KULTURA — Route Handler: /api/library/diary (F-24)
// GET ?mediaId=…: escala (bandera + preferencia ½★ o /10) y apuntes del diario
//      de ese título (o los últimos, sin mediaId). Lo pide el diálogo de
//      biblioteca al abrirse.
// DELETE { id }: borra un apunte propio.
//
// Los apuntes nuevos se crean con POST /api/library (campo `log`), junto con
// la entrada: así nunca hay un apunte sin entrada (FK compuesta).
// Lógica en `lib/library/service.ts`; contrato en `lib/api/contracts/library.ts`.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { ok, parseBody, parseQuery, rateLimit, requireUser, respond } from '@/lib/api/route'
import { diaryDeleteSchema, diaryQuerySchema } from '@/lib/api/contracts/library'
import { readDiaryConfig, removeDiaryLog } from '@/lib/library/service'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  // Cupo propio: abrir fichas no gasta el de guardar ni al revés.
  const limited = await rateLimit(request, { key: 'library_diary', limit: LIMITS.library, userId: auth.user.id })
  if (limited) return limited
  const query = parseQuery(request, diaryQuerySchema)
  if (!query.ok) return query.response

  const result = await readDiaryConfig(auth.supabase, auth.user, query.value.mediaId)
  return result.ok ? ok(result.value, { headers: NO_STORE }) : respond(result)
}

export async function DELETE(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'library', limit: LIMITS.library, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, diaryDeleteSchema)
  if (!body.ok) return body.response

  return respond(await removeDiaryLog(auth.supabase, auth.user.id, body.value.id))
}
