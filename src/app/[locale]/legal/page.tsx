// Aviso legal (LSSI art. 10) y puntos de contacto del Reglamento de Servicios
// Digitales (arts. 11 y 12), con el enlace al formulario público de /report.
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { routing } from '@/i18n/routing'
import { LegalDocument, legalMetadata } from '@/components/legal/LegalDocument'

interface Props {
  params: Promise<{ locale: string }>
}

// D-02: HTML estático por idioma, servido desde el CDN.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  setRequestLocale(locale)
  return legalMetadata('notice', locale)
}

export default async function LegalNoticePage({ params }: Props) {
  setRequestLocale((await params).locale)
  return <LegalDocument doc="notice" />
}
