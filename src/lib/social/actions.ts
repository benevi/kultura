// ============================================================
// KULTURA — Friends Actions (cliente)
// Helpers que hacen fetch al Route Handler /api/friends.
// Uso exclusivo en Client Components.
// ============================================================

/** Envía una solicitud de amistad al usuario con el id dado */
export async function sendFriendRequest(receiverId: string): Promise<void> {
  const response = await fetch('/api/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to send friend request')
  }
}

/** Acepta o rechaza una solicitud de amistad */
export async function respondToFriendRequest(
  friendshipId: string,
  action: 'accept' | 'decline'
): Promise<void> {
  const response = await fetch('/api/friends', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ friendshipId, action }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to respond to friend request')
  }
}

/** Elimina una amistad existente */
export async function removeFriend(friendshipId: string): Promise<void> {
  const response = await fetch('/api/friends', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ friendshipId }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to remove friend')
  }
}

// ── Moderación (F-11): denuncias, bloqueo, salir y moderar ───────────────────
// Constantes compartidas por los componentes y los Route Handlers (este archivo
// no importa nada de servidor, así que sirve en los dos lados).

/** Tipos que la tabla `reports` admite tras la migración de moderación. */
export const REPORT_TARGET_TYPES = ['user', 'media', 'message', 'group_post', 'group', 'list'] as const
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number]

/** Los que ya admitía antes de la migración (sin MODERATION_V2 solo estos). */
export const LEGACY_REPORT_TARGET_TYPES: readonly ReportTargetType[] = ['user', 'media']

/** Lo que se puede denunciar sin cuenta desde /[locale]/report (lo público). */
export const PUBLIC_REPORT_TARGET_TYPES: readonly ReportTargetType[] = ['user', 'media', 'list']

/** Motivos de denuncia (claves de `report.reasons.*`). */
export const REPORT_REASONS = ['harassment', 'hate', 'sexual', 'violence', 'spam', 'illegal', 'impersonation', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_DETAILS_MAX = 2000

/** Número de referencia que ve quien denuncia: KR- + 8 primeros hex del id. */
export function reportReference(reportId: string): string {
  return `KR-${reportId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

export interface ReportResult {
  reportId: string
  reference: string
}

/** Error con el código que devuelve la API (`error`) y el estado HTTP. */
export class ModerationRequestError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'ModerationRequestError'
  }
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new ModerationRequestError(data.error ?? 'request_failed', response.status)
  return data
}

/** Denuncia con sesión (botón en mensaje, post, grupo, perfil y ficha). */
export function submitReport(input: {
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  details?: string
}): Promise<ReportResult> {
  return call<ReportResult>('/api/reports', { method: 'POST', body: JSON.stringify(input) })
}

/** Denuncia sin cuenta (formulario público). */
export function submitPublicReport(input: {
  targetType: ReportTargetType
  target: string
  reason: ReportReason
  details: string
  contactEmail: string
  goodFaith: boolean
  website?: string
}): Promise<ReportResult> {
  return call<ReportResult>('/api/reports/public', { method: 'POST', body: JSON.stringify(input) })
}

export interface BlockState {
  /** false sin MODERATION_V2 o sin la migración: la UI no enseña bloquear. */
  enabled: boolean
  blocked: boolean
}

export function getBlockState(userId: string): Promise<BlockState> {
  return call<BlockState>(`/api/friends/blocks?userId=${encodeURIComponent(userId)}`, { method: 'GET' })
}

export interface BlockedUser {
  id: string
  username: string
  avatarColor: string
  avatarInitials: string
}

export function getBlockedUsers(): Promise<{ enabled: boolean; users: BlockedUser[] }> {
  return call('/api/friends/blocks', { method: 'GET' })
}

export function blockUser(userId: string): Promise<{ ok: true }> {
  return call('/api/friends/blocks', { method: 'POST', body: JSON.stringify({ userId }) })
}

export function unblockUser(userId: string): Promise<{ ok: true }> {
  return call('/api/friends/blocks', { method: 'DELETE', body: JSON.stringify({ userId }) })
}

export function leaveConversation(conversationId: string): Promise<{ ok: true }> {
  return call(`/api/chat/${encodeURIComponent(conversationId)}`, { method: 'DELETE' })
}

export function deleteMessage(conversationId: string, messageId: string): Promise<{ ok: true }> {
  return call(
    `/api/chat/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
  )
}

export function deleteGroupPost(groupId: string, postId: string): Promise<{ ok: true }> {
  return call(
    `/api/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}`,
    { method: 'DELETE' },
  )
}

export function removeGroupMember(groupId: string, userId: string): Promise<{ ok: true }> {
  return call(
    `/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  )
}
