// ============================================================
// KULTURA — Última vez que tocaste cada título (`user_media.updated_at`)
//
// La banda de cada hueco dice su estado y «hace N días» (DISENO.md). La
// columna existe desde el esquema inicial (disparador
// `user_media_set_updated_at`), pero el mapeo común de la biblioteca
// (`lib/library/queries.ts`) aún no la expone: hasta que lo haga, se lee
// aparte con una consulta ligera y se añade a cada entrada. Si falla, las
// bandas salen sin fecha (nunca con una inventada). Solo en el servidor.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import type { LibraryEntry } from '@/types/library'

export type TouchedEntry<T extends LibraryEntry = LibraryEntry> = T & { updatedAt?: string }

/** Añade `updatedAt` a las entradas que lo tengan (las demás, tal cual). */
export async function withTouchedAt<T extends LibraryEntry>(
  supabase: SupabaseClient,
  userId: string,
  entries: T[],
  mediaId?: string
): Promise<TouchedEntry<T>[]> {
  if (entries.length === 0) return entries
  if (entries.some((e) => (e as TouchedEntry<T>).updatedAt)) return entries
  try {
    let query = supabase.from('user_media').select('id, updated_at').eq('user_id', userId)
    if (mediaId) query = query.eq('media_id', mediaId)
    const { data, error } = await query
    if (error || !data) return entries
    const byId = new Map((data as { id: string; updated_at: string | null }[]).map((r) => [r.id, r.updated_at]))
    return entries.map((e) => {
      const at = byId.get(e.id)
      return at ? { ...e, updatedAt: at } : e
    })
  } catch {
    return entries
  }
}
