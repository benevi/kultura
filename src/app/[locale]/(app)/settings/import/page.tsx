// ============================================================
// KULTURA — /[locale]/settings/import (F-26, D-15)
//
// Importar desde Letterboxd, MyAnimeList, Goodreads, IMDb y TV Time, y
// exportar las películas a Letterboxd. Zona con sesión (`(app)`): HTML
// dinámico con nonce, como el resto de Ajustes. La demo ve la página pero no
// puede importar (y la API lo rechaza igualmente).
// ============================================================

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMessages, getTranslations } from 'next-intl/server'
import type { AbstractIntlMessages } from 'next-intl'
import { createClient } from '@/lib/supabase/server'
import { isDemoUser } from '@/lib/demo'
import { PageHeading } from '@/components/layout/PageHeading'
import { ImportClient } from './ImportClient'
import { LetterboxdExport } from './LetterboxdExport'
import { ImportMessages } from '@/lib/import/i18n'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'import' })
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

export default async function ImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/settings/import`)}`)

  const t = await getTranslations({ locale, namespace: 'import' })
  const tSettings = await getTranslations({ locale, namespace: 'settings' })
  // Los textos del importador viajan solo a esta página (ver `lib/import/i18n.tsx`).
  const importMessages = ((await getMessages({ locale })) as Record<string, unknown>).import as AbstractIntlMessages

  return (
    <main className="page-grid [&>*]:max-w-[720px] flex flex-col gap-7 py-8">
      <div className="flex flex-col gap-2">
        <Link
          href={`/${locale}/settings`}
          className="inline-flex min-h-[44px] w-fit items-center font-body text-sm font-bold text-text-tertiary underline-offset-4 hover:text-text-primary hover:underline"
        >
          ← {tSettings('title')}
        </Link>
        <PageHeading emoji="📥" className="mb-0">
          {t('title')}
        </PageHeading>
      </div>
      <ImportMessages locale={locale} messages={importMessages}>
        <ImportClient locale={locale === 'en' ? 'en' : 'es'} userId={user.id} isDemo={isDemoUser(user)} />
        <LetterboxdExport />
      </ImportMessages>
    </main>
  )
}
