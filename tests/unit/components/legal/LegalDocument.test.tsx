import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => {
    const map: Record<string, string> = {
      title: 'Política de privacidad',
      updated: 'Última actualización: septiembre de 2026',
      intro: 'Intro de prueba.',
      s1Title: 'Sección 1',
      s1Body: 'Cuerpo 1',
      s2Title: 'Sección 2',
      s2Body: 'Cuerpo 2',
      s3Title: 'Sección 3',
      s3Body: 'Cuerpo 3',
    }
    return map[key] ?? key
  }),
}))

vi.mock('@/components/layout/Header', () => ({ Header: () => <header>Header</header> }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => <footer>Footer</footer> }))

import { LegalDocument } from '@/components/legal/LegalDocument'

describe('LegalDocument (D1)', () => {
  it('renderiza título, fecha e introducción', async () => {
    render(await LegalDocument({ namespace: 'privacy', sectionCount: 3 }))
    expect(screen.getByText('Política de privacidad')).toBeInTheDocument()
    expect(screen.getByText('Última actualización: septiembre de 2026')).toBeInTheDocument()
    expect(screen.getByText('Intro de prueba.')).toBeInTheDocument()
  })

  it('renderiza exactamente `sectionCount` secciones, ni más ni menos', async () => {
    render(await LegalDocument({ namespace: 'privacy', sectionCount: 3 }))
    expect(screen.getByText('Sección 1')).toBeInTheDocument()
    expect(screen.getByText('Sección 2')).toBeInTheDocument()
    expect(screen.getByText('Sección 3')).toBeInTheDocument()
    // sectionCount=2 no debería intentar pintar la sección 3
  })

  it('con sectionCount=2 no renderiza la sección 3', async () => {
    render(await LegalDocument({ namespace: 'privacy', sectionCount: 2 }))
    expect(screen.getByText('Sección 1')).toBeInTheDocument()
    expect(screen.getByText('Sección 2')).toBeInTheDocument()
    expect(screen.queryByText('Sección 3')).not.toBeInTheDocument()
  })

  it('incluye Header y Footer', async () => {
    render(await LegalDocument({ namespace: 'privacy', sectionCount: 1 }))
    expect(screen.getByText('Header')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })
})
