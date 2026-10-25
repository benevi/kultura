import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { useLocale, useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { NotFoundContent } from '@/components/ui/NotFoundContent'
import { isAppLocale, localeFromAcceptLanguage } from '@/i18n/detect'
import { SITE_NAME } from '@/i18n/metadata'

/**
 * ACC-7/TXT-5: `<title>` en el idioma de la URL (antes, siempre el de la
 * portada en español). Absoluto porque con un primer segmento que no es un
 * idioma (`/algo.php`) el layout no da plantilla; entonces manda el navegador.
 */
export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }> | { locale?: string }
}): Promise<Metadata> {
  const raw = (await params)?.locale
  const locale = isAppLocale(raw) ? raw : localeFromAcceptLanguage((await headers()).get('accept-language'))
  const t = await getTranslations({ locale, namespace: 'errors' })
  return { title: { absolute: `${t('notFoundTitle')} · ${SITE_NAME}` }, robots: { index: false } }
}

export default function NotFound() {
  const t = useTranslations('errors')
  const locale = useLocale()

  return (
    <NotFoundContent
      title={t('notFoundTitle')}
      description={t('notFoundDescription')}
      goHome={t('goHome')}
      homeHref={`/${locale}`}
    />
  )
}
