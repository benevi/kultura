// ============================================================
// KULTURA — Listas: bandera, columnas y validación (F-25, solo servidor)
//
// Las listas mixtas, el orden manual, las notas, la descripción y las
// plantillas usan la migración 20261208250001_platforms_mixed_lists.sql (ya
// aplicada). La bandera MIXED_LISTS se retiró encendida (saneamiento 11.4).
// ============================================================

import type { MediaType } from '@/types/media'
import type { ListMediaType, ListTemplate } from '@/types/list'

export const SINGLE_MEDIA_TYPES: readonly MediaType[] = ['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game']
export const LIST_TEMPLATES: readonly ListTemplate[] = ['franchise', 'ranking']

export const LIST_NAME_MAX = 80
export const LIST_DESCRIPTION_MAX = 500
export const LIST_NOTE_MAX = 500
/** Tope de un orden completo (una lista más larga se ordena por tramos). */
export const LIST_REORDER_MAX = 500

/** Columnas de `lists`. */
export const LIST_COLUMNS = 'id, owner_id, name, media_type, is_collaborative, is_public, created_at, description, template'

/** Tipos que admite POST /api/lists. */
export const LIST_MEDIA_TYPES: readonly ListMediaType[] = [...SINGLE_MEDIA_TYPES, 'mixed']

/** Formato de un título a partir de su id (`book_123` → `book`). */
export function mediaTypeOf(mediaId: string): string {
  return mediaId.split('_')[0] ?? ''
}

/** ¿Cabe este título en una lista de este tipo? Las mixtas admiten todo. */
export function fitsList(listType: string, mediaId: string): boolean {
  return listType === 'mixed' || mediaTypeOf(mediaId) === listType
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Texto opcional recortado: `undefined` si no vino, `null` si vino vacío. */
export function optionalText(value: unknown, max: number): { ok: true; value: string | null | undefined } | { ok: false } {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false }
  const trimmed = value.trim()
  if (trimmed.length > max) return { ok: false }
  return { ok: true, value: trimmed === '' ? null : trimmed }
}
