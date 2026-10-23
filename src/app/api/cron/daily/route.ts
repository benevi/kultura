// ============================================================
// KULTURA — Route Handler: /api/cron/daily (cron único)
//
// El plan Hobby de Vercel limita el número de cron jobs, así que hay UNO,
// diario (`vercel.json`), que hace todo lo periódico:
//   1. keep-alive de Supabase: llama por dentro a /api/health, que consulta la
//      base (el proyecto gratuito se pausa por inactividad);
//   2. purga de las cuentas cuyo borrado venció (ROJO-7, 7 días de gracia).
//
// El keep-alive se hace siempre (es inocuo y no puede depender de una
// variable mal puesta). La purga exige CRON_SECRET: Vercel manda
// `Authorization: Bearer <secreto>` en cada ejecución; sin la variable o con
// otro valor, la purga no se ejecuta (`purge.status` lo dice).
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

  // 1. Keep-alive, SIEMPRE: aunque falte o no coincida el secreto, la base
  //    tiene que recibir su consulta diaria (si no, Supabase Free se pausa).
  //    Es inocuo: lo mismo que ya hace /api/health, pública y con su propio
  //    límite por IP (aquí la "IP" es fija, así que un abuso de esta ruta
  //    agota ese cupo y no llega a la base más de 30 veces por minuto).
  const healthResponse = await healthCheck(
    new NextRequest(new URL('/api/health', req.url), { headers: { 'x-forwarded-for': 'cron-daily' } })
  )
  const health = (await healthResponse.json().catch(() => ({ ok: false }))) as { ok?: boolean }

  // Lo que borra datos exige el secreto. Sin él, solo el keep-alive.
  const secret = process.env.CRON_SECRET
  if (!secret || !authorized(req, secret)) {
    const purge = { status: secret ? 'unauthorized' : 'not_configured' } as const
    return NextResponse.json(
      { ok: health.ok === true, health, purge },
      { status: healthResponse.status, headers: noStore }
    )
  }

  // 2. Purga de cuentas.
  const purge = await purgeExpiredAccounts(createAdminClient()).catch((e: unknown) => {
    log.error(`purga: ${e instanceof Error ? e.message : String(e)}`)
    return { status: 'error' as const, deleted: 0, failed: 0 }
  })

  const ok = health.ok === true && purge.status !== 'error' && purge.failed === 0
  return NextResponse.json({ ok, health, purge }, { status: ok ? 200 : 500, headers: noStore })
}
