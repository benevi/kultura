// ============================================================
// KULTURA — Route Handler: /api/account/export/letterboxd (F-26)
// GET ?list=watched|watchlist → CSV en el formato de importación de
// Letterboxd (ver `src/lib/import/letterboxd-export.ts`), como descarga.
//
// Solo lee datos del propio usuario con su sesión (RLS). La demo también
// puede descargarlo: es una lectura. Límite: 5 por hora, como el JSON.
// ============================================================

import { NextResponse } from 'next/server'
import { apiError, parseQuery, rateLimit, requireUser } from '@/lib/api/route'
import { letterboxdExportQuerySchema } from '@/lib/api/contracts/account'
import { buildLetterboxdExport } from '@/lib/account/export-service'
import { IMPORT_EXPORT_LIMIT } from '@/lib/import/limits'

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const limited = await rateLimit(request, { key: 'export_letterboxd', limit: IMPORT_EXPORT_LIMIT, userId: auth.user.id })
  if (limited) return limited
  const query = parseQuery(request, letterboxdExportQuerySchema)
  if (!query.ok) return query.response

  const result = await buildLetterboxdExport(auth.supabase, auth.user.id, query.value.list)
  if (!result.ok) return apiError(result.code, { message: result.message })
  return new NextResponse(result.value.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${result.value.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
