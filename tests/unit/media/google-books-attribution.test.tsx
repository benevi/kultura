/**
 * Fase 8.1 — atribución de Google Books (developers.google.com/books/branding):
 * logo «Powered by Google» junto a los datos de su API y enlace a la página
 * del libro en Google Libros.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { GOOGLE_BOOKS_LOGO, googleBooksUrl, googleBooksVolumeId } from '@/lib/media/google-books'
import { GoogleBooksAttribution } from '@/components/media/GoogleBooksAttribution'
import es from '../../../messages/es.json'
import en from '../../../messages/en.json'

describe('googleBooksVolumeId', () => {
  it('libro cuyo id es un volumen de Google Books', () => {
    expect(googleBooksVolumeId({ type: 'book', externalId: 'zyTCAlFPjgYC' })).toBe('zyTCAlFPjgYC')
  })

  it('libro de Open Library completado con Google: el volumen que dejó el puente', () => {
    expect(
      googleBooksVolumeId({ type: 'book', externalId: 'OL7353617W', metadata: { googleBooksId: 'gbVolume1' } })
    ).toBe('gbVolume1')
  })

  it('libro de Open Library sin datos de Google, y lo que no es un libro: nada', () => {
    expect(googleBooksVolumeId({ type: 'book', externalId: 'OL7353617W' })).toBeNull()
    expect(googleBooksVolumeId({ type: 'book', externalId: 'OL7353617W', metadata: { googleBooksId: 42 } })).toBeNull()
    expect(googleBooksVolumeId({ type: 'book', externalId: 'OL123M', metadata: null })).toBeNull()
    expect(googleBooksVolumeId({ type: 'movie', externalId: '123456' })).toBeNull()
    expect(googleBooksVolumeId({ type: 'comic', externalId: '123456' })).toBeNull()
  })

  it('un id que no tiene forma de volumen no acaba en la URL', () => {
    expect(googleBooksVolumeId({ type: 'book', externalId: 'a b&c=1' })).toBeNull()
    expect(
      googleBooksVolumeId({ type: 'book', externalId: 'OL1W', metadata: { googleBooksId: 'x/../y?z=1' } })
    ).toBeNull()
  })

  it('googleBooksUrl: página del libro en Google Libros', () => {
    expect(googleBooksUrl('zyTCAlFPjgYC')).toBe('https://books.google.com/books?id=zyTCAlFPjgYC')
  })
})

describe('GoogleBooksAttribution', () => {
  it('el logo oficial existe en public/ con su tamaño', () => {
    expect(existsSync(join(process.cwd(), 'public', GOOGLE_BOOKS_LOGO.src))).toBe(true)
    expect(GOOGLE_BOOKS_LOGO).toMatchObject({ width: 62, height: 30 })
  })

  it('ficha: logo y enlace a la página del libro, en pestaña nueva', () => {
    render(
      <GoogleBooksAttribution
        href={googleBooksUrl('zyTCAlFPjgYC')}
        label={es.media_detail.googleBooksLink}
        linkLabel={es.media_detail.googleBooksLinkLabel}
      />
    )
    const logo = screen.getByAltText('Powered by Google')
    expect(logo.getAttribute('src')).toBe(GOOGLE_BOOKS_LOGO.src)
    const link = screen.getByRole('link', { name: es.media_detail.googleBooksLinkLabel })
    expect(link.getAttribute('href')).toBe('https://books.google.com/books?id=zyTCAlFPjgYC')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link.textContent).toBe(es.media_detail.googleBooksLink)
  })

  it('resultados: logo y texto, sin enlace', () => {
    render(<GoogleBooksAttribution label={es.search.googleBooksResults} />)
    expect(screen.getByAltText('Powered by Google')).toBeTruthy()
    expect(screen.getByText(es.search.googleBooksResults)).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('los textos usan el nombre aprobado del servicio en cada idioma', () => {
    expect(es.media_detail.googleBooksLink).toContain('Google Libros')
    expect(es.search.googleBooksResults).toContain('Google Libros')
    expect(en.media_detail.googleBooksLink).toContain('Google Books')
    expect(en.search.googleBooksResults).toContain('Google Books')
  })
})
