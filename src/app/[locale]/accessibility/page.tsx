// Declaración de accesibilidad (WCAG 2.2 AA / EN 301 549): estado, fallos
// conocidos, método de evaluación, contacto y cauce de reclamación.
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
  return legalMetadata('accessibility', locale)
}

export default async function AccessibilityPage({ params }: Props) {
  setRequestLocale((await params).locale)
  return <LegalDocument doc="accessibility" />
}
