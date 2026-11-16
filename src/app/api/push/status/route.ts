// ============================================================
// KULTURA — Route Handler: GET /api/push/status (F-33)
//
// Con sesión. Lo pide Ajustes al abrirse (nunca pide permiso al navegador):
//   { data: { enabled, publicKey, devices, endpointHashes } }
// `enabled` = PUSH_ENABLED=1 + par VAPID válido + secreto de envío + tabla
// creada. `endpointHashes` = huellas (endpointHash) de las suscripciones de la
// persona, para que el navegador sepa si la suya está dada de alta.
// Contrato: src/lib/api/contracts/push.ts (saneamiento 9).
// ============================================================

import { ok, requireUser } from '@/lib/api/route'
import type { PushStatus } from '@/lib/api/contracts/push'
import { readPushConfig } from '@/lib/push/config'
import { endpointHash } from '@/lib/push/endpoint'

export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const disabled: PushStatus = { enabled: false, publicKey: null, devices: 0, endpointHashes: [] }
  const { config } = readPushConfig()
  if (!config) return ok(disabled, { headers: NO_STORE })

  const { data, error } = await auth.supabase
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', auth.user.id)
    .limit(50)
  // Sin la migración (o con la base caída) no se ofrece: mejor que un interruptor que falla.
  if (error) return ok(disabled, { headers: NO_STORE })

  const rows = (data ?? []) as { endpoint: string }[]
  return ok<PushStatus>(
    {
      enabled: true,
      publicKey: config.publicKey,
      devices: rows.length,
      endpointHashes: await Promise.all(rows.map((r) => endpointHash(r.endpoint))),
    },
    { headers: NO_STORE },
  )
}
