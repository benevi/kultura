import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserMedia } from '@/lib/library/queries'
import { readDiary } from '@/lib/library/diary'
import { readRatingScale } from '@/lib/library/scale'
import { createLogger } from '@/lib/logger'
import { salaBibliotecaEnabled } from '@/lib/flags/sala'
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

  // F-24: el diario; si falta la tabla o falla, la Biblioteca de siempre.
  const diaryPromise: Promise<{ logs: DiaryLog[]; scale: RatingScale } | null> = readDiary(supabase, user.id, {
    withMedia: true,
  })
    .then((d) => (d.migrated ? { logs: d.logs, scale: readRatingScale(user) } : null))
    .catch((err) => {
      log.error('Failed to read diary', { err })
      return null
    })

  // Fase 8.5 B1: la rejilla de «Sala» (bandera SALA_BIBLIOTECA: 0, prueba o 1).
  const [entries, diary, sala] = await Promise.all([getUserMedia(user.id), diaryPromise, salaBibliotecaEnabled()])
  // Los textos de la zona de avisos de «Sala», los mismos que en la ficha. Van
  // por aquí para no mandar todo `media_detail` a cada página con sesión (REN-5).
  const tMedia = sala ? await getTranslations('media_detail') : null
  const salaProps = tMedia
    ? {
        toastLabels: {
          region: tMedia('salaToastRegion'),
          dismiss: tMedia('salaToastDismiss'),
          hint: tMedia('salaToastHint'),
        },
      }
    : null
  return (
    <main className="page-grid py-8">
      <LibraryClient
        entries={entries}
        diary={diary}
        quickEdit={process.env.LIBRARY_QUICK_EDIT === '1'}
        sala={salaProps}
      />
    </main>
  )
}
