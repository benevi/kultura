// ============================================================
// KULTURA — /lists (Server Component)
// Carga las listas del usuario y pasa datos al Client Component.
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserLists } from '@/lib/social/lists'
import { mixedListsEnabled } from '@/lib/social/lists-shared'
import { ListsClient } from './ListsClient'
import { isUiV2Enabled } from '@/lib/ui-v2'
import { ListsScreen } from '@/v2/lists/ListsScreen'
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

  // F0: conmutador de UI (src/lib/ui-v2.ts). Mismos datos, otra pantalla.
  if (await isUiV2Enabled()) return <ListsScreen lists={lists} />

  return <ListsClient lists={lists} mixedEnabled={mixedListsEnabled()} />
}
