import type { Metadata } from 'next'
import { LegalDocument, legalMetadata } from '@/components/legal/LegalDocument'

interface Props {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  return legalMetadata('privacy', locale)
}

export default function PrivacyPage() {
  return <LegalDocument doc="privacy" />
}
