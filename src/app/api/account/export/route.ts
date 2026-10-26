// ============================================================
// KULTURA — Route Handler: /api/account/export
// GET: exporta los datos del usuario autenticado en JSON (D3)
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { getUserMedia } from '@/lib/library/queries'
import { getUserLists, getListDetail } from '@/lib/social/lists'
import { getFriends } from '@/lib/social/friends'
import { createLogger } from '@/lib/logger'
import { collectExportSections } from './collect'
import { readRatingScale } from '@/lib/library/scale'
import { jsonStream } from '@/lib/utils/json-stream'

const log = createLogger('api/account/export')

/**
 * GET /api/account/export — exporta TODOS los datos del usuario autenticado
 * (arts. 15 y 20 RGPD): perfil, biblioteca, listas, amistades y, desde SEG-8,
 * mensajes enviados y recibidos (en las conversaciones de las que sigue siendo
 * miembro), conversaciones, posts, grupos, invitaciones, recomendaciones,
 * sugerencias, notificaciones, denuncias, diario y dispositivos con avisos push
 * (ver `collect.ts`).
 * Biblioteca, listas y amistades reusan las queries de sus pantallas.
 */
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:account_export`, LIMITS.account_export)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('username, bio, avatar_color, avatar_icon, avatar_initials, preferred_locale, created_at')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    log.error('Failed to fetch profile for export', { err: profileError, userId: user.id })
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }

  try {
    const [library, lists, friendships, sections] = await Promise.all([
      getUserMedia(user.id),
      getUserLists(user.id),
      getFriends(user.id),
      collectExportSections(createAdminClient(), user.id),
    ])

    // `getUserLists` no trae el CONTENIDO de cada lista, así que un export sin
    // esto devolvía listas vacías y la reimportación no podía reconstruirlas
    // (ver /api/account/import). Solo las propias: las de otros no son del
    // usuario y volverían a estar ahí al recuperar su cuenta.
    const ownedLists = lists.filter((list) => list.owner?.id === user.id)
    const listItems = await Promise.all(
      ownedLists.map(async (list) => {
        const detail = await getListDetail(list.id).catch(() => null)
        return [list.id, detail?.items.map((item) => item.mediaId) ?? []] as const
      })
    )
    const itemsByList = new Map(listItems)

    // En streaming: una cuenta con mucha actividad pasa de 4,5 MB, el tope de
    // Vercel para una respuesta de una pieza. Los datos ya están leídos (un
    // fallo de la base sigue siendo un 500), solo se envían por trozos.
    return new NextResponse(jsonStream({
      exportedAt: new Date().toISOString(),
      profile: { email: user.email, ...profile },
      library,
      // F-24: cómo ve sus notas (½★ o /10). Las notas van en `library[].rating10`.
      libraryPreferences: { ratingScale: readRatingScale(user) },
      lists: lists.map((list) => ({ ...list, items: itemsByList.get(list.id) ?? [] })),
      friendships,
      ...sections,
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    log.error('Failed to export account data', { err, userId: user.id })
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}
