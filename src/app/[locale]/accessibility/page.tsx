// Declaración de accesibilidad (WCAG 2.2 AA / EN 301 549): estado, fallos
// conocidos, método de evaluación, contacto y cauce de reclamación.
import type { Metadata } from 'next'
import { LegalDocument, legalMetadata } from '@/components/legal/LegalDocument'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return legalMetadata('accessibility', locale)
}

export default function AccessibilityPage() {
  return <LegalDocument doc="accessibility" />
}
