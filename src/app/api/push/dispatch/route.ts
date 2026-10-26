// ============================================================
// KULTURA — Route Handler: POST /api/push/dispatch (F-33)
//
// SIN sesión: lo llama la base de datos (trigger `push_on_event`, pg_net)
// justo después de crear un mensaje, una notificación o una amistad, con
//   Authorization: Bearer <PUSH_DISPATCH_SECRET>   y   { kind, id }.
// El secreto es el mismo que Víctor guarda en Vault (`push_dispatch_secret`).
// Se compara en tiempo constante. La fila se vuelve a leer aquí (nada de lo
// que llega se envía tal cual) y solo vale si es de los últimos 10 minutos.
// La petición que creó el mensaje no espera a esto: pg_net la hace aparte.
// Respuesta: { status, sent, removed, failed } (queda en net._http_response
// para depurar desde el SQL Editor).
// ============================================================

import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { readPushConfig } from '@/lib/push/config'
import { dispatchPush } from '@/lib/push/dispatch'
import { dispatchSchema } from '@/lib/push/schemas'

const log = createLogger('api/push/dispatch')
export const dynamic = 'force-dynamic'
export const maxDuration = 20
const MAX_BODY = 512

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function POST(request: Request): Promise<NextResponse> {
  const { config, problem } = readPushConfig()
  if (!config) {
    // Sin configuración no se puede ni comprobar el secreto: no se hace nada.
    if (problem !== 'flag_off') log.warn('Push sin configurar', { problem })
    return NextResponse.json({ error: 'push_disabled' }, { status: 503 })
  }
  if (!authorized(request, config.dispatchSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = await request.text().catch(() => '')
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = dispatchSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_event' }, { status: 400 })

  try {
    const result = await dispatchPush(parsed.data, { admin: createAdminClient(), config })
    if (result.failed > 0) log.warn('Avisos push sin entregar', { kind: parsed.data.kind, ...result })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    log.error('Fallo al enviar avisos push', { kind: parsed.data.kind, error: e })
    return NextResponse.json({ error: 'dispatch_failed' }, { status: 500 })
  }
}
