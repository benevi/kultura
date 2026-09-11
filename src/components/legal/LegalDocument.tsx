import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

interface LegalDocumentProps {
  /** Namespace bajo `legal` en messages/*.json, ej. 'privacy' o 'terms'. */
  namespace: 'privacy' | 'terms'
  /** Número de secciones (s1Title/s1Body … sNTitle/sNBody) definidas en ese namespace. */
  sectionCount: number
}

export async function LegalDocument({ namespace, sectionCount }: LegalDocumentProps) {
  const t = await getTranslations(`legal.${namespace}`)

  const sections = Array.from({ length: sectionCount }, (_, i) => i + 1)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 px-4 md:px-8 py-16 max-w-3xl mx-auto w-full">
        <h1 className="font-display text-4xl md:text-5xl tracking-wide text-text mb-2">
          {t('title')}
        </h1>
        <p className="text-muted text-sm mb-10">{t('updated')}</p>
        <p className="text-text leading-relaxed mb-10">{t('intro')}</p>

        <div className="flex flex-col gap-8">
          {sections.map((n) => (
            <section key={n}>
              <h2 className="font-display text-xl tracking-wide text-text mb-2">
                {t(`s${n}Title`)}
              </h2>
              <p className="text-muted leading-relaxed">{t(`s${n}Body`)}</p>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
