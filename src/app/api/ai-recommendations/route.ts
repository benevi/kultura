// ============================================================
// KULTURA — Route Handler: /api/ai-recommendations
// GET: genera recomendaciones IA personalizadas.
// ANTHROPIC_API_KEY solo se usa aquí — nunca en el cliente.
// ============================================================

import { NextResponse } from 'next/server'
import { getLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAiRecommendations } from '@/lib/claude/recommendations'
import { getUserStats } from '@/lib/library/stats'
import { checkRateLimit } from '@/lib/rate-limit'
import { isDemoUser } from '@/lib/demo'

// 5 req/min — AI calls are expensive
const AI_LIMIT = { windowMs: 60_000, max: 5 }

/**
 * E-DEMO: la cuenta demo la comparten TODOS los visitantes, así que sin esto
 * cada visita a Inicio sería una llamada al modelo (coste) y el límite por
 * usuario de arriba saltaría en cuanto entraran cinco personas a la vez. Su
 * biblioteca no cambia (es de solo lectura): una respuesta por idioma vale
 * horas. Caché en memoria de la instancia; una instancia fría paga una llamada.
 */
const DEMO_TTL_MS = 6 * 60 * 60_000
const demoCache = new Map<string, { at: number; body: unknown }>()

/** GET /api/ai-recommendations */
export async function GET(): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const demo = isDemoUser(user)
  const demoKey = demo ? await getLocale() : ''
  if (demo) {
    const hit = demoCache.get(demoKey)
    if (hit && Date.now() - hit.at < DEMO_TTL_MS) return NextResponse.json(hit.body)
  }

  const rl = checkRateLimit(`${user.id}:ai-recommendations`, AI_LIMIT)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const locale = await getLocale()
  const stats = await getUserStats(user.id)
  const topGenres = stats.topGenres.map((g) => g.genre)

  const recommendations = await getAiRecommendations(user.id, topGenres, locale, supabase)

  if (demo && recommendations.length > 0) demoCache.set(demoKey, { at: Date.now(), body: { recommendations } })

  return NextResponse.json({ recommendations })
}
