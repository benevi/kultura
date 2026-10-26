// ============================================================
// KULTURA — Route Handler: GET /api/push/status (F-33)
//
// Con sesión. Lo pide Ajustes al abrirse (nunca pide permiso al navegador):
//   { enabled, publicKey, devices, endpointHashes }
// `enabled` = PUSH_ENABLED=1 + par VAPID válido + secreto de envío + tabla
// creada. `endpointHashes` = huellas (endpointHash) de las suscripciones de la
// persona, para que el navegador sepa si la suya está dada de alta.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readPushConfig } from '@/lib/push/config'
import { endpointHash } from '@/lib/push/endpoint'

export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE })

  const disabled = { enabled: false, publicKey: null, devices: 0, endpointHashes: [] as string[] }
  const { config } = readPushConfig()
  if (!config) return NextResponse.json(disabled, { headers: NO_STORE })

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', user.id)
    .limit(50)
  // Sin la migración (o con la base caída) no se ofrece: mejor que un interruptor que falla.
  if (error) return NextResponse.json(disabled, { headers: NO_STORE })

  const rows = (data ?? []) as { endpoint: string }[]
  return NextResponse.json(
    {
      enabled: true,
      publicKey: config.publicKey,
      devices: rows.length,
      endpointHashes: await Promise.all(rows.map((r) => endpointHash(r.endpoint))),
    },
    { headers: NO_STORE },
  )
}
