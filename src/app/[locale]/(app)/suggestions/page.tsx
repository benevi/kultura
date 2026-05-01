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
    <main className="max-w-xl mx-auto px-4 md:px-8 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-text mb-2">{t('title')}</h1>
        <p className="text-muted text-sm">{t('subtitle')}</p>
      </div>
      <div className="bg-surface border border-border rounded-xl p-6">
        <SuggestionsForm />
      </div>
    </main>
  )
}
