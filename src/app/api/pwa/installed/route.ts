// ============================================================
// KULTURA — Route Handler: POST /api/pwa/installed (F-23, MOV-3)
//
// El navegador avisa (`appinstalled`, vía `sendBeacon`) de que el usuario ha
// instalado la app, y se guarda como evento `app_installed` con `track()`
// (D-12: solo usuarios registrados, nada en el navegador). Una vez por
// usuario (`dedupeKey`), así que repetir la llamada no infla nada. La demo no
// deja rastro (lo filtra `track()`; el middleware ya la corta con 403).
//
// Siempre 204 salvo origen ajeno (403), sin sesión (401) o en bucle (429): quien llama es un
// beacon que no lee la respuesta.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { track } from '@/lib/analytics/track'
import { checkRateLimit } from '@/lib/rate-limit'

/** Un usuario instala una vez; 5/hora sobra y frena a quien lo repita en bucle. */
const INSTALLED_LIMIT = { windowMs: 60 * 60_000, max: 5 }

const PLATFORMS = new Set(['ios', 'android', 'desktop'])
const SOURCES = new Set(['banner', 'browser'])

/** Solo desde la propia web: un beacon de otra página no cuenta instalaciones. */
function sameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'
  const origin = request.headers.get('origin')
  return origin !== null && origin === new URL(request.url).origin
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!checkRateLimit(`${user.id}:pwa_installed`, INSTALLED_LIMIT).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: { platform?: unknown; source?: unknown } = {}
  try {
    const text = await request.text()
    if (text.length <= 512) body = JSON.parse(text) ?? {}
  } catch {
    body = {}
  }
  const platform = typeof body.platform === 'string' && PLATFORMS.has(body.platform) ? body.platform : 'unknown'
  const source = typeof body.source === 'string' && SOURCES.has(body.source) ? body.source : 'browser'

  await track(user, 'app_installed', { platform, source }, { dedupeKey: `app_installed:${user.id}` })
  return new NextResponse(null, { status: 204 })
}
