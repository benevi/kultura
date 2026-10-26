// @vitest-environment node
/**
 * F-33 · Manejadores push del service worker (`public/sw.js`), ejecutando el
 * archivo REAL en un `vm` como tests/unit/pwa/sw.test.ts (que sigue siendo el
 * contrato de la caché y no cambia).
 */
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const SOURCE = fs.readFileSync(path.resolve(__dirname, '../../../public/sw.js'), 'utf8')
const ORIGIN = 'https://kulturaapp.vercel.app'

type Handler = (event: Record<string, unknown>) => void

function loadWorker({ windows = [] as { url: string; focus?: () => unknown; navigate?: (u: string) => unknown }[], language = 'es-ES' } = {}) {
  const handlers: Record<string, Handler> = {}
  const shown: { title: string; options: Record<string, unknown> }[] = []
  const opened: string[] = []
  const fetches: { url: string; init: RequestInit }[] = []
  const subscribed: unknown[] = []
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    navigator: { language },
    addEventListener: (type: string, fn: Handler) => (handlers[type] = fn),
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => void shown.push({ title, options }),
      pushManager: {
        subscribe: async (opts: unknown) => {
          subscribed.push(opts)
          return {
            toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/new', keys: { p256dh: 'P', auth: 'A' }, expirationTime: null }),
          }
        },
      },
      unregister: async () => true,
    },
    clients: {
      claim: async () => undefined,
      matchAll: async () => windows,
      openWindow: async (url: string) => void opened.push(url),
    },
    skipWaiting: async () => undefined,
  }
  const fetch = async (url: string, init: RequestInit) => {
    fetches.push({ url, init })
    return new Response('{}', { status: 201 })
  }
  const context = vm.createContext({ self, caches: {}, fetch, Response, Request, URL, Promise, console })
  vm.runInContext(SOURCE, context, { filename: 'sw.js' })
  const fn = <T,>(name: string) => context[name] as T
  return { handlers, shown, opened, fetches, subscribed, fn }
}

async function fire(w: ReturnType<typeof loadWorker>, type: string, extra: Record<string, unknown>) {
  const waits: Promise<unknown>[] = []
  w.handlers[type]({ ...extra, waitUntil: (p: Promise<unknown>) => void waits.push(p) })
  await Promise.all(waits)
}

const data = (value: unknown) => ({ text: () => (typeof value === 'string' ? value : JSON.stringify(value)) })

describe('sw.js · push', () => {
  it('registra los tres manejadores sin quitar los de caché', () => {
    const w = loadWorker()
    expect(Object.keys(w.handlers).sort()).toEqual(['activate', 'fetch', 'install', 'notificationclick', 'push', 'pushsubscriptionchange'])
  })

  it('enseña el aviso del servidor con icono, idioma, URL y etiqueta (un chat = un aviso)', async () => {
    const w = loadWorker()
    await fire(w, 'push', {
      data: data({ v: 1, title: 'Nuevo mensaje', body: '@ana te ha escrito.', url: '/es/chat/abc', tag: 'chat-abc', lang: 'es' }),
    })
    expect(w.shown).toEqual([
      {
        title: 'Nuevo mensaje',
        options: { body: '@ana te ha escrito.', icon: '/icons/icon-192.png', lang: 'es', data: { url: '/es/chat/abc' }, tag: 'chat-abc', renotify: true },
      },
    ])
  })

  it('un push vacío, roto o raro enseña igualmente un aviso genérico (Chrome lo exige)', async () => {
    const w = loadWorker({ language: 'en-GB' })
    await fire(w, 'push', { data: null })
    await fire(w, 'push', { data: data('no es json') })
    await fire(w, 'push', { data: data({ title: 42, body: '', url: 'https://evil.com/x', tag: '<b>' }) })
    expect(w.shown).toHaveLength(3)
    for (const s of w.shown) {
      expect(s.title).toBe('KULTURA')
      expect(s.options).toMatchObject({ body: "There's something new for you on KULTURA.", data: { url: '/' }, lang: 'en' })
      expect(s.options.tag).toBeUndefined()
    }
  })

  it('recorta y aplana los textos', async () => {
    const w = loadWorker()
    await fire(w, 'push', { data: data({ title: 'a\nb', body: 'x'.repeat(500), lang: 'es' }) })
    expect(w.shown[0].title).toBe('a b')
    expect((w.shown[0].options.body as string).length).toBe(240)
  })
})

describe('sw.js · notificationclick', () => {
  const safe = loadWorker().fn<(raw: unknown, origin: string) => string>('safeTargetUrl')

  it('solo URLs del propio origen; todo lo demás va a /', () => {
    expect(safe('/es/chat/abc?x=1#m', ORIGIN)).toBe('/es/chat/abc?x=1#m')
    expect(safe(`${ORIGIN}/en/notifications`, ORIGIN)).toBe('/en/notifications')
    for (const bad of ['https://evil.com/es/chat', '//evil.com/x', 'javascript:alert(1)', 'data:text/html,hi', 'http://kulturaapp.vercel.app/x', '', null, 7]) {
      expect(safe(bad, ORIGIN), String(bad)).toBe('/')
    }
  })

  it('cierra el aviso y enfoca la pestaña que ya está en esa URL', async () => {
    const focus = vi.fn()
    const w = loadWorker({ windows: [{ url: `${ORIGIN}/es/chat/abc`, focus }] })
    const close = vi.fn()
    await fire(w, 'notificationclick', { notification: { close, data: { url: '/es/chat/abc' } } })
    expect(close).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
    expect(w.opened).toEqual([])
  })

  it('si hay otra pestaña de KULTURA la lleva allí; si no, abre una', async () => {
    const focus = vi.fn()
    const navigate = vi.fn(async () => ({ focus }))
    const w = loadWorker({ windows: [{ url: `${ORIGIN}/es/home`, navigate, focus: vi.fn() }] })
    await fire(w, 'notificationclick', { notification: { close: () => {}, data: { url: '/es/friends' } } })
    expect(navigate).toHaveBeenCalledWith(`${ORIGIN}/es/friends`)
    expect(focus).toHaveBeenCalled()

    const w2 = loadWorker()
    await fire(w2, 'notificationclick', { notification: { close: () => {}, data: { url: 'https://evil.com' } } })
    expect(w2.opened).toEqual([`${ORIGIN}/`])
  })
})

describe('sw.js · pushsubscriptionchange', () => {
  it('se vuelve a suscribir con la misma clave y da de alta la nueva sustituyendo la vieja', async () => {
    const w = loadWorker()
    const key = new Uint8Array([4, 1, 2])
    await fire(w, 'pushsubscriptionchange', {
      oldSubscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/old', options: { applicationServerKey: key } },
      newSubscription: null,
    })
    expect(w.subscribed).toEqual([{ userVisibleOnly: true, applicationServerKey: key }])
    expect(w.fetches).toHaveLength(1)
    expect(w.fetches[0].url).toBe('/api/push/subscribe')
    expect(w.fetches[0].init).toMatchObject({ method: 'POST', credentials: 'same-origin' })
    expect(JSON.parse(w.fetches[0].init.body as string)).toEqual({
      endpoint: 'https://fcm.googleapis.com/fcm/send/new',
      keys: { p256dh: 'P', auth: 'A' },
      expirationTime: null,
      replaces: 'https://fcm.googleapis.com/fcm/send/old',
    })
  })

  it('sin suscripción vieja ni nueva no hace nada y no falla', async () => {
    const w = loadWorker()
    await fire(w, 'pushsubscriptionchange', { oldSubscription: null, newSubscription: null })
    expect(w.fetches).toEqual([])
  })
})
