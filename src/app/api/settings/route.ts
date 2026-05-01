// ============================================================
// KULTURA — Route Handler: /api/settings
// GET:   devuelve username, avatar_color, preferred_locale del usuario
// PATCH: actualiza los campos enviados (validación Zod)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { isValidAvatarColor, isValidLocale } from '@/lib/constants/avatarColors'

const PatchSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  avatar_color: z
    .string()
    .refine(isValidAvatarColor, { message: 'invalid_avatar_color' })
    .optional(),
  preferred_locale: z
    .string()
    .refine(isValidLocale, { message: 'invalid_locale' })
    .optional(),
})

export async function GET(): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('users')
    .select('username, avatar_color, preferred_locale')
    .eq('id', user.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }

  const { username, avatar_color, preferred_locale } = parsed.data

  if (username) {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'username_taken' }, { status: 409 })
    }
  }

  const updates: Record<string, string> = {}
  if (username !== undefined) updates.username = username
  if (avatar_color !== undefined) updates.avatar_color = avatar_color
  if (preferred_locale !== undefined) updates.preferred_locale = preferred_locale

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true, updated: {} })
  }

  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id)
    .select('username, avatar_color, preferred_locale')
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ success: true, updated })
}
