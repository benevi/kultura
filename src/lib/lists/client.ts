// ============================================================
// KULTURA — Cliente de /api/lists (saneamiento 6 y 7)
// Una función por operación. Devuelven `data` o lanzan `ApiError` (con
// `code`, `message` y `status`); el componente decide qué mostrar.
// ============================================================

import { apiFetch } from '@/lib/api/client'

export interface ListSummary {
  id: string
  name: string
  media_type: string
  [key: string]: unknown
}

export interface ListChanges {
  isPublic?: boolean
  name?: string
  description?: string | null
}

export interface NewList {
  name: string
  mediaType: string
  isCollaborative?: boolean
  isPublic?: boolean
  description?: string | null
  template?: string | null
}

const base = (listId: string) => `/api/lists/${encodeURIComponent(listId)}`

export function fetchMyLists(mediaType?: string): Promise<ListSummary[]> {
  const qs = mediaType ? `?mediaType=${encodeURIComponent(mediaType)}` : ''
  return apiFetch<ListSummary[]>(`/api/lists${qs}`)
}

export function createList(input: NewList): Promise<ListSummary> {
  return apiFetch<ListSummary>('/api/lists', { method: 'POST', json: input })
}

export function updateList(listId: string, changes: ListChanges): Promise<ListChanges> {
  return apiFetch<ListChanges>(base(listId), { method: 'PATCH', json: changes })
}

export function deleteList(listId: string): Promise<null> {
  return apiFetch<null>(base(listId), { method: 'DELETE' })
}

export function addListItem(listId: string, mediaId: string): Promise<unknown> {
  return apiFetch<unknown>(`${base(listId)}/items`, { method: 'POST', json: { mediaId } })
}

export function removeListItem(listId: string, itemId: string): Promise<null> {
  return apiFetch<null>(`${base(listId)}/items`, { method: 'DELETE', json: { itemId } })
}

export function reorderListItems(listId: string, order: string[]): Promise<{ moved: number | null }> {
  return apiFetch<{ moved: number | null }>(`${base(listId)}/items`, { method: 'PATCH', json: { order } })
}

export function setListItemNote(listId: string, itemId: string, note: string | null): Promise<{ note: string | null }> {
  return apiFetch<{ note: string | null }>(`${base(listId)}/items`, { method: 'PATCH', json: { itemId, note } })
}

export function inviteListMember(listId: string, userId: string): Promise<null> {
  return apiFetch<null>(`${base(listId)}/members`, { method: 'POST', json: { userId } })
}

export function removeListMember(listId: string, userId: string): Promise<null> {
  return apiFetch<null>(`${base(listId)}/members`, { method: 'DELETE', json: { userId } })
}
