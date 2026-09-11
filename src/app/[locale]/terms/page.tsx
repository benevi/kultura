import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { LegalDocument } from '@/components/legal/LegalDocument'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.terms')
  return { title: `${t('title')} · KULTURA` }
}

export default function TermsPage() {
  return <LegalDocument namespace="terms" sectionCount={11} />
}
