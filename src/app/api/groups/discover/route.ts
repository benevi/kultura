// ============================================================
// KULTURA — GET /api/groups/discover
// Grupos para la pestaña "Descubrir": búsqueda + scope + size + paginación.
// Delega en getDiscoverableGroups (RPC get_discoverable_groups).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { getDiscoverableGroups } from '@/lib/social/groups'

const QuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  scope: z.enum(['all', 'joined', 'unjoined']).default('all'),
  size: z.enum(['all', 'small', 'medium', 'large']).default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const rl = checkRateLimit(`groups_discover:${user.id ?? `ip:${ip}`}`, LIMITS.search)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const sp = req.nextUrl.searchParams
  const parsed = QuerySchema.safeParse({
    q: sp.get('q') ?? undefined,
    scope: sp.get('scope') ?? undefined,
    size: sp.get('size') ?? undefined,
    limit: sp.get('limit') ?? undefined,
    offset: sp.get('offset') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })

  const groups = await getDiscoverableGroups(parsed.data)

  return NextResponse.json({ groups })
}
