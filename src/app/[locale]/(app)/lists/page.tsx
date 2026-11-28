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
import { salaListasEnabled } from '@/lib/flags/sala'
import { SalaListsIndexLazy } from '@/components/lists/sala/SalaListsIndexLazy'

// TXT-5: el título iba fijo en español también en /en.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lists')
  return { title: t('title') }
}

export default async function ListsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fase 8.5 L1: el índice en «Sala» (bandera SALA_LISTAS: 0, prueba o 1),
  // con el mosaico de portadas de cada lista. Apagada, todo como hoy.
  if (await salaListasEnabled()) {
    const lists = await getUserLists(user.id, { covers: true })
    return <SalaListsIndexLazy lists={lists} viewerId={user.id} />
  }

  const lists = await getUserLists(user.id)

  return <ListsClient lists={lists} />
}
