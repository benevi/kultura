// ============================================================
// KULTURA — Route Handler: /api/account/import/external (F-26, D-15)
// POST: un lote (≤ 50 filas) de un archivo de Letterboxd, MyAnimeList,
// Goodreads, IMDb o TV Time, ya leído en el navegador.
//
// El navegador manda el archivo troceado y enseña el progreso; si se corta,
// se retoma por donde iba (todo es idempotente: reimportar no duplica ni pisa
// nada). Por eso la ruta no guarda estado: cada lote empareja, crea las
// fichas que falten y escribe en la biblioteca del usuario de la SESIÓN.
//
// Anti abuso: la demo no importa (403, como el resto de escrituras); límite
// de lotes por usuario compartido entre instancias; tope de bytes y filas
// por lote; presupuesto de peticiones a proveedores por lote (lo que no
// entra vuelve `pending`). Los logs solo llevan recuentos: nada del archivo.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimitDistributed } from '@/lib/rate-limit'
import { DEMO_READ_ONLY_ERROR, isDemoUser } from '@/lib/demo'
import { invalidateRecCache } from '@/lib/claude/recommendations'
import { invalidateMatchScoreCache } from '@/lib/recommendations/match-score'
import { createLogger } from '@/lib/logger'
import { localeFromRequest } from '@/lib/media/request-locale'
import { IMPORT_BATCH_LIMIT, MAX_BATCH_BYTES } from '@/lib/import/limits'
import { parseImportBatch } from '@/lib/import/validate'
import { processImportBatch } from '@/lib/import/server/process-batch'
import type { ImportBatchResponse, ImportItemResult } from '@/lib/import/types'

const log = createLogger('api/account/import/external')

/** Un lote cabe de sobra en el plazo propio (25 s); esto es solo el techo. */
export const maxDuration = 60

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  // El middleware ya rechaza las escrituras de la demo; esto lo hace explícito.
  if (isDemoUser(user)) {
    return NextResponse.json({ error: DEMO_READ_ONLY_ERROR }, { status: 403 })
  }

  const rl = await checkRateLimitDistributed(`${user.id}:import_batch`, IMPORT_BATCH_LIMIT)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BATCH_BYTES) {
    return NextResponse.json({ error: 'Batch too large' }, { status: 413 })
  }
  let body: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BATCH_BYTES) {
      return NextResponse.json({ error: 'Batch too large' }, { status: 413 })
    }
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const batch = parseImportBatch(body)
  if (!batch.ok) return NextResponse.json({ error: batch.error }, { status: 400 })

  const started = Date.now()
  let processed: Awaited<ReturnType<typeof processImportBatch>> = {
    results: [],
    diaryImported: 0,
    wrote: false,
    providerCalls: 0,
  }
  try {
    if (batch.items.length > 0) {
      processed = await processImportBatch(batch.items, {
        supabase,
        userId: user.id,
        locale: localeFromRequest(request),
      })
    }
  } catch (err) {
    log.error('Failed to import batch', { err, source: batch.source, count: batch.items.length })
    return NextResponse.json({ error: 'Failed to import batch' }, { status: 500 })
  }

  if (processed.wrote) {
    // El perfil de gustos y las recomendaciones salen de la biblioteca.
    invalidateMatchScoreCache(user.id)
    invalidateRecCache(user.id)
  }

  const results: ImportItemResult[] = [
    ...processed.results,
    ...batch.invalidKeys.map((key) => ({ key, outcome: 'invalid' as const })),
  ]
  const counts: Record<string, number> = {}
  for (const r of results) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1
  log.info('lote importado', {
    source: batch.source,
    items: results.length,
    ...counts,
    diary: processed.diaryImported,
    providerCalls: processed.providerCalls,
    ms: Date.now() - started,
  })

  const response: ImportBatchResponse = { results, diaryImported: processed.diaryImported }
  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
}
