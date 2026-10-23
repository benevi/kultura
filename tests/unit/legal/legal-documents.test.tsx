/**
 * F-19 · Legal y transparencia (SEG-6, TXT-10, TXT-5/SEO-6, DIS-11).
 * Se pintan los cuatro documentos con los mensajes REALES de es y en: un
 * texto que falte, una etiqueta sin manejar o un ICU roto hacen fallar el test
 * (onError lanza), y se comprueba el contenido que exige la aceptación.
 */
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'

const all = { es, en } as const
const state = { locale: 'es' as 'es' | 'en' }

vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl')
  return {
    getTranslations: vi.fn(async (arg: string | { locale: string; namespace: string }) => {
      const locale = (typeof arg === 'string' ? state.locale : arg.locale) as 'es' | 'en'
      const namespace = typeof arg === 'string' ? arg : arg.namespace
      return createTranslator({
        locale,
        messages: all[locale] as never,
        namespace: namespace as never,
        onError: (e) => {
          throw e
        },
      })
    }),
  }
})

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('@/components/layout/Header', () => ({ Header: () => <header>Header</header> }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => <footer>Footer</footer> }))

import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCS,
  LegalDocument,
  legalMetadata,
  type LegalDoc,
} from '@/components/legal/LegalDocument'

async function renderDoc(doc: LegalDoc, locale: 'es' | 'en' = 'es') {
  state.locale = locale
  return render(await LegalDocument({ doc }))
}

const ORIGINAL_SITE = process.env.NEXT_PUBLIC_SITE_URL

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://kultura.example'
})
afterEach(() => {
  if (ORIGINAL_SITE === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE
})

describe.each(['es', 'en'] as const)('documentos legales (%s)', (locale) => {
  it.each(LEGAL_DOCS)('%s: se pinta entero, con resumen, índice, versión y fecha', async (doc) => {
    const { container } = await renderDoc(doc, locale)
    const h1 = screen.getByRole('heading', { level: 1 })
    // DIS-11: Bricolage 800 en h1 y h2.
    expect(h1.className).toContain('font-display')
    expect(h1.className).toContain('font-extrabold')
    for (const h2 of screen.getAllByRole('heading', { level: 2 })) {
      expect(h2.className).toContain('font-extrabold')
    }
    // Resumen arriba (3-5 líneas), antes de la primera sección.
    const summary = screen.getByRole('region', { name: all[locale].legal.doc.summaryTitle })
    const items = within(summary).getAllByRole('listitem')
    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items.length).toBeLessThanOrEqual(5)
    // Fecha y versión visibles.
    expect(container.textContent).toMatch(/2026-10/)
    expect(container.textContent).toMatch(/2026/)
    // Cada entrada del índice apunta a una sección que existe.
    const toc = screen.getByRole('navigation', { name: all[locale].legal.doc.tocLabel })
    for (const link of within(toc).getAllByRole('link')) {
      const id = link.getAttribute('href')!.slice(1)
      expect(container.querySelector(`[id="${id}"]`)?.tagName).toBe('H2')
    }
    // Nada de etiquetas sin procesar ni marcadores ICU.
    expect(container.textContent).not.toMatch(/<\/?[a-z]+>|\{(email|site)\}/)
    // Dominio desde siteUrl(), nunca fijo.
    expect(container.innerHTML).not.toContain('kulturaapp.vercel.app')
  })

  it.each(LEGAL_DOCS)('%s: la navegación marca el documento actual', async (doc) => {
    await renderDoc(doc, locale)
    const nav = screen.getByRole('navigation', { name: all[locale].legal.nav.label })
    const current = within(nav).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toBe(all[locale].legal.nav[doc])
  })

  it('privacidad: email, AEPD, transferencias y proveedores reales', async () => {
    const { container } = await renderDoc('privacy', locale)
    const text = container.textContent ?? ''
    expect(text).toContain(LEGAL_CONTACT_EMAIL)
    expect(container.querySelector(`a[href="mailto:${LEGAL_CONTACT_EMAIL}"]`)).not.toBeNull()
    expect(text).toContain('AEPD')
    expect(container.querySelector('a[href="https://www.aepd.es"]')).not.toBeNull()
    expect(text).toMatch(locale === 'es' ? /transferencias internacionales/ : /international transfers/)
    expect(text).toContain('Víctor Franco')
    for (const provider of ['Vercel', 'Supabase', 'Anthropic', 'Sentry', 'Resend', 'Upstash', 'Google', 'GitHub']) {
      expect(text).toContain(provider)
    }
    for (const catalog of ['TMDB', 'RAWG', 'AniList', 'Comic Vine', 'MangaDex', 'Open Library', 'Google Books', 'Steam']) {
      expect(text).toContain(catalog)
    }
    expect(text).toContain('Vercel Web Analytics')
    expect(text).toMatch(/Fráncfort|Frankfurt/)
    expect(container.innerHTML).toContain('kultura.example/u/')
  })

  it('privacidad: edad mínima 14 (no 16), IA solo al pulsar y 7 días de gracia', async () => {
    const { container } = await renderDoc('privacy', locale)
    const text = container.textContent ?? ''
    expect(text).toMatch(/14/)
    expect(text).not.toMatch(/\b16\b/)
    expect(text).toMatch(locale === 'es' ? /solo cuando pulsas/ : /only when you press/)
    expect(text).toMatch(locale === 'es' ? /7 días/ : /7 days/)
    // La exportación dice qué NO incluye (mensajes recibidos) y cómo pedirlos.
    expect(text).toMatch(locale === 'es' ? /No incluye los mensajes que te han escrito/ : /doesn't include messages other people wrote/)
    // Biblioteca de amigos por defecto (D-04).
    expect(text).toMatch(locale === 'es' ? /por defecto, solo tus amigos/ : /by default, only your friends/)
    expect(container.querySelector('a[href="/settings"]')).not.toBeNull()
  })

  it('privacidad: datos obligatorios (art. 13.2.e), reintento de la IA y tráiler sin cookies', async () => {
    const { container } = await renderDoc('privacy', locale)
    const text = container.textContent ?? ''
    expect(text).toMatch(locale === 'es' ? /art\. 13\.2\.e RGPD/ : /Art\. 13\(2\)\(e\) GDPR/)
    expect(text).toMatch(locale === 'es' ? /no se puede crear la cuenta/ : /the account can't be created/)
    expect(text).toMatch(locale === 'es' ? /Todo lo demás es opcional/ : /Everything else is optional/)
    expect(text).toContain(
      locale === 'es'
        ? 'como mucho una petición al día, salvo un reintento si falla'
        : 'at most one request per person per day, except for one retry if it fails'
    )
    expect(text).toContain(
      locale === 'es'
        ? 'el tráiler se carga desde youtube-nocookie.com solo cuando pulsas reproducir; a partir de ese momento se aplica la política de Google'
        : "the trailer loads from youtube-nocookie.com only when you press play; from that moment, Google's policy applies"
    )
  })

  it('términos: moderación real, denuncia sin cuenta y edad 14', async () => {
    const { container } = await renderDoc('terms', locale)
    const text = container.textContent ?? ''
    expect(container.querySelector('a[href="/report"]')).not.toBeNull()
    expect(text).toMatch(locale === 'es' ? /suspender o eliminar la cuenta/ : /suspend or delete the account/)
    expect(text).toMatch(locale === 'es' ? /bloquear/ : /block/)
    expect(text).toMatch(/14/)
    expect(text).not.toMatch(/\b16\b/)
  })

  it('aviso legal: responsable, email, nota de NIF y punto de contacto DSA con /report', async () => {
    const { container } = await renderDoc('notice', locale)
    const text = container.textContent ?? ''
    expect(text).toContain('Víctor Franco')
    expect(text).toContain(LEGAL_CONTACT_EMAIL)
    expect(text).toMatch(/NIF/)
    // Identificación voluntaria (sin actividad económica) y NIF/domicilio solo
    // a autoridades competentes o a quien acredite interés legítimo.
    if (locale === 'es') {
      expect(text).toMatch(/se dan de forma voluntaria: KULTURA no tiene actividad económica/)
      expect(text).toMatch(/autoridades competentes o a quien acredite un interés legítimo y los pida por email/)
      expect(text).not.toMatch(/cualquier persona con (un )?interés legítimo/)
    } else {
      expect(text).toMatch(/given voluntarily: KULTURA has no economic activity/)
      expect(text).toMatch(/competent authorities or to whoever proves a legitimate interest and requests them by email/)
      expect(text).not.toMatch(/anyone with a legitimate interest/)
    }
    expect(text).toMatch(/2022\/2065/)
    expect(text).toMatch(/art\. 11|Art\. 11/)
    expect(text).toMatch(/art\. 12|Art\. 12/)
    expect(container.querySelector('a[href="/report"]')).not.toBeNull()
    // security.txt enlaza a esta sección.
    expect(container.querySelector('h2#security')).not.toBeNull()
    expect(text).toContain('kultura.example/.well-known/security.txt')
  })

  it('accesibilidad: nivel de conformidad, contacto y cauce de reclamación', async () => {
    const { container } = await renderDoc('accessibility', locale)
    const text = container.textContent ?? ''
    expect(text).toContain('WCAG 2.2')
    expect(text).toContain('EN 301 549')
    expect(text).toContain(LEGAL_CONTACT_EMAIL)
    expect(text).toContain('OADIS')
  })
})

describe('metadatos traducidos (TXT-5/SEO-6)', () => {
  it.each(
    LEGAL_DOCS.flatMap((doc) => (['es', 'en'] as const).map((locale) => [doc, locale] as const))
  )('%s en %s: título, descripción, canonical, hreflang y OG en su idioma', async (doc, locale) => {
    const paths: Record<LegalDoc, string> = {
      privacy: '/privacy',
      terms: '/terms',
      notice: '/legal',
      accessibility: '/accessibility',
    }
    const ns = doc === 'accessibility' ? all[locale].accessibility : all[locale].legal[doc]
    const meta = await legalMetadata(doc, locale)
    const url = `https://kultura.example/${locale}${paths[doc]}`
    expect(meta.title).toBe(ns.title)
    expect(meta.description).toBe(ns.metaDescription)
    expect(meta.alternates).toEqual({
      canonical: url,
      languages: {
        es: `https://kultura.example/es${paths[doc]}`,
        en: `https://kultura.example/en${paths[doc]}`,
        'x-default': `https://kultura.example/es${paths[doc]}`,
      },
    })
    expect(meta.openGraph).toMatchObject({
      title: ns.title,
      description: ns.metaDescription,
      url,
      siteName: 'KULTURA',
      type: 'website',
      locale: locale === 'en' ? 'en_US' : 'es_ES',
    })
  })

  it('la descripción en inglés no es la española', async () => {
    const [esMeta, enMeta] = await Promise.all([legalMetadata('privacy', 'es'), legalMetadata('privacy', 'en')])
    expect(enMeta.description).not.toBe(esMeta.description)
    expect(enMeta.description).toMatch(/data/)
  })
})

describe('textos', () => {
  it('la atribución del pie cita todos los catálogos', () => {
    for (const messages of [es, en]) {
      for (const name of ['TMDB', 'RAWG', 'Steam', 'AniList', 'MyAnimeList', 'MangaDex', 'Open Library', 'Google Books', 'Comic Vine']) {
        expect(messages.legal.dataSources).toContain(name)
      }
    }
  })

  it('el namespace accessibility va justo después de legal en los dos idiomas', () => {
    for (const messages of [es, en]) {
      const keys = Object.keys(messages)
      expect(keys[keys.indexOf('legal') + 1]).toBe('accessibility')
    }
  })

  it('ningún texto legal deja datos por rellenar', () => {
    const blob = JSON.stringify([es.legal, en.legal, es.accessibility, en.accessibility])
    expect(blob).not.toMatch(/\[(nombre|nif|dirección|email|name|address)[^\]]*\]/i)
    expect(blob).not.toMatch(/TODO|XXX|FIXME/)
    // El responsable es una persona física: sin segundo apellido ni datos de más.
    expect(blob).not.toMatch(/Beneitez|victor_franco@|vfbeneitez@/)
  })
})
