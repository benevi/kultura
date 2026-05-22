'use client'

import { useTranslations } from 'next-intl'
import { KButton } from '@/components/ui/KButton'

interface ErrorStateProps {
  reset: () => void
  minHeight?: string
}

export function ErrorState({ reset, minHeight = 'min-h-[40vh]' }: ErrorStateProps) {
  const t = useTranslations('errors')

  return (
    <div className={`flex flex-col items-center justify-center ${minHeight} gap-4 p-8 text-center`}>
      <p className="text-lg text-text-primary">{t('somethingWentWrong')}</p>
      <KButton variant="secondary" onClick={reset}>
        {t('tryAgain')}
      </KButton>
    </div>
  )
}
