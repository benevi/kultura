import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LegalDocument } from '@/components/legal/LegalDocument'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.privacy')
  return { title: `${t('title')} · KULTURA` }
}

export default function PrivacyPage() {
  return <LegalDocument namespace="privacy" sectionCount={10} />
}
