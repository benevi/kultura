// ============================================================
// KULTURA — Route Handler: /api/cron/daily (cron único)
//
// El plan Hobby de Vercel limita el número de cron jobs, así que hay UNO,
// diario (`vercel.json`), que hace todo lo periódico:
//   1. keep-alive de Supabase: llama por dentro a /api/health, que consulta la
//      base (el proyecto gratuito se pausa por inactividad);
//   2. purga de las cuentas cuyo borrado venció (ROJO-7, 7 días de gracia);
//   3. retención de la analítica de producto (13 meses, F-17);
//   4. los lunes, el correo semanal (F-28; detrás de WEEKLY_EMAIL=1 y sus
//      claves: sin ellas `weekly.status` dice `disabled` y por qué).
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
import { purgeOldAnalytics } from './analytics'
import { defaultDigestDeps, runWeeklyDigest } from '@/lib/email/digest'

const log = createLogger('cron/daily')

/** Nunca en caché: cada ejecución tiene que tocar la base. */
export const dynamic = 'force-dynamic'
/** El máximo de Hobby: el correo semanal se corta solo a los ~35 s (digest.ts). */
export const maxDuration = 60

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
  const admin = createAdminClient()
  const purge = await purgeExpiredAccounts(admin).catch((e: unknown) => {
    log.error(`purga: ${e instanceof Error ? e.message : String(e)}`)
    return { status: 'error' as const, deleted: 0, failed: 0 }
  })

  // 3. Retención de la analítica (tolera que la función no exista aún).
  const analytics = await purgeOldAnalytics(admin)

  // 4. Correo semanal (solo los lunes; martes y miércoles recupera lo pendiente).
  const weekly = await runWeeklyDigest(defaultDigestDeps(admin)).catch((e: unknown) => {
    log.error(`correo semanal: ${e instanceof Error ? e.message : String(e)}`)
    return { status: 'error' as const }
  })

  const ok =
    health.ok === true &&
    purge.status !== 'error' &&
    purge.failed === 0 &&
    analytics.status !== 'error' &&
    weekly.status !== 'error'
  return NextResponse.json({ ok, health, purge, analytics, weekly }, { status: ok ? 200 : 500, headers: noStore })
}
