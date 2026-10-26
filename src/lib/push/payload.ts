// ============================================================
// KULTURA — Qué dice cada aviso push (F-33) · solo servidor
//
// Textos del namespace `push.notify` en el idioma de la suscripción (el del
// navegador al activarlas), con `createTranslator` como los correos.
// Privacidad: el aviso NUNCA lleva el texto de un mensaje ni la nota de una
// recomendación (se ve en la pantalla bloqueada); solo quién y qué.
// ============================================================

import 'server-only'
import { createTranslator } from 'next-intl'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'
import type { PushLocale } from './schemas'

const MESSAGES = { es, en } as const

/** Lo que lee el service worker (`public/sw.js`, `parsePushData`). */
export interface PushPayload {
  v: 1
  title: string
  body: string
  /** Ruta del propio origen; el worker descarta cualquier otra cosa. */
  url: string
  /** Avisos con la misma etiqueta se sustituyen en la bandeja (un chat = un aviso). */
  tag?: string
  lang: PushLocale
}

export type PushEvent =
  | { kind: 'message'; conversationId: string; senderUsername: string | null }
  | { kind: 'notification'; notificationId: string; type: string; payload: Record<string, unknown> }
  | { kind: 'friend_request'; username: string | null }
  | { kind: 'friend_accepted'; username: string | null }

const MAX_NAME = 60

/** Una línea, sin caracteres de control y como mucho `MAX_NAME` caracteres. */
export function cleanName(value: unknown): string {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  const line = value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim()
  const chars = Array.from(line)
  return chars.length > MAX_NAME ? `${chars.slice(0, MAX_NAME - 1).join('')}…` : line
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

export function buildPushPayload(event: PushEvent, locale: PushLocale): PushPayload {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'push.notify' })
  const base = { v: 1 as const, lang: locale }

  if (event.kind === 'message') {
    const username = cleanName(event.senderUsername)
    const conversation = isUuid(event.conversationId) ? event.conversationId : ''
    return {
      ...base,
      title: t('messageTitle'),
      body: username ? t('messageBody', { username }) : t('messageBodyAnonymous'),
      url: conversation ? `/${locale}/chat/${conversation}` : `/${locale}/chat`,
      tag: conversation ? `chat-${conversation}` : 'chat',
    }
  }

  if (event.kind === 'friend_request' || event.kind === 'friend_accepted') {
    const username = cleanName(event.username)
    const requested = event.kind === 'friend_request'
    return {
      ...base,
      title: t('friendsTitle'),
      body: username
        ? t(requested ? 'friendRequest' : 'friendAccepted', { username })
        : t(requested ? 'friendRequestAnonymous' : 'friendAcceptedAnonymous'),
      url: `/${locale}/friends`,
    }
  }

  const p = event.payload ?? {}
  const username = cleanName(p.fromUsername)
  const url = `/${locale}/notifications`
  const tag = isUuid(event.notificationId) ? `notification-${event.notificationId}` : undefined
  const generic = { ...base, title: t('notificationTitle'), body: t('fallbackBody'), url, ...(tag ? { tag } : {}) }
  if (!username) return generic
  switch (event.type) {
    case 'recommendation': {
      const title = cleanName(p.mediaTitle)
      return { ...generic, body: title ? t('recommendation', { username, title }) : t('recommendationNoTitle', { username }) }
    }
    case 'list_invite': {
      const name = cleanName(p.listName)
      return { ...generic, body: name ? t('listInvite', { username, name }) : t('listInviteNoName', { username }) }
    }
    case 'group_invite': {
      const name = cleanName(p.groupName)
      return { ...generic, body: name ? t('groupInvite', { username, name }) : t('groupInviteNoName', { username }) }
    }
    default:
      return generic
  }
}
