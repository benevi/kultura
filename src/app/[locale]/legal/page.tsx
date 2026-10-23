// Aviso legal (LSSI art. 10) y puntos de contacto del Reglamento de Servicios
// Digitales (arts. 11 y 12), con el enlace al formulario público de /report.
import type { Metadata } from 'next'
import { LegalDocument, legalMetadata } from '@/components/legal/LegalDocument'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return legalMetadata('notice', locale)
}

export default function LegalNoticePage() {
  return <LegalDocument doc="notice" />
}
