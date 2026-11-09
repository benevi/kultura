// ============================================================
// KULTURA — /lists (Server Component)
// Carga las listas del usuario y pasa datos al Client Component.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getListShelves, getUserLists } from '@/lib/social/lists'
import { mixedListsEnabled } from '@/lib/social/lists-shared'
import { ListsClient } from './ListsClient'
import { isUiV2Enabled } from '@/lib/ui-v2'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

// TXT-5: el título iba fijo en español también en /en.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lists')
  return { title: t('title') }
}

export default async function ListsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const lists = await getUserLists(user.id)

  // F0: conmutador de UI (src/lib/ui-v2.ts). Mismos datos y los lomos de la balda.
  if (await isUiV2Enabled()) {
    const { ListsScreen } = await import('@/v2/lists/ListsScreen')
    const shelves = await getListShelves(lists.map((list) => list.id))
    return (
      <ListsScreen lists={lists} shelves={shelves} currentUserId={user.id} mixedEnabled={mixedListsEnabled()} />
    )
  }

  return <ListsClient lists={lists} mixedEnabled={mixedListsEnabled()} />
}
