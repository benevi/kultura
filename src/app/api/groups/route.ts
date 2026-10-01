// ============================================================
// KULTURA — /api/groups
// GET: grupos del usuario autenticado
// POST: crear nuevo grupo
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { checkRateLimit, LIMITS } from '@/lib/rate-limit'
import { isValidAvatarIcon } from '@/components/icons/avatars'
import { getUserGroups } from '@/lib/social/groups'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/groups')

const CreateGroupSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(200).optional(),
  cover_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  is_public: z.boolean().optional().default(true),
  // E-AVATAR-ICONS: mismo catálogo que los avatares de usuario; null/ausente →
  // el grupo se sigue identificando por su inicial.
  icon: z.string().refine(isValidAvatarIcon, { message: 'invalid_icon' }).nullable().optional(),
})

export async function GET(): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const groups = await getUserGroups(user.id)

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
      is_public: parsed.data.is_public,
      // Solo se manda si el usuario eligió icono: así crear un grupo sigue
      // funcionando aunque la migración de `groups.icon` no esté aplicada
      // todavía (mandar una columna inexistente es un error duro, no un no-op).
      ...(parsed.data.icon ? { icon: parsed.data.icon } : {}),
    })
    .select()
    .single()

  if (error) {
    log.error('group create error', { err: error })
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })
  }

  return NextResponse.json({ group }, { status: 201 })
}
