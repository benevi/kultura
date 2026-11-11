// ============================================================
// KULTURA — Route Handler: /api/account/import/external (F-26, D-15)
// POST: un lote (≤ 50 filas) de un archivo de otra app, ya leído en el
// navegador. La lógica está en `lib/import/server/service.ts`.
//
// Anti abuso: la demo no importa (403); límite de lotes por usuario
// compartido entre instancias; tope de bytes y filas por lote; presupuesto
// de peticiones a proveedores por lote (lo que no entra vuelve `pending`).
// ============================================================

import { parseBody, rateLimit, requireUser, respond } from '@/lib/api/route'
import { importBatchSchema } from '@/lib/api/contracts/account'
import { importExternalBatch } from '@/lib/import/server/service'
import { IMPORT_BATCH_LIMIT, MAX_BATCH_BYTES } from '@/lib/import/limits'
import { localeFromRequest } from '@/lib/media/request-locale'

/** Un lote cabe de sobra en el plazo propio (25 s); esto es solo el techo. */
export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'import_batch', limit: IMPORT_BATCH_LIMIT, userId: auth.user.id })
  if (limited) return limited
  const body = await parseBody(request, importBatchSchema, { maxBytes: MAX_BATCH_BYTES })
  if (!body.ok) return body.response

  const result = await importExternalBatch(auth.supabase, auth.user, body.value, {
    locale: localeFromRequest(request),
  })
  return respond(result, { headers: { 'Cache-Control': 'no-store' } })
}
