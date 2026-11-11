// ============================================================
// KULTURA — Servicio de POST /api/account/import/external (F-26, saneamiento 6.3)
//
// Un lote (≤ 50 filas) de un archivo de Letterboxd, MyAnimeList, Goodreads,
// IMDb o TV Time, ya leído en el navegador. Sin estado: cada lote empareja,
// crea las fichas que falten y escribe en la biblioteca del usuario de la
// SESIÓN; todo es idempotente, así que un corte se retoma reenviando.
// Los logs solo llevan recuentos: nada del archivo.
// ============================================================

import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'
import { success, failure, type ServiceResult } from '@/lib/api/result'
import { demoForbidden } from '@/lib/account/service'
import type { ApiLocale } from '@/lib/api/locale'
import { invalidateRecCache } from '@/lib/claude/recommendations'
import { invalidateMatchScoreCache } from '@/lib/recommendations/match-score'
import { splitImportItems } from '@/lib/import/validate'
import { processImportBatch } from '@/lib/import/server/process-batch'
import type { ImportBatchResponse, ImportItemResult, ImportSource } from '@/lib/import/types'

const log = createLogger('import/external')

export async function importExternalBatch(
  supabase: SupabaseClient,
  user: User,
  batch: { source: ImportSource; items: readonly unknown[] },
  opts: { locale: ApiLocale }
): Promise<ServiceResult<ImportBatchResponse>> {
  const demo = demoForbidden<ImportBatchResponse>(user)
  if (demo) return demo

  const { items, invalidKeys } = splitImportItems(batch.items)
  const started = Date.now()
  let processed: Awaited<ReturnType<typeof processImportBatch>> = {
    results: [],
    diaryImported: 0,
    wrote: false,
    providerCalls: 0,
  }
  try {
    if (items.length > 0) {
      processed = await processImportBatch(items, { supabase, userId: user.id, locale: opts.locale })
    }
  } catch (err) {
    log.error('Failed to import batch', { err, source: batch.source, count: items.length })
    return failure('internal', { message: 'Failed to import batch' })
  }

  if (processed.wrote) {
    // El perfil de gustos y las recomendaciones salen de la biblioteca.
    invalidateMatchScoreCache(user.id)
    invalidateRecCache(user.id)
  }

  const results: ImportItemResult[] = [
    ...processed.results,
    ...invalidKeys.map((key) => ({ key, outcome: 'invalid' as const })),
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

  return success({ results, diaryImported: processed.diaryImported })
}
