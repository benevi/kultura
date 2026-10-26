// ============================================================
// KULTURA — Route Handler: /api/email/unsubscribe (F-28, CRE-9; RFC 8058)
//
// Baja del correo semanal SIN sesión, con el enlace firmado del correo
// (src/lib/email/unsubscribe-token.ts).
//
// - GET  ?t=…&l=es → 303 a la página /[l]/email/unsubscribe?t=…, que pide
//   confirmar con un botón. Un GET NUNCA da de baja: los clientes y filtros
//   de correo (y los antivirus) abren los enlaces por su cuenta.
// - POST con `List-Unsubscribe=One-Click` (RFC 8058: lo manda el propio
//   cliente de correo, p. ej. el botón "Cancelar suscripción" de Gmail) →
//   baja y 200, sin redirección ni contenido que cargar.
// - POST del formulario de la página (campos `t` y `l`) → baja y 303 a la
//   página con `?status=done`.
// La baja es idempotente (dos veces = una) y solo cambia algo si la persona
// estaba apuntada. En los registros nunca va el token ni el id.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { clientIp } from '@/lib/api/discover-params'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { EMAIL_TOKEN_SECRET_MIN } from '@/lib/email/config'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { unsubscribeWeekly } from '@/lib/email/preferences'

const log = createLogger('api/email/unsubscribe')

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 4096
const LIMIT = { windowMs: 60_000, max: 20 }
const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

function localeOf(value: unknown): 'es' | 'en' {
  return value === 'en' ? 'en' : 'es'
}

function pageUrl(request: NextRequest, locale: 'es' | 'en', params: Record<string, string>): URL {
  const url = new URL(`/${locale}/email/unsubscribe`, request.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url
}

function secret(): string | null {
  const value = process.env.EMAIL_TOKEN_SECRET?.trim() ?? ''
  return value.length >= EMAIL_TOKEN_SECRET_MIN ? value : null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('t') ?? ''
  const locale = localeOf(request.nextUrl.searchParams.get('l'))
  const target = pageUrl(request, locale, token ? { t: token.slice(0, 200) } : {})
  return NextResponse.redirect(target, { status: 303, headers: NO_STORE })
}

async function readForm(request: NextRequest): Promise<URLSearchParams> {
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw new Error('too large')
  const type = request.headers.get('content-type') ?? ''
  if (type.startsWith('multipart/form-data')) {
    // RFC 8058 admite multipart; se reconstruye para leer sus campos.
    const form = await new Request('http://local', { method: 'POST', headers: { 'content-type': type }, body: text }).formData()
    const out = new URLSearchParams()
    form.forEach((v, k) => {
      if (typeof v === 'string') out.append(k, v)
    })
    return out
  }
  return new URLSearchParams(text)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return new NextResponse(null, { status: 413, headers: NO_STORE })

  let form: URLSearchParams
  try {
    form = await readForm(request)
  } catch {
    return new NextResponse(null, { status: 400, headers: NO_STORE })
  }

  const oneClick = form.get('List-Unsubscribe') === 'One-Click'
  const token = form.get('t') ?? request.nextUrl.searchParams.get('t') ?? ''
  const locale = localeOf(form.get('l') ?? request.nextUrl.searchParams.get('l'))
  const reply = (status: 'done' | 'invalid' | 'error', httpStatus: number) =>
    oneClick
      ? new NextResponse(status === 'done' ? 'OK' : null, {
          status: httpStatus,
          headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' },
        })
      : NextResponse.redirect(
          pageUrl(request, locale, status === 'error' ? { status, t: token.slice(0, 200) } : { status }),
          { status: 303, headers: NO_STORE }
        )

  const rl = checkRateLimit(`email-unsub:${clientIp(request.headers)}`, LIMIT)
  if (!rl.allowed) {
    return oneClick
      ? new NextResponse(null, { status: 429, headers: { ...NO_STORE, 'Retry-After': String(rl.retryAfterSeconds) } })
      : reply('error', 429)
  }

  const key = secret()
  if (!key) {
    log.error('baja de correo sin EMAIL_TOKEN_SECRET: no se puede verificar el enlace')
    return reply('error', 503)
  }
  const check = verifyUnsubscribeToken(token, key)
  if (!check.ok) return reply('invalid', 400)

  const result = await unsubscribeWeekly(createAdminClient(), check.userId, oneClick ? 'one_click' : 'unsubscribe_page')
  if (!result.ok && result.reason === 'error') {
    log.error('baja de correo: la base no respondió')
    return reply('error', 500)
  }
  // Sin la migración nadie puede estar apuntado: el resultado es el mismo (de baja).
  return reply('done', 200)
}
