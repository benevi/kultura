// ============================================================
// KULTURA — Route Handler: /api/account/export/letterboxd (F-26)
// GET ?list=watched|watchlist → CSV en el formato de importación de
// Letterboxd (ver `src/lib/import/letterboxd-export.ts`), como descarga.
//
// Solo lee datos del propio usuario con su sesión (RLS). La demo también
// puede descargarlo: es una lectura. Límite: 5 por hora, como el JSON.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimitDistributed } from '@/lib/rate-limit'
import { getUserMedia } from '@/lib/library/queries'
import { isNotMigrated } from '@/lib/library/scale'
import { createLogger } from '@/lib/logger'
import { IMPORT_EXPORT_LIMIT } from '@/lib/import/limits'
import { buildLetterboxdCsv, type ExportLog, type LetterboxdExportList } from '@/lib/import/letterboxd-export'

const log = createLogger('api/account/export/letterboxd')

const PAGE = 1000
/** Techo: 20.000 apuntes de cine. */
const MAX_PAGES = 20

export async function GET(request: NextRequest): Promise<NextResponse> {
  const list: LetterboxdExportList = request.nextUrl.searchParams.get('list') === 'watchlist' ? 'watchlist' : 'watched'

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = await checkRateLimitDistributed(`${user.id}:export_letterboxd`, IMPORT_EXPORT_LIMIT)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  try {
    const library = (await getUserMedia(user.id)).filter((e) => e.mediaId.startsWith('movie_'))
    const logs: ExportLog[] = []
    if (list === 'watched') {
      // El diario (F-24) si existe; sin la migración, sin apuntes.
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE
        const { data, error } = await supabase
          .from('user_media_logs')
          .select('media_id, watched_on, rewatch, rating10, review')
          .eq('user_id', user.id)
          .like('media_id', 'movie_%')
          // Orden estable para paginar (dos apuntes del mismo día).
          .order('watched_on')
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) {
          if (isNotMigrated(error)) break
          throw new Error(`user_media_logs: ${error.code ?? ''}`)
        }
        const batch = (data ?? []) as Array<{ media_id: string; watched_on: string; rewatch: boolean; rating10: number | string | null; review: string | null }>
        for (const l of batch) {
          logs.push({
            mediaId: l.media_id,
            watchedOn: l.watched_on,
            rewatch: l.rewatch,
            rating10: l.rating10 === null ? null : Number(l.rating10),
            review: l.review,
          })
        }
        if (batch.length < PAGE) break
      }
    }

    const csv = buildLetterboxdCsv(
      list,
      library.map((e) => ({
        mediaId: e.mediaId,
        status: e.status,
        rating10: e.rating10 ?? null,
        watchedAt: e.watchedAt,
        title: e.title ?? null,
        year: e.year ?? null,
      })),
      logs
    )
    const date = new Date().toISOString().slice(0, 10)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kultura-letterboxd-${list}-${date}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    log.error('Failed to export Letterboxd CSV', { err })
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}
