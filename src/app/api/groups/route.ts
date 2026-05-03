// ============================================================
// KULTURA — /api/groups
// GET: grupos del usuario autenticado
// POST: crear nuevo grupo
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'

const CreateGroupSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(200).optional(),
  cover_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export async function GET(): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data } = await supabase
    .from('group_members')
    .select('group_id, role, groups(id, name, description, cover_color, created_at, owner_id)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  const groups = ((data ?? []) as unknown as Array<{
    group_id: string
    role: string
    groups: {
      id: string; name: string; description: string | null
      cover_color: string; created_at: string; owner_id: string
    } | null
  }>).map((row) => ({
    ...(row.groups ?? {}),
    memberRole: row.role,
  }))

  return NextResponse.json({ groups })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const rl = checkRateLimit(`groups:${user.id}`, LIMITS.groups)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = CreateGroupSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const { data: group, error } = await supabase
    .from('groups')
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      cover_color: parsed.data.cover_color ?? '#E82020',
    })
    .select()
    .single()

  if (error) {
    console.error('group create error:', error)
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }

  return NextResponse.json({ group }, { status: 201 })
}
