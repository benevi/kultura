// ============================================================
// KULTURA — Documentos legales (F-19: SEG-6, TXT-10, DIS-11)
//
// Una sola plantilla para privacidad, términos, aviso legal y declaración de
// accesibilidad. El contenido vive en los mensajes (`legal.privacy`,
// `legal.terms`, `legal.notice` y `accessibility`) con la misma forma:
//
//   title · metaDescription · updated · version
//   summary: { s1…sN }          → «Lo importante», arriba del todo
//   intro
//   sections: { <id>: { title, p1, list: { … }, p2, … } }
//
// Las secciones y sus bloques se pintan en el orden del JSON (`t.raw`), así
// que añadir un párrafo o una sección no exige tocar código ni contadores.
// Cada sección lleva `id` para enlazarla (`/es/legal#security`, que cita
// `security.txt`). Todos los textos admiten las mismas etiquetas (ver
// `richTags`). Server Component: los mensajes legales nunca viajan al cliente.
// ============================================================

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { siteUrl } from '@/lib/site-url'
import { LEGAL_CONTACT_EMAIL } from '@/app/.well-known/contact'

export { LEGAL_CONTACT_EMAIL }

/** Web de la Agencia Española de Protección de Datos. */
const AEPD_URL = 'https://www.aepd.es'

export type LegalDoc = 'privacy' | 'terms' | 'notice' | 'accessibility'

/** Orden de la navegación entre documentos. */
export const LEGAL_DOCS: readonly LegalDoc[] = ['privacy', 'terms', 'notice', 'accessibility']

const DOCS: Record<LegalDoc, { namespace: string; path: string }> = {
  privacy: { namespace: 'legal.privacy', path: '/privacy' },
  terms: { namespace: 'legal.terms', path: '/terms' },
  notice: { namespace: 'legal.notice', path: '/legal' },
  accessibility: { namespace: 'accessibility', path: '/accessibility' },
}

/** Ruta (sin idioma) de cada documento. */
export function legalPath(doc: LegalDoc): string {
  return DOCS[doc].path
}

/** Dominio público sin protocolo, p. ej. `kulturaapp.vercel.app`. */
export function siteHost(): string {
  return siteUrl().replace(/^https?:\/\//, '')
}

const TEXT_LINK =
  'underline underline-offset-2 decoration-1 text-text-primary hover:text-accent-pink transition-colors rounded-[4px] ' +
  'focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'

const CHIP =
  'inline-flex items-center min-h-11 px-4 rounded-pill text-sm font-body font-medium whitespace-nowrap transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base'

type Chunks = (chunks: ReactNode) => ReactNode

/** Etiquetas y valores comunes a todos los textos legales. */
function richTags(): Record<string, string | Chunks> {
  const internal = (href: string): Chunks =>
    function InternalLink(chunks) {
      return (
        <Link href={href} className={TEXT_LINK}>
          {chunks}
        </Link>
      )
    }
  return {
    email: LEGAL_CONTACT_EMAIL,
    site: siteHost(),
    b: (chunks) => <strong className="font-semibold text-text-primary">{chunks}</strong>,
    mail: (chunks) => (
      <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className={TEXT_LINK}>
        {chunks}
      </a>
    ),
    aepd: (chunks) => (
      <a href={AEPD_URL} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
        {chunks}
      </a>
    ),
    privacy: internal('/privacy'),
    terms: internal('/terms'),
    legal: internal('/legal'),
    accessibility: internal('/accessibility'),
    report: internal('/report'),
    settings: internal('/settings'),
  }
}

type Section = Record<string, string | Record<string, string>>

/**
 * Metadatos traducidos de un documento (TXT-5/SEO-6): título, descripción,
 * canonical y alternativas de idioma absolutos (`siteUrl()`) y un `openGraph`
 * completo, porque el de la página sustituye al del layout.
 */
export async function legalMetadata(doc: LegalDoc, locale: string): Promise<Metadata> {
  const l = locale === 'en' ? 'en' : 'es'
  const t = await getTranslations({ locale: l, namespace: DOCS[doc].namespace })
  const title = t('title')
  const description = t('metaDescription')
  const base = siteUrl()
  const path = DOCS[doc].path
  const url = `${base}/${l}${path}`
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { es: `${base}/es${path}`, en: `${base}/en${path}`, 'x-default': `${base}/es${path}` },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'KULTURA',
      type: 'website',
      locale: l === 'en' ? 'en_US' : 'es_ES',
      alternateLocale: l === 'en' ? ['es_ES'] : ['en_US'],
    },
  }
}

export async function LegalDocument({ doc }: { doc: LegalDoc }) {
  const { namespace } = DOCS[doc]
  const t = await getTranslations(namespace)
  const tl = await getTranslations('legal')
  const tags = richTags()
  const rich = (key: string) => t.rich(key, tags)

  const summary = Object.keys(t.raw('summary') as Record<string, string>)
  const sections = Object.entries(t.raw('sections') as Record<string, Section>)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16">
        <div className="max-w-[68ch]">
          <nav aria-label={tl('nav.label')}>
            <ul className="flex flex-wrap gap-2">
              {LEGAL_DOCS.map((d) => {
                const current = d === doc
                return (
                  <li key={d}>
                    <Link
                      href={DOCS[d].path}
                      aria-current={current ? 'page' : undefined}
                      className={`${CHIP} ${
                        current
                          ? 'bg-accent-positive text-on-accent-positive'
                          : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {tl(`nav.${d}`)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight text-text-primary mt-10 mb-3">
            {t('title')}
          </h1>
          <p className="text-sm text-text-tertiary mb-8">
            {t('version')} · {t('updated')}
          </p>

          <section
            aria-labelledby="legal-summary"
            className="rounded-20 border border-surface-border bg-surface-elevated p-5 md:p-6 mb-10"
          >
            <h2 id="legal-summary" className="font-display font-extrabold text-xl tracking-tight text-text-primary mb-3">
              {tl('doc.summaryTitle')}
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-text-secondary leading-relaxed marker:text-accent-pink">
              {summary.map((k) => (
                <li key={k}>{rich(`summary.${k}`)}</li>
              ))}
            </ul>
          </section>

          <p className="text-text-secondary leading-relaxed mb-8">{rich('intro')}</p>

          <nav aria-label={tl('doc.tocLabel')} className="mb-12">
            <ol className="list-decimal pl-5 space-y-1 text-sm text-text-secondary marker:text-text-tertiary">
              {sections.map(([id]) => (
                <li key={id}>
                  <a href={`#${id}`} className={TEXT_LINK}>
                    {t(`sections.${id}.title`)}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="flex flex-col gap-10">
            {sections.map(([id, section], index) => (
              <section key={id} aria-labelledby={id}>
                <h2
                  id={id}
                  className="font-display font-extrabold text-2xl tracking-tight text-text-primary mb-3 scroll-mt-24"
                >
                  {index + 1}. {t(`sections.${id}.title`)}
                </h2>
                <div className="flex flex-col gap-3 text-text-secondary leading-relaxed">
                  {Object.entries(section).map(([block, value]) => {
                    if (block === 'title') return null
                    if (typeof value === 'object') {
                      return (
                        <ul key={block} className="list-disc pl-5 space-y-2 marker:text-text-tertiary">
                          {Object.keys(value).map((item) => (
                            <li key={item}>{rich(`sections.${id}.${block}.${item}`)}</li>
                          ))}
                        </ul>
                      )
                    }
                    return <p key={block}>{rich(`sections.${id}.${block}`)}</p>
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
