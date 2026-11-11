// ============================================================
// KULTURA — Route Handler: /api/account/export
// GET: exporta los datos del usuario autenticado en JSON (D3). Es una
// descarga: el cuerpo es el fichero (sin `{ data }`); los errores sí van con
// `{ error: { code } }`.
// ============================================================

import { NextResponse } from 'next/server'
import { LIMITS } from '@/lib/rate-limit'
import { apiError, rateLimit, requireUser } from '@/lib/api/route'
import { buildAccountExport } from '@/lib/account/export-service'
import { jsonStream } from '@/lib/utils/json-stream'

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'account_export', limit: LIMITS.account_export, userId: auth.user.id })
  if (limited) return limited

  const result = await buildAccountExport(auth.supabase, auth.user)
  if (!result.ok) return apiError(result.code, { message: result.message })

  // En streaming: una cuenta con mucha actividad pasa de 4,5 MB, el tope de
  // Vercel para una respuesta de una pieza. Los datos ya están leídos (un
  // fallo de la base sigue siendo un 500), solo se envían por trozos.
  return new NextResponse(jsonStream(result.value), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
