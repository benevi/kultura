// ============================================================
// KULTURA — Ofrecer los avisos push en contexto (F-33, remate)
//
// El permiso se ofrece justo cuando tiene sentido —tras enviar un mensaje o
// pedir/aceptar una amistad—, nunca al cargar la página. Quien hace la acción
// llama a `offerPushInContext()`; `PushOffer` (montado en la zona con sesión)
// escucha el evento y, solo entonces, mira si hay algo que ofrecer:
//   - el navegador tiene push (`detectPushSupport` = 'supported'),
//   - el permiso sigue en «default» (ni concedido ni bloqueado),
//   - no se ha descartado antes en este navegador ni ofrecido en esta visita,
//   - y el servidor tiene push encendido (PUSH_ENABLED y claves: lo dice
//     `/api/push/status`, que lee `usePushSettings`).
// ============================================================

import { detectPushSupport } from './client'

export type PushOfferContext = 'chat' | 'friends'

export const PUSH_OFFER_EVENT = 'kultura:push-offer'
/** localStorage: «Ahora no» pulsado (no se vuelve a ofrecer en este navegador). */
export const PUSH_OFFER_DISMISSED_KEY = 'kultura.pushOffer.dismissed'
/** sessionStorage: ya se ofreció en esta visita (una vez por visita como mucho). */
export const PUSH_OFFER_SHOWN_KEY = 'kultura.pushOffer.shown'

type Win = Window & typeof globalThis

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value)
  } catch {
    // Sin almacenamiento (modo privado): se ofrecería otra vez, nada más.
  }
}

/** Lo dice quien acaba de hacer la acción (mensaje enviado, amistad pedida o aceptada). */
export function offerPushInContext(context: PushOfferContext, win: Win | undefined = typeof window === 'undefined' ? undefined : (window as Win)) {
  win?.dispatchEvent(new CustomEvent<PushOfferContext>(PUSH_OFFER_EVENT, { detail: context }))
}

/** Comprobaciones locales, sin red: si alguna falla no se pregunta ni al servidor. */
export function canOfferPush(win: Win): boolean {
  if (detectPushSupport(win) !== 'supported') return false
  if (win.Notification.permission !== 'default') return false
  if (read(() => win.localStorage, PUSH_OFFER_DISMISSED_KEY)) return false
  if (read(() => win.sessionStorage, PUSH_OFFER_SHOWN_KEY)) return false
  return true
}

export function markPushOfferShown(win: Win) {
  write(() => win.sessionStorage, PUSH_OFFER_SHOWN_KEY, '1')
}

export function dismissPushOffer(win: Win) {
  write(() => win.localStorage, PUSH_OFFER_DISMISSED_KEY, String(Date.now()))
}
