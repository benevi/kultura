// ============================================================
// KULTURA — /[locale]/report: denuncia sin cuenta (D-13, DSA art. 16)
// Pública (fuera de (app)): cualquiera puede avisar de un perfil, una ficha
// o una lista pública. `?target=<tipo>&id=<id>` viene de los botones de las
// páginas públicas y deja el formulario ya apuntando al contenido.
// ============================================================

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { isModerationV2 } from '@/lib/social/friends'
import { allowedTargetTypes } from '@/app/api/reports/shared'
import type { ReportTargetType } from '@/lib/social/actions'
import { PublicReportForm } from './PublicReportForm'

interface Props {
  searchParams: Promise<{ target?: string | string[]; id?: string | string[] }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('report.page')
  return {
    title: t('title'),
    description: t('metaDescription'),
    robots: { index: false, follow: true },
  }
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function ReportPage({ searchParams }: Props) {
  const t = await getTranslations('report.page')
  const params = await searchParams
  const types = allowedTargetTypes(isModerationV2(), 'public')

  const rawType = first(params.target)
  const presetType = types.includes(rawType as ReportTargetType) ? (rawType as ReportTargetType) : undefined
  const rawId = first(params.id)?.trim().slice(0, 500)
  const presetTarget = presetType && rawId ? rawId : undefined

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" className="page-grid [&>*]:max-w-2xl flex-1 py-12 md:py-16">
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-text-primary mb-3">
          {t('title')}
        </h1>
        <p className="text-text-secondary leading-relaxed mb-2">{t('intro')}</p>
        <p className="text-text-secondary leading-relaxed mb-8 text-sm">{t('process')}</p>
        <PublicReportForm types={types} presetType={presetType} presetTarget={presetTarget} />
        <p className="text-xs text-text-tertiary mt-8 leading-relaxed">{t('emergency')}</p>
      </main>
      <Footer />
    </div>
  )
}
