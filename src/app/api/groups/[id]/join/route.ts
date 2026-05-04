// ============================================================
// KULTURA — POST /api/groups/[id]/join
// Join or leave a group
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGroupById, getMemberRole } from '@/lib/social/groups'

interface Props {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, { params }: Props): Promise<NextResponse> {
  const { id } = await params
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const group = await getGroupById(id)
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  const existingRole = await getMemberRole(id, user.id)

  if (existingRole) {
    if (existingRole === 'owner') {
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
