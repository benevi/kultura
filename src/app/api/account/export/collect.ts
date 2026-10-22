// ============================================================
// KULTURA — Datos del usuario para el export (SEG-8, arts. 15 y 20 RGPD)
//
// Lo que el export no traía: mensajes enviados, posts de grupo, grupos e
// invitaciones, recomendaciones enviadas y recibidas, sugerencias,
// notificaciones, denuncias y los metadatos de sus conversaciones.
//
// Se lee con el cliente ADMIN porque la RLS no siempre deja al usuario leer lo
// suyo (`reports` no tiene política SELECT; los posts de un grupo del que salió
// dejan de verse). Por eso CADA consulta filtra por el id del usuario
// autenticado, y del contenido ajeno solo se incluye lo imprescindible para
// entender lo propio (quién participa en sus chats y el nombre de usuario de la
// otra parte de una recomendación), nunca los mensajes ni posts de otros.
// Columnas literales del DDL (`20260502233945_remote_schema.sql`,
// `20260601000001_add_group_visibility.sql`,
// `20260601000002_group_invitations.sql`,
// `20260913220000_avatar_and_group_icons.sql`).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/account/export')

const PAGE_SIZE = 1000
/** Techo de seguridad: 50.000 filas por tabla. */
const MAX_PAGES = 50
const IN_CHUNK = 100

type Row = Record<string, unknown>

/**
 * Tabla que aún no existe en este proyecto (p. ej. `group_invitations` en un
 * proyecto de test sin esa migración). Una COLUMNA inexistente no se tolera:
 * sería un error de este código y vaciaría una sección en silencio.
 */
function isMissingRelation(error: { code?: string } | null): boolean {
  return !!error && ['42P01', 'PGRST205'].includes(error.code ?? '')
}

interface PageQuery {
  order: (col: string) => PageQuery
  range: (from: number, to: number) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>
}

/** Clave única por tabla para paginar de forma estable (las de miembros no tienen `id`). */
const ORDER_KEYS: Record<string, string[]> = {
  conversation_members: ['conversation_id', 'user_id'],
  group_members: ['group_id', 'user_id'],
}

/**
 * Lee TODAS las filas (PostgREST corta en 1.000 por petición), ordenadas por
 * su clave única para que la paginación sea estable. Vacío si la tabla no existe.
 */
async function fetchAll(table: string, build: () => PageQuery): Promise<Row[]> {
  const rows: Row[] = []
  const keys = ORDER_KEYS[table] ?? ['id']
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const ordered = keys.reduce((query, key) => query.order(key), build())
    const { data, error } = await ordered.range(from, from + PAGE_SIZE - 1)
    if (error) {
      if (isMissingRelation(error)) {
        log.warn('tabla ausente en el export', { table, code: error.code })
        return rows
      }
      throw new Error(`${table}: ${error.message}`)
    }
    const batch = (data ?? []) as Row[]
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return rows
  }
  log.warn('export truncado por el techo de filas', { table, rows: rows.length })
  return rows
}

/** `select … in (ids)` troceado (URLs de PostgREST con cientos de ids). */
async function fetchIn(
  admin: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  ids: string[]
): Promise<Row[]> {
  const rows: Row[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    rows.push(...(await fetchAll(table, () => admin.from(table).select(columns).in(column, chunk) as unknown as PageQuery)))
  }
  return rows
}

const byCreatedAt = (a: Row, b: Row) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
const str = (v: unknown) => (v === undefined ? null : v)

export interface ExportSections {
  messages: Row[]
  conversations: Row[]
  groupPosts: Row[]
  groups: Row[]
  groupInvitations: Row[]
  recommendations: { sent: Row[]; received: Row[] }
  suggestions: Row[]
  notifications: Row[]
  reports: Row[]
}

export async function collectExportSections(admin: SupabaseClient, userId: string): Promise<ExportSections> {
  const q = (table: string, columns: string, column: string) => () =>
    admin.from(table).select(columns).eq(column, userId) as unknown as PageQuery

  const [
    messages,
    myConversationRows,
    groupPosts,
    memberships,
    ownedGroups,
    invitations,
    sent,
    received,
    suggestions,
    notifications,
    reports,
  ] = await Promise.all([
    fetchAll('messages', q('messages', 'id, conversation_id, content, created_at', 'sender_id')),
    fetchAll('conversation_members', q('conversation_members', 'conversation_id, last_read_at', 'user_id')),
    fetchAll('group_posts', q('group_posts', 'id, group_id, content, media_id, created_at', 'user_id')),
    fetchAll('group_members', q('group_members', 'group_id, role, joined_at', 'user_id')),
    fetchAll('groups', q('groups', 'id', 'owner_id')),
    fetchAll('group_invitations', () =>
      admin
        .from('group_invitations')
        .select('id, group_id, inviter_id, invitee_id, status, created_at')
        // `userId` sale de la sesión (UUID), no de la petición.
        .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`) as unknown as PageQuery
    ),
    fetchAll('recommendations', q('recommendations', 'id, to_user_id, media_id, message, read_at, created_at', 'from_user_id')),
    fetchAll('recommendations', q('recommendations', 'id, from_user_id, media_id, message, read_at, created_at', 'to_user_id')),
    fetchAll('suggestions', q('suggestions', 'id, type, subject, description, created_at', 'user_id')),
    fetchAll('notifications', q('notifications', 'id, type, payload, read_at, created_at', 'user_id')),
    fetchAll('reports', q('reports', 'id, target_type, target_id, reason, created_at', 'reporter_id')),
  ])

  // Conversaciones propias: fechas y participantes (no sus mensajes).
  const conversationIds = myConversationRows.map((r) => String(r.conversation_id))
  const [conversationRows, memberRows] = await Promise.all([
    fetchIn(admin, 'conversations', 'id, created_at, last_message_at', 'id', conversationIds),
    fetchIn(admin, 'conversation_members', 'conversation_id, user_id', 'conversation_id', conversationIds),
  ])

  // Grupos: de los que es miembro y los que creó.
  const membershipByGroup = new Map(memberships.map((m) => [String(m.group_id), m]))
  const groupIds = Array.from(new Set(Array.from(membershipByGroup.keys()).concat(ownedGroups.map((g) => String(g.id)))))
  const groupRows = await fetchIn(
    admin,
    'groups',
    'id, owner_id, name, description, cover_color, icon, is_public, created_at',
    'id',
    groupIds
  )

  // Nombres de usuario de la otra parte (chats, recomendaciones, invitaciones).
  const otherIds = new Set<string>()
  for (const m of memberRows) otherIds.add(String(m.user_id))
  for (const r of sent) otherIds.add(String(r.to_user_id))
  for (const r of received) otherIds.add(String(r.from_user_id))
  for (const i of invitations) {
    otherIds.add(String(i.inviter_id))
    otherIds.add(String(i.invitee_id))
  }
  const userRows = await fetchIn(admin, 'users', 'id, username', 'id', Array.from(otherIds))
  const username = new Map(userRows.map((u) => [String(u.id), (u.username as string) ?? null]))
  const nameOf = (id: unknown) => username.get(String(id)) ?? null

  const lastReadByConversation = new Map(myConversationRows.map((r) => [String(r.conversation_id), r.last_read_at]))
  const membersByConversation = new Map<string, Row[]>()
  for (const m of memberRows) {
    const key = String(m.conversation_id)
    const list = membersByConversation.get(key) ?? []
    list.push({ userId: m.user_id, username: nameOf(m.user_id) })
    membersByConversation.set(key, list)
  }

  return {
    messages: [...messages].sort(byCreatedAt).map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      content: m.content,
      createdAt: str(m.created_at),
    })),
    conversations: [...conversationRows].sort(byCreatedAt).map((c) => ({
      id: c.id,
      createdAt: str(c.created_at),
      lastMessageAt: str(c.last_message_at),
      lastReadAt: str(lastReadByConversation.get(String(c.id))),
      members: (membersByConversation.get(String(c.id)) ?? []).sort((a, b) =>
        String(a.username ?? '').localeCompare(String(b.username ?? ''))
      ),
    })),
    groupPosts: [...groupPosts].sort(byCreatedAt).map((p) => ({
      id: p.id,
      groupId: p.group_id,
      content: p.content,
      mediaId: str(p.media_id),
      createdAt: str(p.created_at),
    })),
    groups: [...groupRows].sort(byCreatedAt).map((g) => {
      const membership = membershipByGroup.get(String(g.id))
      return {
        id: g.id,
        name: g.name,
        description: str(g.description),
        coverColor: str(g.cover_color),
        icon: str(g.icon),
        isPublic: str(g.is_public),
        createdAt: str(g.created_at),
        isOwner: g.owner_id === userId,
        role: membership ? membership.role : g.owner_id === userId ? 'owner' : null,
        joinedAt: membership ? str(membership.joined_at) : null,
      }
    }),
    groupInvitations: [...invitations].sort(byCreatedAt).map((i) => ({
      id: i.id,
      groupId: i.group_id,
      inviterId: i.inviter_id,
      inviterUsername: nameOf(i.inviter_id),
      inviteeId: i.invitee_id,
      inviteeUsername: nameOf(i.invitee_id),
      status: i.status,
      createdAt: str(i.created_at),
    })),
    recommendations: {
      sent: [...sent].sort(byCreatedAt).map((r) => ({
        id: r.id,
        toUserId: r.to_user_id,
        toUsername: nameOf(r.to_user_id),
        mediaId: r.media_id,
        message: str(r.message),
        readAt: str(r.read_at),
        createdAt: str(r.created_at),
      })),
      received: [...received].sort(byCreatedAt).map((r) => ({
        id: r.id,
        fromUserId: r.from_user_id,
        fromUsername: nameOf(r.from_user_id),
        mediaId: r.media_id,
        message: str(r.message),
        readAt: str(r.read_at),
        createdAt: str(r.created_at),
      })),
    },
    suggestions: [...suggestions].sort(byCreatedAt).map((s) => ({
      id: s.id,
      type: s.type,
      subject: s.subject,
      description: s.description,
      createdAt: str(s.created_at),
    })),
    notifications: [...notifications].sort(byCreatedAt).map((n) => ({
      id: n.id,
      type: n.type,
      payload: n.payload,
      readAt: str(n.read_at),
      createdAt: str(n.created_at),
    })),
    reports: [...reports].sort(byCreatedAt).map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: str(r.reason),
      createdAt: str(r.created_at),
    })),
  }
}
