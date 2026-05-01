// ============================================================
// KULTURA — Route Handler: /api/suggestions
// POST: guarda sugerencia del usuario en Supabase
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const SuggestionSchema = z.object({
  type: z.enum(['bug', 'feature', 'improvement', 'other']),
  subject: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = SuggestionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  const { error } = await supabase.from('suggestions').insert({
    user_id: user.id,
    type: parsed.data.type,
    subject: parsed.data.subject,
    description: parsed.data.description,
  })

  if (error) {
    console.error('suggestions insert error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
