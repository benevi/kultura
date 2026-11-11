// ============================================================
// KULTURA — Cliente de /api/chat (saneamiento 6 y 7)
// Devuelven `data` o lanzan `ApiError` (con `code`, `message` y `status`).
// ============================================================

import { apiFetch } from '@/lib/api/client'

export interface ChatProfile {
  id: string
  username: string
  avatar_color: string
  avatar_initials: string
}

export interface ConversationSummary {
  id: string
  lastMessageAt: string | null
  otherUser: ChatProfile | null
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

export interface MessagesPage {
  messages: ChatMessage[]
  hasMore: boolean
  currentUserId: string
}

const conv = (id: string) => `/api/chat/${encodeURIComponent(id)}`

export function fetchConversations(): Promise<ConversationSummary[]> {
  return apiFetch('/api/chat')
}

export function fetchUnreadCount(): Promise<{ count: number }> {
  return apiFetch('/api/chat/unread')
}

export function openConversation(targetUserId: string): Promise<{ conversationId: string }> {
  return apiFetch('/api/chat', { method: 'POST', json: { targetUserId } })
}

export function fetchMessages(conversationId: string, before?: string): Promise<MessagesPage> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : ''
  return apiFetch(`${conv(conversationId)}${qs}`)
}

export function sendChatMessage(conversationId: string, content: string): Promise<ChatMessage> {
  return apiFetch(conv(conversationId), { method: 'POST', json: { content } })
}
