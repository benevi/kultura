// ============================================================
// KULTURA — Servicio del chat (saneamiento 6.3)
// La lógica que antes vivía en /api/chat y /api/chat/[id]. No sabe de HTTP:
// recibe la entrada ya validada por zod y devuelve un `ServiceResult`.
//
// F-11 (MODERATION_V2): salir de una conversación y borrar mensajes propios;
// sin la bandera responden `not_found` (`moderation_disabled`).
// ============================================================

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'
import { isModerationV2, isRlsDenied } from '@/lib/social/friends'
import { CHAT_ERRORS } from '@/lib/chat/errors'
import { failure, success, type ServiceResult } from '@/lib/api/result'

const log = createLogger('chat/service')

/** Mensajes por página. */
export const CHAT_PAGE_SIZE = 100

/** Mensaje del `not_found` de lo que necesita MODERATION_V2. */
export const MODERATION_DISABLED = 'moderation_disabled'

interface Profile {
  id: string
  username: string
  avatar_color: string
  avatar_initials: string
}

export interface ConversationSummary {
  id: string
  lastMessageAt: string | null
  otherUser: Profile | null
  lastMessage: { content: string; isMine: boolean } | null
  unread: boolean
}

export interface ChatMessage {
  id: string
  content: string
  sender_id: string | null
  created_at: string
  users?: { username: string; avatar_color: string; avatar_initials: string } | null
}

/**
 * E96: cuántas conversaciones tienen algo sin leer (el globo del menú). Una
 * consulta; el count anidado descarta las vacías, cuya last_message_at
 * (now() al crearse) contaría como no leída sin haber nada que leer.
 */
export async function countUnread(supabase: SupabaseClient, userId: string): Promise<ServiceResult<{ count: number }>> {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('last_read_at, conversations!inner(last_message_at, messages(count))')
    .eq('user_id', userId)
  if (error) {
    log.error('Failed to count unread', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to count' })
  }

  type Row = {
    last_read_at: string | null
    conversations: { last_message_at: string; messages: Array<{ count: number }> } | null
  }
  const count = ((data ?? []) as unknown as Row[]).filter((row) => {
    const conv = row.conversations
    if (!conv || (conv.messages?.[0]?.count ?? 0) === 0) return false
    if (!row.last_read_at) return true
    return new Date(conv.last_message_at) > new Date(row.last_read_at)
  }).length
  return success({ count })
}

/**
 * Mis conversaciones (la más reciente primero), con el otro miembro y el
 * último mensaje. Una sola consulta (antes eran 2 por conversación): el
 * otro miembro y el último mensaje van embebidos, con su límite por
 * conversación.
 */
export async function listConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<ServiceResult<ConversationSummary[]>> {
  const { data, error } = await supabase
    .from('conversation_members')
    .select(
      'conversation_id, last_read_at, conversations(id, last_message_at, ' +
        'messages(content, sender_id, created_at), ' +
        'others:conversation_members(user_id, users(id, username, avatar_color, avatar_initials)))'
    )
    .eq('user_id', userId)
    .neq('conversations.others.user_id', userId)
    .order('conversations(last_message_at)', { ascending: false })
    .order('created_at', { referencedTable: 'conversations.messages', ascending: false })
    .limit(1, { referencedTable: 'conversations.messages' })
    .limit(1, { referencedTable: 'conversations.others' })
  if (error) {
    log.error('Failed to list conversations', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to load conversations' })
  }

  type Message = { content: string; sender_id: string | null; created_at: string | null }
  type Row = {
    conversation_id: string
    last_read_at: string | null
    conversations: {
      id: string
      last_message_at: string
      messages: Message[] | null
      others: Array<{ users: Profile | null }> | null
    } | null
  }
  const rows = (data ?? []) as unknown as Row[]
  const conversations = rows.map((row): ConversationSummary => {
    const conv = row.conversations
    const lastMsg = conv?.messages?.[0] ?? null
    const unread = lastMsg && row.last_read_at
      ? new Date(lastMsg.created_at ?? 0) > new Date(row.last_read_at)
      : !!lastMsg

    return {
      id: row.conversation_id,
      lastMessageAt: conv?.last_message_at ?? null,
      otherUser: conv?.others?.[0]?.users ?? null,
      lastMessage: lastMsg ? { content: lastMsg.content, isMine: lastMsg.sender_id === userId } : null,
      unread,
    }
  })
  return success(conversations)
}

/** Abre (o recupera) la conversación con un amigo. E93: solo entre amigos. */
export async function openConversation(
  supabase: SupabaseClient,
  userId: string,
  targetUserId: string
): Promise<ServiceResult<{ conversationId: string }>> {
  const { data, error } = await supabase.rpc('create_conversation_with_members', { target_user_id: targetUserId })
  // El RPC lanza 'not_friends' (P0005) si no son amigos aceptados.
  if (error?.message === 'not_friends' || error?.code === 'P0005') {
    return failure('forbidden', { message: CHAT_ERRORS.notFriends })
  }
  if (error || !data) {
    log.error('Failed to create conversation', { rpcError: error, userId, targetUserId })
    return failure('internal', { message: 'Failed to create conversation' })
  }
  return success({ conversationId: data as string })
}

async function isMember(supabase: SupabaseClient, conversationId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle()
  return Boolean(data)
}

/**
 * Los ÚLTIMOS mensajes (saneamiento 1.3), en orden cronológico; con `before`,
 * la página anterior. Abrir la conversación (sin `before`) la marca leída.
 */
export async function readMessages(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  before: string | undefined
): Promise<ServiceResult<{ messages: ChatMessage[]; hasMore: boolean; currentUserId: string }>> {
  if (!(await isMember(supabase, conversationId, userId))) return failure('forbidden', { message: 'Not a member' })

  // Uno de más para saber si quedan anteriores.
  let query = supabase
    .from('messages')
    .select('id, content, sender_id, created_at, users(username, avatar_color, avatar_initials)')
    .eq('conversation_id', conversationId)
  if (before !== undefined) query = query.lt('created_at', before)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(CHAT_PAGE_SIZE + 1)
  if (error) {
    log.error('Failed to load messages', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to load messages' })
  }

  const page = (data ?? []) as unknown as ChatMessage[]
  const hasMore = page.length > CHAT_PAGE_SIZE
  const messages = page.slice(0, CHAT_PAGE_SIZE).reverse()

  // Leído solo al abrir (no al pedir mensajes viejos). No se espera.
  if (before === undefined) {
    supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .then(() => {})
  }
  return success({ messages, hasMore, currentUserId: userId })
}

/**
 * Marca la conversación como leída (saneamiento 9.2: antes lo hacía el
 * navegador con un UPDATE directo). Con el JWT del usuario: la política de
 * `conversation_members` solo deja tocar la fila propia. 0 filas = no es
 * miembro (o la demo, que no escribe): `forbidden`.
 */
export async function markConversationRead(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<ServiceResult<null>> {
  const { data, error } = await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .select('conversation_id')
  if (error) {
    log.error('Failed to mark conversation read', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to mark read' })
  }
  if (!data || data.length === 0) return failure('forbidden', { message: 'Not a member' })
  return success(null)
}

/** Envía un mensaje (ya recortado y con tope por zod). */
export async function sendMessage(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  content: string
): Promise<ServiceResult<ChatMessage>> {
  if (!(await isMember(supabase, conversationId, userId))) return failure('forbidden', { message: 'Not a member' })

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: userId, content })
    .select('id, content, sender_id, created_at')
    .single()
  // F-11: la política exige amistad vigente y ningún bloqueo con el resto de
  // miembros. Un rechazo es «ya no podéis escribiros», no un fallo.
  if (isRlsDenied(error)) return failure('forbidden', { message: CHAT_ERRORS.cannotMessage })
  if (error || !data) {
    log.error('Failed to send message', { code: error?.code, message: error?.message })
    return failure('internal', { message: 'Failed to send' })
  }
  return success(data as ChatMessage)
}

/** Sale de la conversación (F-11). `forbidden` si no era miembro. */
export async function leaveConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<ServiceResult<null>> {
  if (!isModerationV2()) return failure('not_found', { message: MODERATION_DISABLED })
  // DELETE … RETURNING: sin la política (sin migración) o sin ser miembro no
  // se borra nada y se sabe por el array vacío.
  const { data, error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .select('conversation_id')
  if (error) {
    log.error('Failed to leave conversation', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to leave' })
  }
  if (!data || data.length === 0) return failure('forbidden', { message: 'Not a member' })
  return success(null)
}

/** Borra un mensaje propio (F-11). Filtro explícito por remitente además de la RLS. */
export async function deleteOwnMessage(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  messageId: string
): Promise<ServiceResult<null>> {
  if (!isModerationV2()) return failure('not_found', { message: MODERATION_DISABLED })
  const { data, error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('sender_id', userId)
    .select('id')
  if (error) {
    log.error('Failed to delete message', { code: error.code, message: error.message })
    return failure('internal', { message: 'Failed to delete message' })
  }
  if (!data || data.length === 0) return failure('not_found', { message: 'Message not found' })
  return success(null)
}
