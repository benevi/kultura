// ============================================================
// KULTURA — Route Handler: /api/cron/daily (cron único)
//
// El plan Hobby de Vercel limita el número de cron jobs, así que hay UNO,
// diario (`vercel.json`), que hace todo lo periódico:
//   1. keep-alive de Supabase: llama por dentro a /api/health, que consulta la
//      base (el proyecto gratuito se pausa por inactividad);
//   2. purga de las cuentas cuyo borrado venció (ROJO-7, 7 días de gracia).
//
// Protegido con CRON_SECRET: Vercel manda `Authorization: Bearer <secreto>`
// en cada ejecución. Sin la variable, no hace nada (503) en vez de quedar
// abierto a cualquiera.
// ============================================================

import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { GET as healthCheck } from '@/app/api/health/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/logger'
import { purgeExpiredAccounts } from './purge'

const log = createLogger('cron/daily')

/** Nunca en caché: cada ejecución tiene que tocar la base. */
export const dynamic = 'force-dynamic'

function authorized(req: NextRequest, secret: string): boolean {
  const given = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const noStore = { 'Cache-Control': 'no-store' }
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503, headers: noStore })
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: noStore })
  }

  // 1. Keep-alive (misma ruta que vigila el monitor externo).
  const healthResponse = await healthCheck(
    new NextRequest(new URL('/api/health', req.url), { headers: { 'x-forwarded-for': 'cron-daily' } })
  )
  const health = (await healthResponse.json().catch(() => ({ ok: false }))) as { ok?: boolean }

  // 2. Purga de cuentas.
  const purge = await purgeExpiredAccounts(createAdminClient()).catch((e: unknown) => {
    log.error(`purga: ${e instanceof Error ? e.message : String(e)}`)
    return { status: 'error' as const, deleted: 0, failed: 0 }
  })

  const ok = health.ok === true && purge.status !== 'error' && purge.failed === 0
  return NextResponse.json({ ok, health, purge }, { status: ok ? 200 : 500, headers: noStore })
}
