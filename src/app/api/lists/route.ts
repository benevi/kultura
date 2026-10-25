// ============================================================
// KULTURA — Route Handler: /api/lists
// GET:    listar listas del usuario autenticado (con filtro ?mediaType=)
// POST:   crear una lista
// DELETE: eliminar una lista (solo el owner)
//
// F-25: con MIXED_LISTS=1 una lista puede ser `mixed` (varios formatos) y
// llevar descripción y plantilla («Franquicia», «Ranking personal»).
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { track } from '@/lib/analytics/track'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { createLogger } from '@/lib/logger'
import {
  LIST_COLUMNS_LEGACY,
  LIST_DESCRIPTION_MAX,
  LIST_NAME_MAX,
  LIST_TEMPLATES,
  isNotMigrated,
  listColumns,
  mixedListsEnabled,
  optionalText,
  validListTypes,
} from './shared'
import type { ListTemplate } from '@/types/list'

const log = createLogger('api/lists')

/** GET /api/lists — listar listas propias, opcionalmente filtradas por ?mediaType= */
export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const mediaType = searchParams.get('mediaType')
  const mixed = mixedListsEnabled()

  const run = (columns: string) => {
    let query = supabase
      .from('lists')
      .select(columns)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    // Una lista mixta admite cualquier formato: se ofrece siempre.
    if (mediaType && (validListTypes(mixed) as readonly string[]).includes(mediaType)) {
      query = mixed && mediaType !== 'mixed'
        ? query.in('media_type', [mediaType, 'mixed'])
        : query.eq('media_type', mediaType)
    }
    return query
  }

  let { data, error } = await run(listColumns(mixed))
  // Bandera encendida antes de aplicar la migración: columnas de siempre.
  if (error && mixed && isNotMigrated(error)) ({ data, error } = await run(LIST_COLUMNS_LEGACY))

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 })
  }

  return NextResponse.json({ lists: data ?? [] })
}

interface CreateBody {
  name?: unknown
  mediaType?: unknown
  isCollaborative?: unknown
  isPublic?: unknown
  description?: unknown
  template?: unknown
}

/** POST /api/lists — crear lista */
export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:lists`, LIMITS.lists)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: CreateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const mixed = mixedListsEnabled()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (name.length > LIST_NAME_MAX) {
    return NextResponse.json({ error: `name must be at most ${LIST_NAME_MAX} characters` }, { status: 400 })
  }
  const types = validListTypes(mixed)
  if (typeof body.mediaType !== 'string' || !(types as readonly string[]).includes(body.mediaType)) {
    return NextResponse.json(
      { error: `mediaType must be one of: ${types.join(', ')}` },
      { status: 400 }
    )
  }
  const mediaType = body.mediaType

  // Descripción y plantilla: solo con la bandera (sin ella, se ignoran).
  const description = mixed ? optionalText(body.description, LIST_DESCRIPTION_MAX) : { ok: true as const, value: undefined }
  if (!description.ok) {
    return NextResponse.json({ error: `description must be at most ${LIST_DESCRIPTION_MAX} characters` }, { status: 400 })
  }
  let template: ListTemplate | null = null
  if (mixed && body.template !== undefined && body.template !== null) {
    if (!(LIST_TEMPLATES as readonly unknown[]).includes(body.template)) {
      return NextResponse.json({ error: `template must be one of: ${LIST_TEMPLATES.join(', ')}` }, { status: 400 })
    }
    template = body.template as ListTemplate
  }

  // D-04c: privada salvo que se pida lo contrario al crearla.
  const isPublic = body.isPublic === true
  const base = {
    // Id propio: la fila se lee DESPUÉS, en otra petición. Con `insert …
    // returning` (`.insert().select()`) la RLS de SELECT se evalúa sobre la
    // fila nueva y can_read_list (STABLE) aún no la ve: fallaba siempre.
    id: crypto.randomUUID(),
    owner_id: user.id,
    name,
    media_type: mediaType,
    is_collaborative: body.isCollaborative === true,
    is_public: isPublic,
  }
  const extra = mixed
    ? {
        ...(description.value != null ? { description: description.value } : {}),
        ...(template ? { template } : {}),
      }
    : {}

  let { error: insertError } = await supabase.from('lists').insert({ ...base, ...extra })
  // Bandera antes de la migración: sin las columnas nuevas, se crea sin ellas.
  if (insertError && Object.keys(extra).length > 0 && isNotMigrated(insertError)) {
    ;({ error: insertError } = await supabase.from('lists').insert(base))
  }
  if (insertError) {
    // 23514: 'mixed' con el CHECK viejo (bandera encendida antes de migrar).
    if (insertError.code === '23514' && mediaType === 'mixed') {
      return NextResponse.json({ error: 'mixed_unavailable' }, { status: 409 })
    }
    log.error('create list failed', { code: insertError.code, message: insertError.message })
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 })
  }

  const read = (columns: string) => supabase.from('lists').select(columns).eq('id', base.id).maybeSingle()
  let { data, error: readError } = await read(listColumns(mixed))
  if (readError && mixed && isNotMigrated(readError)) ({ data, error: readError } = await read(LIST_COLUMNS_LEGACY))
  // Ya está creada: si la relectura fallase, se responde con lo insertado.
  const list = (data as Record<string, unknown> | null) ?? {
    ...base,
    ...extra,
    created_at: new Date().toISOString(),
  }

  // D-12: una lista que nace pública cuenta como "lista pública" del embudo.
  if (isPublic) {
    await track(user, 'list_made_public', { media_type: mediaType }, {
      dedupeKey: `list_made_public:${base.id}`,
    })
  }

  return NextResponse.json({ list }, { status: 201 })
}

/** DELETE /api/lists — eliminar lista */
export async function DELETE(request: Request): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const rl = checkRateLimit(`${user.id}:lists`, LIMITS.lists)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  let body: { listId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.listId) {
    return NextResponse.json({ error: 'listId is required' }, { status: 400 })
  }

  // Verificar que el usuario es el owner
  const { data: list } = await supabase
    .from('lists')
    .select('owner_id')
    .eq('id', body.listId)
    .maybeSingle()

  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }
  if (list.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: deleteError } = await supabase
    .from('lists')
    .delete()
    .eq('id', body.listId)

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
