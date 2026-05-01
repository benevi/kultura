import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserMedia } from '@/lib/library/queries'
import { LibraryClient } from './LibraryClient'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('library')
  return { title: t('title') }
}

export default async function LibraryPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const entries = await getUserMedia(user.id)
  return (
    <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
      <LibraryClient entries={entries} />
    </main>
  )
}
