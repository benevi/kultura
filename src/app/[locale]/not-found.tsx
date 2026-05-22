import { useTranslations } from 'next-intl'
import { NotFoundContent } from '@/components/ui/NotFoundContent'

export default function NotFound() {
  const t = useTranslations('errors')

  return (
    <NotFoundContent
      title={t('notFoundTitle')}
      description={t('notFoundDescription')}
      goHome={t('goHome')}
      homeHref="/home"
    />
  )
}
