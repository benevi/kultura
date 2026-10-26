// ============================================================
// KULTURA — Listas: bandera, columnas y validación (F-25, solo servidor)
//
// Las listas mixtas, el orden manual, las notas, la descripción y las
// plantillas necesitan la migración 20261208250001_platforms_mixed_lists.sql.
// Hasta que Víctor la aplica y enciende MIXED_LISTS=1, todo se lee y escribe
// con las columnas de siempre. Si la bandera se enciende ANTES de aplicarla,
// las lecturas reintentan con las columnas viejas (`isNotMigrated`), así que
// nada se rompe: solo no aparece lo nuevo.
// ============================================================

import { isNotMigrated } from '@/app/api/settings/account-state'
import type { MediaType } from '@/types/media'
import type { ListMediaType, ListTemplate } from '@/types/list'

export const SINGLE_MEDIA_TYPES: readonly MediaType[] = ['movie', 'tv', 'anime', 'book', 'comic', 'manga', 'game']
export const LIST_TEMPLATES: readonly ListTemplate[] = ['franchise', 'ranking']

export const LIST_NAME_MAX = 80
export const LIST_DESCRIPTION_MAX = 500
export const LIST_NOTE_MAX = 500
/** Tope de un orden completo (una lista más larga se ordena por tramos). */
export const LIST_REORDER_MAX = 500

/** Bandera que Víctor activa en Vercel tras aplicar la migración de F-25. */
export function mixedListsEnabled(): boolean {
  return process.env.MIXED_LISTS === '1'
}

export { isNotMigrated }

/** Columnas de `lists` (las nuevas solo con la bandera). */
export const LIST_COLUMNS_LEGACY = 'id, owner_id, name, media_type, is_collaborative, is_public, created_at'
export const LIST_COLUMNS_MIXED = `${LIST_COLUMNS_LEGACY}, description, template`

export function listColumns(mixed = mixedListsEnabled()): string {
  return mixed ? LIST_COLUMNS_MIXED : LIST_COLUMNS_LEGACY
}

/** Tipos que admite POST /api/lists. `mixed` solo con la bandera. */
export function validListTypes(mixed = mixedListsEnabled()): readonly ListMediaType[] {
  return mixed ? [...SINGLE_MEDIA_TYPES, 'mixed'] : SINGLE_MEDIA_TYPES
}

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
