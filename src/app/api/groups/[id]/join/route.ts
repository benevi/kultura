// ============================================================
// KULTURA — POST /api/groups/[id]/join
// Join or leave a group
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: Props): Promise<NextResponse> {
  const { id } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  const { data: existing } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    if (existing.role === 'owner') {
      return NextResponse.json({ error: 'Owner cannot leave group' }, { status: 400 })
    }
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: 'Failed to leave group' }, { status: 500 })
    return NextResponse.json({ joined: false })
  }

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: id, user_id: user.id, role: 'member' })

  if (error) return NextResponse.json({ error: 'Failed to join group' }, { status: 500 })
  return NextResponse.json({ joined: true }, { status: 201 })
}
