// ============================================================
// KULTURA — Exportaciones de la cuenta (saneamiento 6.3)
//
// - JSON (D3, arts. 15 y 20 RGPD): TODOS los datos del usuario. Biblioteca,
//   listas y amistades reusan las queries de sus pantallas; el resto lo junta
//   `export-collect.ts`.
// - CSV de Letterboxd (F-26): cine visto (con el diario) o pendiente.
//
// Devuelven el contenido; la ruta lo manda como descarga.
// ============================================================

import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { failure, success, type ServiceResult } from '@/lib/api/result'
import { getUserMedia } from '@/lib/library/queries'
import { getUserLists, getListDetail } from '@/lib/social/lists'
import { getFriends } from '@/lib/social/friends'
import { readRatingScale } from '@/lib/library/scale'
import { collectExportSections } from '@/lib/account/export-collect'
import { buildLetterboxdCsv, type ExportLog, type LetterboxdExportList } from '@/lib/import/letterboxd-export'

const log = createLogger('account/export')

/**
 * El fichero JSON del export. Un fallo de la base es `internal`: el usuario
 * no debe quedarse con un fichero a medias creyendo que está completo.
 */
export async function buildAccountExport(supabase: SupabaseClient, user: User): Promise<ServiceResult<Record<string, unknown>>> {
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('username, bio, avatar_color, avatar_icon, avatar_initials, preferred_locale, created_at')
    .eq('id', user.id)
    .single()
  if (profileError || !profile) {
    log.error('Failed to fetch profile for export', { err: profileError, userId: user.id })
    return failure('internal', { message: 'Failed to export data' })
  }

  try {
    const [library, lists, friendships, sections] = await Promise.all([
      getUserMedia(user.id),
      getUserLists(user.id),
      getFriends(user.id),
      collectExportSections(createAdminClient(), user.id),
    ])

    // `getUserLists` no trae el CONTENIDO de cada lista: sin esto, la
    // reimportación no podría reconstruirlas. Solo las propias: las de otros
    // no son del usuario y volverían a estar ahí al recuperar su cuenta.
    const ownedLists = lists.filter((list) => list.owner?.id === user.id)
    const listItems = await Promise.all(
      ownedLists.map(async (list) => {
        const detail = await getListDetail(list.id).catch(() => null)
        return [list.id, detail?.items.map((item) => item.mediaId) ?? []] as const
      })
    )
    const itemsByList = new Map(listItems)

    return success({
      exportedAt: new Date().toISOString(),
      profile: { email: user.email, ...profile },
      library,
      // F-24: cómo ve sus notas (½★ o /10). Las notas van en `library[].rating10`.
      libraryPreferences: { ratingScale: readRatingScale(user) },
      lists: lists.map((list) => ({ ...list, items: itemsByList.get(list.id) ?? [] })),
      friendships,
      ...sections,
    })
  } catch (err) {
    log.error('Failed to export account data', { err, userId: user.id })
    return failure('internal', { message: 'Failed to export data' })
  }
}

const PAGE = 1000
/** Techo: 20.000 apuntes de cine. */
const MAX_PAGES = 20

/** CSV en el formato de importación de Letterboxd, con su nombre de fichero. */
export async function buildLetterboxdExport(
  supabase: SupabaseClient,
  userId: string,
  list: LetterboxdExportList
): Promise<ServiceResult<{ csv: string; filename: string }>> {
  try {
    const library = (await getUserMedia(userId)).filter((e) => e.mediaId.startsWith('movie_'))
    const logs: ExportLog[] = []
    if (list === 'watched') {
      // El diario (F-24): los apuntes de user_media_logs.
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE
        const { data, error } = await supabase
          .from('user_media_logs')
          .select('media_id, watched_on, rewatch, rating10, review')
          .eq('user_id', userId)
          .like('media_id', 'movie_%')
          // Orden estable para paginar (dos apuntes del mismo día).
          .order('watched_on')
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw new Error(`user_media_logs: ${error.code ?? ''}`)
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
    return success({ csv, filename: `kultura-letterboxd-${list}-${date}.csv` })
  } catch (err) {
    log.error('Failed to export Letterboxd CSV', { err })
    return failure('internal', { message: 'Failed to export data' })
  }
}
