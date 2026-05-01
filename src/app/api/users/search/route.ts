// ============================================================
// KULTURA — GET /api/users/search?q=username
// Busca usuarios por username (solo autenticados)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ users: [] })

  const { data } = await supabase
    .from('users')
    .select('id, username, avatar_color, avatar_initials')
    .ilike('username', `%${q}%`)
    .neq('id', user.id)
    .limit(8)

  return NextResponse.json({ users: data ?? [] })
}
