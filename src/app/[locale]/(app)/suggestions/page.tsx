// ============================================================
// KULTURA — /suggestions (Server Component)
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { PageHeading } from '@/components/layout/PageHeading'
import { IconIdea } from '@/components/icons'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { SuggestionsForm } from './SuggestionsForm'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('suggestions')
  return { title: `${t('title')}` }
}

export default async function SuggestionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('suggestions')

  return (
    <main className="page-grid [&>*]:max-w-[640px] py-10">
      <div className="mb-8">
        <PageHeading icon={IconIdea} className="mb-2">{t('title')}</PageHeading>
        <p className="text-text-tertiary text-sm">{t('subtitle')}</p>
      </div>
      <div className="bg-surface-default rounded-bento p-6 sm:p-7">
        <SuggestionsForm />
      </div>
    </main>
  )
}
