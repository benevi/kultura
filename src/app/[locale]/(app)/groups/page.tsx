// ============================================================
// KULTURA — /groups (Server Component)
// Descubrimiento de grupos + "Mis grupos". Requiere autenticación.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getUserGroups } from '@/lib/social/groups'
import { GroupsClient, type MyGroup } from './GroupsClient'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Grupos · KULTURA' }
}

export default async function GroupsPage() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const t = await getTranslations('groups')

  const groups = await getUserGroups(user.id)
  const myGroups: MyGroup[] = groups.map(g => ({
    id: g.id,
    name: g.name,
    description: g.description,
    coverColor: g.coverColor,
    memberRole: g.memberRole,
  }))

  return (
    <main className="max-w-2xl mx-auto px-4 md:px-8 py-8">
      <h1 className="font-display text-3xl mb-8">{t('pageTitle')}</h1>
      <GroupsClient myGroups={myGroups} />
    </main>
  )
}
