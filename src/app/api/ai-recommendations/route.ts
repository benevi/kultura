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

// 5 req/min — Anthropic calls are expensive
const AI_LIMIT = { windowMs: 60_000, max: 5 }

/** GET /api/ai-recommendations */
export async function GET(): Promise<NextResponse> {
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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

  const recommendations = await getAiRecommendations(user.id, topGenres, locale)

  return NextResponse.json({ recommendations })
}
