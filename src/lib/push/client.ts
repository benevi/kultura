// ============================================================
// KULTURA — Notificaciones push en el navegador (F-33)
//
// `usePushSettings()` lo usa Ajustes. Reglas:
//   - El permiso se pide SOLO dentro de `enable()`, es decir, al pulsar el
//     interruptor. Al montar nunca se llama a `Notification.requestPermission`
//     (tampoco a `pushManager.subscribe` sin permiso ya concedido).
//   - Safari exige que `requestPermission` salga del gesto del usuario sin
//     esperas antes: es lo primero que hace `enable()`.
//   - El servidor manda: si la suscripción local ya no está dada de alta
//     (se desactivó en otro dispositivo, caducó…), se da por apagada y se
//     borra también aquí.
//   - iPhone/iPad solo tienen push con la app instalada (iOS 16.4+): fuera de
//     ella se explica cómo instalarla.
// La lógica sin React (`detectPushSupport`, `readPushStatus`…) va aparte para
// probarla sin navegador.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { fromBase64Url, toBase64Url } from './base64url'
import { endpointHash } from './endpoint'

export type PushSupport = 'supported' | 'unsupported' | 'ios_install'

export interface PushStatus {
  enabled: boolean
  publicKey: string | null
  devices: number
  endpointHashes: string[]
}

export type PushUiState =
  | 'loading'
  /** Push apagado en el servidor (bandera, claves o migración): no se enseña nada. */
  | 'hidden'
  /** Hay push pero el service worker no está (desarrollo, interruptor NEXT_PUBLIC_PWA_SW=0). */
  | 'unsupported'
  | 'ios_install'
  | 'denied'
  | 'off'
  | 'on'
  | 'saving'

export type PushNotice = 'dismissed' | 'error' | 'allOff' | null

const READY_TIMEOUT_MS = 4000

type Win = Window & typeof globalThis

function isIos(win: Win): boolean {
  const nav = win.navigator
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
}

function isStandalone(win: Win): boolean {
  const nav = win.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || Boolean(win.matchMedia?.('(display-mode: standalone)').matches)
}

export function detectPushSupport(win: Win): PushSupport {
  const ok = 'serviceWorker' in win.navigator && 'PushManager' in win && 'Notification' in win
  if (isIos(win) && !isStandalone(win)) return 'ios_install'
  return ok ? 'supported' : 'unsupported'
}

export async function readPushStatus(fetchImpl: typeof fetch = fetch): Promise<PushStatus | null> {
  try {
    const res = await fetchImpl('/api/push/status', { cache: 'no-store', credentials: 'same-origin' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<PushStatus>
    return {
      enabled: data.enabled === true && typeof data.publicKey === 'string',
      publicKey: typeof data.publicKey === 'string' ? data.publicKey : null,
      devices: typeof data.devices === 'number' ? data.devices : 0,
      endpointHashes: Array.isArray(data.endpointHashes) ? data.endpointHashes.filter((h) => typeof h === 'string') : [],
    }
  } catch {
    return null
  }
}

/** El registro del service worker, o null si no llega a tiempo (dev, interruptor NEXT_PUBLIC_PWA_SW=0…). */
async function workerRegistration(win: Win): Promise<ServiceWorkerRegistration | null> {
  const container = win.navigator.serviceWorker
  if (!container) return null
  const existing = await container.getRegistration().catch(() => undefined)
  if (existing?.active) return existing
  return Promise.race([
    container.ready.catch(() => null),
    new Promise<null>((resolve) => win.setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
  ])
}

function sameKey(subscription: PushSubscription, publicKey: string): boolean {
  const key = subscription.options?.applicationServerKey
  return key ? toBase64Url(new Uint8Array(key)) === publicKey : false
}

export function subscriptionPayload(subscription: PushSubscription, locale: string, replaces?: string) {
  const p256dh = subscription.getKey('p256dh')
  const auth = subscription.getKey('auth')
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: p256dh ? toBase64Url(p256dh) : '', auth: auth ? toBase64Url(auth) : '' },
    expirationTime: subscription.expirationTime ?? null,
    locale: locale === 'en' ? 'en' : 'es',
    ...(replaces && replaces !== subscription.endpoint ? { replaces } : {}),
  }
}

async function postJson(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    return false
  }
}

async function subscribeWith(registration: ServiceWorkerRegistration, publicKey: string): Promise<PushSubscription> {
  const key = fromBase64Url(publicKey)
  if (!key) throw new Error('invalid public key')
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
}

/** Lo que espera, como mucho, `unsubscribeCurrentDevice` antes de dejar seguir. */
export const SIGN_OUT_PUSH_TIMEOUT_MS = 1500

/**
 * Al cerrar sesión (o cambiar de cuenta): da de baja el push de ESTE
 * navegador, para que no sigan llegando avisos de la cuenta que se va.
 * Primero en el servidor (con la sesión que aún hay) y luego en el navegador.
 * Nunca falla ni bloquea: sin service worker, sin suscripción o sin permiso no
 * hace nada (ni una petición), y como mucho espera SIGN_OUT_PUSH_TIMEOUT_MS.
 */
export async function unsubscribeCurrentDevice(win: Win = window as Win): Promise<void> {
  const work = (async () => {
    if (!('serviceWorker' in win.navigator) || !('PushManager' in win)) return
    const registration = await win.navigator.serviceWorker.getRegistration().catch(() => undefined)
    const subscription = registration ? await registration.pushManager.getSubscription().catch(() => null) : null
    if (!subscription) return
    try {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        signal: AbortSignal.timeout(SIGN_OUT_PUSH_TIMEOUT_MS),
      })
    } catch {
      // Sin red o sin push en el servidor: se borra igual en el navegador.
    }
    await subscription.unsubscribe().catch(() => false)
  })().catch(() => undefined)
  await Promise.race([
    work,
    new Promise<void>((resolve) => win.setTimeout(resolve, SIGN_OUT_PUSH_TIMEOUT_MS + 250)),
  ])
}

export function usePushSettings(locale: string, { disabled = false }: { disabled?: boolean } = {}) {
  const [state, setState] = useState<PushUiState>('loading')
  const [otherDevices, setOtherDevices] = useState(0)
  const [notice, setNotice] = useState<PushNotice>(null)
  const statusRef = useRef<PushStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    const win = window as Win
    ;(async () => {
      // Un navegador sin push no pregunta nada al servidor: no hay nada que ofrecer.
      const support = detectPushSupport(win)
      if (support === 'unsupported') return setState('hidden')
      const status = await readPushStatus()
      if (cancelled) return
      statusRef.current = status
      if (!status?.enabled || !status.publicKey) return setState('hidden')
      if (support === 'ios_install') return setState('ios_install')
      if (win.Notification.permission === 'denied') {
        setOtherDevices(status.devices)
        return setState('denied')
      }
      const registration = await workerRegistration(win)
      if (cancelled) return
      if (!registration) return setState('unsupported')
      let subscription = await registration.pushManager.getSubscription().catch(() => null)
      const registered = subscription ? status.endpointHashes.includes(await endpointHash(subscription.endpoint)) : false
      if (cancelled) return
      setOtherDevices(Math.max(0, status.devices - (registered ? 1 : 0)))
      if (!subscription || !registered || win.Notification.permission !== 'granted') {
        // Dada de baja desde otro sitio: tampoco se queda aquí.
        if (subscription && !registered) await subscription.unsubscribe().catch(() => false)
        if (!cancelled) setState('off')
        return
      }
      setState('on')
      if (disabled) return
      // Refresco silencioso (idioma, caducidad) y, si cambió el par VAPID,
      // suscripción nueva con el permiso que ya hay (sin preguntar).
      const old = subscription.endpoint
      if (!sameKey(subscription, status.publicKey)) {
        await subscription.unsubscribe().catch(() => false)
        subscription = await subscribeWith(registration, status.publicKey).catch(() => null)
        if (!subscription) {
          if (!cancelled) setState('off')
          return
        }
      }
      await postJson('/api/push/subscribe', subscriptionPayload(subscription, locale, old))
    })()
    return () => {
      cancelled = true
    }
  }, [locale, disabled])

  const enable = useCallback(async () => {
    const win = window as Win
    // Lo primero, dentro del gesto (Safari no lo permite después de un await).
    const permission = win.Notification.permission === 'granted' ? 'granted' : await win.Notification.requestPermission()
    setNotice(null)
    if (permission === 'denied') return setState('denied')
    if (permission !== 'granted') {
      setNotice('dismissed')
      return setState('off')
    }
    setState('saving')
    const publicKey = statusRef.current?.publicKey
    const registration = await workerRegistration(win)
    if (!publicKey || !registration) return setState('unsupported')
    try {
      let subscription = await registration.pushManager.getSubscription()
      if (subscription && !sameKey(subscription, publicKey)) {
        await subscription.unsubscribe()
        subscription = null
      }
      subscription = subscription ?? (await subscribeWith(registration, publicKey))
      if (!(await postJson('/api/push/subscribe', subscriptionPayload(subscription, locale)))) {
        await subscription.unsubscribe().catch(() => false)
        throw new Error('subscribe failed')
      }
      setState('on')
    } catch {
      setNotice('error')
      setState('off')
    }
  }, [locale])

  const disable = useCallback(async (all = false) => {
    const win = window as Win
    setNotice(null)
    setState('saving')
    const registration = await workerRegistration(win)
    const subscription = registration ? await registration.pushManager.getSubscription().catch(() => null) : null
    const ok = all
      ? await postJson('/api/push/unsubscribe', { all: true })
      : subscription
        ? await postJson('/api/push/unsubscribe', { endpoint: subscription.endpoint })
        : true
    if (!ok) {
      setNotice('error')
      return setState(subscription ? 'on' : 'off')
    }
    await subscription?.unsubscribe().catch(() => false)
    if (all) {
      setOtherDevices(0)
      setNotice('allOff')
    }
    setState('off')
  }, [])

  return { state, otherDevices, notice, enable, disable }
}
