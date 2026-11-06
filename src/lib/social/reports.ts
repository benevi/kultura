// ============================================================
// KULTURA — Lógica común de denuncias (/api/reports y /api/reports/public)
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  LEGACY_REPORT_TARGET_TYPES,
  PUBLIC_REPORT_TARGET_TYPES,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  REPORT_TARGET_TYPES,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/social/actions'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MEDIA_ID_RE = /^(movie|tv|anime|book|comic|manga|game)_[^\s/?#]{1,150}$/
const USERNAME_RE = /^[A-Za-z0-9_.-]{2,40}$/

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** Tipos admitidos según la bandera y el canal (con sesión o formulario público). */
export function allowedTargetTypes(moderationV2: boolean, channel: 'app' | 'public'): readonly ReportTargetType[] {
  const base = moderationV2 ? REPORT_TARGET_TYPES : LEGACY_REPORT_TARGET_TYPES
  return channel === 'public' ? base.filter((t) => PUBLIC_REPORT_TARGET_TYPES.includes(t)) : base
}

/**
 * Cuerpo de la denuncia con sesión. `reason` acepta también un texto libre
 * (el botón antiguo mandaba solo eso): se guarda como motivo `other`.
 */
export const AppReportSchema = z.object({
  targetType: z.string(),
  targetId: z.string().trim().min(1).max(200),
  reason: z.string().trim().max(REPORT_DETAILS_MAX).optional(),
  details: z.string().trim().max(REPORT_DETAILS_MAX).optional(),
})

export const PublicReportSchema = z.object({
  targetType: z.string(),
  target: z.string().trim().min(1).max(500),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().min(10).max(REPORT_DETAILS_MAX),
  contactEmail: z.string().trim().email().max(254),
  goodFaith: z.literal(true),
  /** Trampa para bots: un campo oculto que una persona deja vacío. */
  website: z.string().optional(),
})

export function normalizeReason(raw: string | undefined, details: string | undefined): {
  reason: ReportReason
  details: string | null
} {
  const isKnown = (REPORT_REASONS as readonly string[]).includes(raw ?? '')
  if (isKnown) return { reason: raw as ReportReason, details: details?.trim() || null }
  // Texto libre del botón antiguo → motivo "other" con ese texto como detalle.
  const free = [raw, details].filter((s) => s && s.trim()).join(' · ').trim()
  return { reason: 'other', details: free || null }
}

/** Lo que se guarda en `reports.reason` (columna de texto que ya existe). */
export function storedReason(reason: ReportReason, details: string | null): string {
  return details ? `${reason}: ${details}` : reason
}

export type TargetCheck =
  | { ok: true; targetId: string }
  | { ok: false; status: 400 | 404; error: string }

/**
 * Comprueba que el contenido existe y que quien denuncia puede verlo, con SU
 * cliente (RLS): un mensaje solo lo ve un miembro de la conversación, un post
 * solo un miembro del grupo, un grupo privado solo sus miembros.
 * La ficha no se busca en `media` (solo existe si alguien la añadió): basta
 * con que el id tenga la forma `<tipo>_<id del proveedor>`.
 */
export async function checkTargetAsUser(
  supabase: SupabaseClient,
  type: ReportTargetType,
  targetId: string,
): Promise<TargetCheck> {
  if (type === 'media') {
    return MEDIA_ID_RE.test(targetId) ? { ok: true, targetId } : { ok: false, status: 400, error: 'invalid_target' }
  }
  if (!isUuid(targetId)) return { ok: false, status: 400, error: 'invalid_target' }

  const table = {
    user: 'users',
    message: 'messages',
    group_post: 'group_posts',
    group: 'groups',
    list: 'lists',
  }[type]

  const { data } = await supabase.from(table).select('id').eq('id', targetId).maybeSingle()
  return data ? { ok: true, targetId } : { ok: false, status: 404, error: 'target_not_found' }
}

/** Quita el prefijo de idioma (/es, /en) de una ruta de KULTURA y la parte en segmentos. */
function pathSegments(raw: string): string[] | null {
  let path: string
  try {
    path = /^https?:\/\//i.test(raw) ? new URL(raw).pathname : raw.startsWith('/') ? raw : ''
  } catch {
    return null
  }
  if (!path) return null
  const segments = path.split('/').filter(Boolean).map((s) => decodeURIComponent(s))
  if (segments[0] === 'es' || segments[0] === 'en') segments.shift()
  return segments
}

export type PublicTarget =
  | { kind: 'id'; value: string }
  | { kind: 'username'; value: string }

/**
 * Lo que pega alguien sin cuenta: un enlace de KULTURA, un id o un nombre de
 * usuario. Devuelve qué buscar, o null si no se entiende.
 */
export function parsePublicTarget(type: ReportTargetType, raw: string): PublicTarget | null {
  const value = raw.trim()
  const segments = pathSegments(value)

  if (segments) {
    if (type === 'user' && (segments[0] === 'u' || segments[0] === 'profile') && segments[1]) {
      return USERNAME_RE.test(segments[1]) ? { kind: 'username', value: segments[1] } : null
    }
    if (type === 'media' && segments[0] === 'media' && segments[1] && segments[2]) {
      const id = `${segments[1]}_${segments[2]}`
      return MEDIA_ID_RE.test(id) ? { kind: 'id', value: id } : null
    }
    if (type === 'list') {
      // /u/<usuario>/l/<id> (lista pública) o /lists/<id>
      const id = segments[0] === 'u' && segments[2] === 'l' ? segments[3] : segments[0] === 'lists' ? segments[1] : undefined
      return id && isUuid(id) ? { kind: 'id', value: id } : null
    }
    return null
  }

  if (type === 'user') {
    if (isUuid(value)) return { kind: 'id', value }
    const name = value.replace(/^@/, '')
    return USERNAME_RE.test(name) ? { kind: 'username', value: name } : null
  }
  if (type === 'media') return MEDIA_ID_RE.test(value) ? { kind: 'id', value } : null
  if (type === 'list') return isUuid(value) ? { kind: 'id', value } : null
  return null
}

/** Resuelve el contenido del formulario público con el cliente admin (solo lo público). */
export async function checkPublicTarget(
  admin: SupabaseClient,
  type: ReportTargetType,
  raw: string,
): Promise<TargetCheck> {
  const parsed = parsePublicTarget(type, raw)
  if (!parsed) return { ok: false, status: 400, error: 'invalid_target' }

  if (type === 'media') return { ok: true, targetId: parsed.value }

  if (type === 'user') {
    const column = parsed.kind === 'username' ? 'username' : 'id'
    const { data } = await admin.from('users').select('id').eq(column, parsed.value).maybeSingle()
    return data ? { ok: true, targetId: (data as { id: string }).id } : { ok: false, status: 404, error: 'target_not_found' }
  }

  if (type === 'list') {
    const { data } = await admin
      .from('lists')
      .select('id')
      .eq('id', parsed.value)
      .eq('is_public', true)
      .maybeSingle()
    return data ? { ok: true, targetId: parsed.value } : { ok: false, status: 404, error: 'target_not_found' }
  }

  return { ok: false, status: 400, error: 'invalid_target' }
}
