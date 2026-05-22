import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { KButton } from '@/components/ui/KButton'

export default function NotFound() {
  const t = useTranslations('errors')

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center bg-surface-base">
      <p className="text-7xl font-display font-bold text-text-secondary">404</p>
      <h1 className="text-2xl font-display font-bold text-text-primary">
        {t('notFoundTitle')}
      </h1>
      <p className="text-text-secondary max-w-sm">{t('notFoundDescription')}</p>
      <KButton asChild variant="primary">
        <Link href="/home">{t('goHome')}</Link>
      </KButton>
    </div>
  )
}
