// ============================================================
// KULTURA — Route Handler: /api/ai-recommendations
// GET: recomendaciones de "Para ti" del día (D-06).
//
// Solo se llama cuando el usuario pulsa "Recomiéndame": el componente ya no
// pide nada al montarse. Como mucho UNA llamada al modelo por usuario y día,
// sea cual sea el idioma (`getDailyAiRecommendations`, guardada en `ai_recs`) y un tope global
// diario compartido con las traducciones (`AI_DAILY_CALL_CAP`). Al llegar al
// tope se responde `{ source: 'match', capped: true }` con el orden por match.
//
// ANTHROPIC_API_KEY solo se usa en el servidor — nunca en el cliente.
// ============================================================

import { NextResponse } from 'next/server'
import { getLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getDailyAiRecommendations, readTodayAiRecommendations } from '@/lib/claude/recommendations'
import { getStarterItems } from '@/lib/recommendations/starter'
import { getUserStats } from '@/lib/library/stats'
import { checkRateLimit } from '@/lib/rate-limit'

// 5 req/min para GENERAR: frena a quien martillea la ruta cuando no hay nada
// guardado (cada intento barre proveedores y puede gastar cupo de IA).
const AI_LIMIT = { windowMs: 60_000, max: 5 }

/** GET /api/ai-recommendations */
export async function GET(): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const locale = await getLocale()

  // Lo de hoy, si ya existe, se sirve ANTES del límite por minuto: es una
  // lectura sin coste y, sobre todo, la cuenta demo (E-DEMO) la comparten
  // todos los visitantes, que con el límite delante se pisarían en cuanto
  // pulsaran cinco a la vez. Su biblioteca no cambia: una generación al día
  // les vale a todos.
  const today = await readTodayAiRecommendations(user.id, locale)
  if (today) return NextResponse.json(today)

  const rl = checkRateLimit(`${user.id}:ai-recommendations`, AI_LIMIT)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const stats = await getUserStats(user.id)
  const topGenres = stats.topGenres.map((g) => g.genre)

  const result = await getDailyAiRecommendations(user.id, topGenres, locale, supabase)

  // Sin recomendaciones (biblioteca corta o ningún proveedor respondió) Inicio
  // no se queda vacío: lo más popular ahora mismo, un título de cada formato.
  if (result.recommendations.length === 0) {
    const starter = await getStarterItems(locale)
    return NextResponse.json({ ...result, starter })
  }

  return NextResponse.json(result)
}
