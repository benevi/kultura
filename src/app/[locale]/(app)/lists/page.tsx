// ============================================================
// KULTURA — /lists (Server Component)
// Carga las listas del usuario y pasa datos al Client Component.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserLists } from '@/lib/social/lists'
import { ListsClient } from './ListsClient'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Mis listas · KULTURA' }
}

export default async function ListsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const lists = await getUserLists(user.id)

  return <ListsClient lists={lists} />
}
