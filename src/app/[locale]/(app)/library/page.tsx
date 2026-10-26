import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserMedia } from '@/lib/library/queries'
import { readDiary } from '@/lib/library/diary'
import { ratingScale10Enabled, readRatingScale } from '@/lib/library/scale'
import { createLogger } from '@/lib/logger'
import { LibraryClient } from './LibraryClient'
import type { Metadata } from 'next'
import type { DiaryLog, RatingScale } from '@/types/library'
import { getTranslations } from 'next-intl/server'

const log = createLogger('library/page')

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('library')
  return { title: t('title') }
}

export default async function LibraryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // F-24: el diario solo con RATING_SCALE_10=1 y la migración aplicada; si
  // falta la tabla o falla, la Biblioteca de siempre.
  const diaryPromise: Promise<{ logs: DiaryLog[]; scale: RatingScale } | null> = ratingScale10Enabled()
    ? readDiary(supabase, user.id, { withMedia: true })
        .then((d) => (d.migrated ? { logs: d.logs, scale: readRatingScale(user) } : null))
        .catch((err) => {
          log.error('Failed to read diary', { err })
          return null
        })
    : Promise.resolve(null)

  const [entries, diary] = await Promise.all([getUserMedia(user.id), diaryPromise])
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      <LibraryClient entries={entries} diary={diary} />
    </main>
  )
}
