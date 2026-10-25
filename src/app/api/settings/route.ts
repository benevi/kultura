// ============================================================
// KULTURA — Route Handler: /api/settings
// GET:   devuelve el perfil del usuario (fila de `users`)
// PATCH: actualiza los campos enviados (validación Zod)
//
// La base solo deja actualizar con el JWT del usuario bio, avatar_icon,
// avatar_color, preferred_locale y (desde F-12) library_visibility. El nombre
// de usuario se cambia con el cliente admin, después de validar sesión,
// formato, nombres reservados y que no esté cogido (ni como nombre antiguo de
// otra persona, que sigue redirigiendo a ella); por eso aquí se corta a mano la
// cuenta demo, que el admin no frena.
//
// F-12 (onboarding): `accept_terms` y `onboarding_done` los guarda el servidor
// en `account_state` (o en `app_metadata` si la migración aún no está).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { isValidAvatarColor, isValidLocale } from '@/lib/constants/avatarColors'
import { isValidAvatarIcon } from '@/components/icons/avatars'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { DEMO_READ_ONLY_ERROR, isDemoUser } from '@/lib/demo'
import { LIBRARY_VISIBILITIES, USERNAME_REGEX, initialsFor, isReservedUsername } from './identity'
import {
  hasAcceptedTerms,
  isNotMigrated,
  markOnboarded,
  readAccountState,
  recordTermsAcceptance,
} from './account-state'

/** Tope de la bio: el mismo que el `maxLength` del editor (`ProfileBio`). */
const BIO_MAX_LENGTH = 200

const PatchSchema = z.object({
  username: z.string().regex(USERNAME_REGEX).optional(),
  avatar_color: z
    .string()
    .refine(isValidAvatarColor, { message: 'invalid_avatar_color' })
    .optional(),
  preferred_locale: z
    .string()
    .refine(isValidLocale, { message: 'invalid_locale' })
    .optional(),
  // E-AVATAR-ICONS: `null` es un valor VÁLIDO, no "no enviado" — es como se
  // vuelve a las iniciales tras haber elegido personaje.
  avatar_icon: z
    .string()
    .refine(isValidAvatarIcon, { message: 'invalid_avatar_icon' })
    .nullable()
    .optional(),
  // Vacía o solo espacios = sin bio (`null`).
  bio: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(BIO_MAX_LENGTH))
    .nullable()
    .optional(),
  library_visibility: z.enum(LIBRARY_VISIBILITIES).optional(),
  /** Paso 1 de /welcome (alta con Google): "tengo 14 años o más y acepto". */
  accept_terms: z.literal(true).optional(),
  /** Fin (o salto) del onboarding. */
  onboarding_done: z.literal(true).optional(),
})

/** Columnas que pueden no existir todavía (migración de F-12 sin aplicar). */
const OPTIONAL_COLUMNS = ['library_visibility'] as const

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:settings`, LIMITS.settings)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  if (isDemoUser(user)) {
    return NextResponse.json({ error: DEMO_READ_ONLY_ERROR }, { status: 403 })
  }

  const {
    avatar_color, preferred_locale, avatar_icon, bio, library_visibility,
    accept_terms, onboarding_done,
  } = parsed.data
  let { username } = parsed.data

  // El nombre que ya tiene no se revalida: un nombre antiguo que hoy estaría
  // reservado no puede impedir guardar el color o el idioma.
  if (username) {
    const { data: me } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
    if ((me as { username?: string } | null)?.username === username) username = undefined
  }

  if (username) {
    if (isReservedUsername(username)) {
      return NextResponse.json({ error: 'username_reserved' }, { status: 409 })
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'username_taken' }, { status: 409 })
    }
  }

  const updates: Record<string, string | null> = {}
  if (username !== undefined) updates.username = username
  if (avatar_color !== undefined) updates.avatar_color = avatar_color
  if (preferred_locale !== undefined) updates.preferred_locale = preferred_locale
  // `null` limpia el personaje y devuelve las iniciales — de ahí el check
  // contra `undefined` y no la comprobación de veracidad.
  if (avatar_icon !== undefined) updates.avatar_icon = avatar_icon
  if (bio !== undefined) updates.bio = bio ? bio : null
  if (library_visibility !== undefined) updates.library_visibility = library_visibility

  // SEG-7: el onboarding no se da por terminado (ni "saltado") sin haber
  // aceptado los términos, en esta misma petición o antes. Si no, quien entra
  // con Google se saltaría la casilla con "Saltar todo".
  if (onboarding_done && !accept_terms) {
    const { state } = await readAccountState(supabase, user.id)
    if (!hasAcceptedTerms(state, user)) {
      return NextResponse.json({ error: 'terms_required' }, { status: 409 })
    }
  }

  const needsAdmin = updates.username !== undefined || accept_terms || onboarding_done
  const admin = needsAdmin ? createAdminClient() : null

  // Un nombre antiguo de OTRA persona sigue redirigiendo a ella (308 desde
  // /u/<antiguo>): quedárselo secuestraría sus enlaces compartidos.
  if (admin && username) {
    const { data: previous, error: historyError } = await admin
      .from('username_history')
      .select('user_id')
      .eq('old_username', username)
      .maybeSingle()
    if (!historyError && previous && (previous as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: 'username_taken' }, { status: 409 })
    }
    updates.avatar_initials = initialsFor(username)
  }

  let updated: Record<string, unknown> | null = null
  const ignored: string[] = []

  if (Object.keys(updates).length > 0) {
    // Con username, todo el cambio va en una sola escritura admin (atómica);
    // sin él, con el JWT del usuario, que sigue pasando por RLS y por
    // demo_no_update.
    const writer = updates.username !== undefined && admin ? admin : supabase
    const write = (fields: Record<string, string | null>) =>
      writer.from('users').update(fields).eq('id', user.id).select('*').single()

    let { data, error: updateError } = await write(updates)

    // Migración de F-12 sin aplicar: la columna nueva no existe. Se guarda el
    // resto y se avisa de lo que no se pudo (el selector ni se enseña).
    if (updateError && isNotMigrated(updateError)) {
      const rest = { ...updates }
      for (const column of OPTIONAL_COLUMNS) {
        if (column in rest) {
          delete rest[column]
          ignored.push(column)
        }
      }
      if (Object.keys(rest).length > 0 && ignored.length > 0) {
        ;({ data, error: updateError } = await write(rest))
      } else if (ignored.length > 0) {
        data = {}
        updateError = null
      }
    }

    // 23505: otro usuario se quedó el nombre entre la comprobación y la
    // escritura (o solo difiere en mayúsculas). 23514: CHECK de la base.
    if (updateError?.code === '23505') {
      return NextResponse.json({ error: 'username_taken' }, { status: 409 })
    }
    if (updateError?.code === '23514') {
      return NextResponse.json({ error: 'username_reserved' }, { status: 409 })
    }
    if (updateError || !data) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }
    updated = data as Record<string, unknown>
  }

  if (admin && accept_terms) {
    const ok = await recordTermsAcceptance(admin, user)
    if (!ok) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
  if (admin && onboarding_done) {
    const ok = await markOnboarded(admin, user)
    if (!ok) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    updated: updated ?? {},
    ...(ignored.length > 0 ? { ignored } : {}),
  })
}
