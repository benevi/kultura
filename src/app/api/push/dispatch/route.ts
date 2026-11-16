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
// Respuesta: { data: { status, sent, removed, failed } } o { error: { code } }
// (queda en net._http_response para depurar desde el SQL Editor).
// Contrato: src/lib/api/contracts/push.ts (saneamiento 9).
// ============================================================

import { timingSafeEqual } from 'node:crypto'
import { apiError, ok, parseBody } from '@/lib/api/route'
import { dispatchSchema, PUSH_ERRORS } from '@/lib/api/contracts/push'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { readPushConfig } from '@/lib/push/config'
import { dispatchPush } from '@/lib/push/dispatch'

const log = createLogger('api/push/dispatch')
export const dynamic = 'force-dynamic'
export const maxDuration = 20
const MAX_BODY = 512

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function POST(request: Request) {
  const { config, problem } = readPushConfig()
  if (!config) {
    // Sin configuración no se puede ni comprobar el secreto: no se hace nada.
    if (problem !== 'flag_off') log.warn('Push sin configurar', { problem })
    return apiError('unavailable', { message: PUSH_ERRORS.disabled })
  }
  if (!authorized(request, config.dispatchSecret)) return apiError('unauthenticated')

  const parsed = await parseBody(request, dispatchSchema, { maxBytes: MAX_BODY })
  if (!parsed.ok) return parsed.response
  const event = parsed.value

  try {
    const result = await dispatchPush(event, { admin: createAdminClient(), config })
    if (result.failed > 0) log.warn('Avisos push sin entregar', { kind: event.kind, ...result })
    return ok(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    log.error('Fallo al enviar avisos push', { kind: event.kind, error: e })
    return apiError('internal', { message: 'dispatch_failed' })
  }
}
