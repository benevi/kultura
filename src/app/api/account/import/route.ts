// ============================================================
// KULTURA — Route Handler: /api/account/import
// POST: reimporta el JSON que genera /api/account/export. La lógica (y sus
// criterios: idempotente, siempre para el usuario de la sesión, sin escribir
// el catálogo con el fichero…) está en `lib/account/import-service.ts`.
// ============================================================

import { LIMITS } from '@/lib/rate-limit'
import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { KULTURA_IMPORT_MAX_BYTES, kulturaImportSchema } from '@/lib/api/contracts/account'
import { importKulturaExport } from '@/lib/account/import-service'
import { localeFromRequest } from '@/lib/media/request-locale'

/** Una biblioteca grande con su diario necesita más que una petición normal. */
export const maxDuration = 120

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'account_import', limit: LIMITS.account_import, userId: auth.user.id })
  if (limited) return limited
  // Sin `library` no es un export de Kultura: `invalid_input` con `field: 'library'`.
  const body = await parseBody(request, kulturaImportSchema, { maxBytes: KULTURA_IMPORT_MAX_BYTES })
  if (!body.ok) return body.response

  return respond(
    await importKulturaExport(auth.supabase, auth.user.id, body.value, { locale: localeFromRequest(request) })
  )
}
