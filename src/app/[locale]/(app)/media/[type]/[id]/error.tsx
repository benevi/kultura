'use client'

import { useTranslations } from 'next-intl'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function MediaDetailError({ reset }: Props) {
  const t = useTranslations('errors')

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8 text-center">
      <p className="text-lg text-foreground">{t('somethingWentWrong')}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
      >
        {t('tryAgain')}
      </button>
    </div>
  )
}
