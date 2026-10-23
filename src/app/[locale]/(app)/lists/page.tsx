// ============================================================
// KULTURA — /lists (Server Component)
// Carga las listas del usuario y pasa datos al Client Component.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserLists } from '@/lib/social/lists'
import { ListsClient } from './ListsClient'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

// TXT-5: el título iba fijo en español también en /en.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lists')
  return { title: t('title') }
}

export default async function ListsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const lists = await getUserLists(user.id)

  return <ListsClient lists={lists} />
}
