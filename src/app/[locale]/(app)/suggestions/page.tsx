// ============================================================
// KULTURA — /suggestions (Server Component)
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { SuggestionsForm } from './SuggestionsForm'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('suggestions')
  return { title: `${t('title')} · KULTURA` }
}

export default async function SuggestionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('suggestions')

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-14 pt-2 pb-14">
      <div className="mb-7">
        <h1 className="font-display text-[34px] md:text-[42px] font-bold text-text-primary mb-2">
          {t('title')} <span aria-hidden="true">💡</span>
        </h1>
        <p className="text-text-tertiary text-sm">{t('subtitle')}</p>
      </div>
      <div className="max-w-[640px] bg-surface-default rounded-[20px] p-6 sm:p-7">
        <SuggestionsForm />
      </div>
    </main>
  )
}
