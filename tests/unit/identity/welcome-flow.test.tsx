// ============================================================
// KULTURA — Onboarding /welcome de punta a punta, simulado (CRE-6)
// nombre + términos → formatos → 3 notas → recomendaciones → Inicio.
// ============================================================

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'

const h = vi.hoisted(() => ({ replace: vi.fn() }))

vi.mock('next-intl', () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key
  t.rich = (key: string, values: Record<string, (c: ReactNode) => ReactNode>) => (
    <>
      {key}
      {Object.entries(values).map(([name, fn]) => (
        <span key={name}>{fn(name)}</span>
      ))}
    </>
  )
  return { useTranslations: () => t }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: h.replace, push: vi.fn() }) }))
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('@/components/media/PosterImage', () => ({ PosterImage: () => null }))
vi.mock('@/components/home/AiRecommendations', () => ({
  AiRecommendations: () => <section aria-label="ai-recs-stub" />,
}))

import { WelcomeFlow } from '@/app/[locale]/welcome/WelcomeFlow'
import { STARTER_MIN_RATINGS, STARTER_RATE_COUNT, STARTER_TITLES, pickStarterTitles } from '@/app/[locale]/welcome/starter-titles'
import { MIN_LIBRARY_ITEMS } from '@/lib/claude/recommendations'

const ok = () => new Response(JSON.stringify({ success: true }), { status: 200 })

function calls(url: string) {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls
    .filter(([u]) => u === url)
    .map(([, init]) => JSON.parse((init as RequestInit).body as string))
}

function renderFlow(props: Partial<Parameters<typeof WelcomeFlow>[0]> = {}) {
  return render(
    <WelcomeFlow
      locale="es"
      next="/es/home"
      currentUsername="u_3f9a1c"
      suggestChange
      needsTerms
      {...props}
    />
  )
}

describe('WelcomeFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation(async () => ok())
  })

  it('recorrido completo: tras 3 notas llega a Inicio', async () => {
    renderFlow()

    // 1. Nombre: sin la casilla (alta con Google) no avanza.
    fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: 'cinefila_92' } })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(await screen.findByText('termsRequired')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    await screen.findByRole('heading', { name: 'formatsTitle' })
    expect(calls('/api/settings')[0]).toEqual({ username: 'cinefila_92', accept_terms: true })

    // 2. Formatos.
    const movies = screen.getByRole('button', { name: /formats\.movie/ })
    fireEvent.click(movies)
    expect(movies).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    await screen.findByRole('heading', { name: 'rateTitle' })

    // 3. Notas: diez títulos, los del formato elegido primero.
    const groups = screen.getAllByRole('radiogroup')
    expect(groups).toHaveLength(STARTER_RATE_COUNT)
    const next = screen.getByRole('button', { name: 'toRecommendations' })
    expect(next).toBeDisabled()
    for (const group of groups.slice(0, 3)) {
      fireEvent.click(within(group).getByRole('radio', { name: 'stars:{"count":4}' }))
    }
    expect(next).toBeEnabled()
    fireEvent.click(next)
    await screen.findByRole('heading', { name: 'recsTitle' })
    const rated = calls('/api/library')
    expect(rated).toHaveLength(3)
    expect(rated[0]).toEqual({ mediaId: pickStarterTitles(['movie'])[0].id, status: 'completed', score: 4 })
    expect(rated.every((r) => r.mediaId.startsWith('movie_'))).toBe(true)

    // 4. Recomendaciones (el botón de "Para ti") y a Inicio.
    expect(screen.getByLabelText('ai-recs-stub')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'finish' }))
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/es/home'))
    expect(calls('/api/settings').pop()).toEqual({ onboarding_done: true })
  })

  it('con el nombre vacío y los términos ya aceptados no llama a la API', async () => {
    renderFlow({ needsTerms: false })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    await screen.findByRole('heading', { name: 'formatsTitle' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('nombre cogido → error en el campo y se queda en el paso', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'username_taken' }), { status: 409 }))
    renderFlow({ needsTerms: false })
    fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: 'pepe_00' } })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(await screen.findByText('nameTaken')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'nameTitle' })).toBeInTheDocument()
  })

  it('nombre reservado → error sin llamar a la API', () => {
    renderFlow({ needsTerms: false })
    fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: 'admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(screen.getByText('nameReserved')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('saltar todo desde el primer paso marca el onboarding y va al destino', async () => {
    renderFlow({ next: '/es/u/benevi' })
    fireEvent.click(screen.getByRole('button', { name: 'skipAll' }))
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/es/u/benevi'))
    expect(calls('/api/settings')).toEqual([{ onboarding_done: true }])
  })

  it('una nota que no se guarda se descuenta y se avisa', async () => {
    renderFlow({ needsTerms: false })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'continueAll' }))
    await screen.findByRole('heading', { name: 'rateTitle' })
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 502 }))
    const [group] = screen.getAllByRole('radiogroup')
    fireEvent.click(within(group).getByRole('radio', { name: 'stars:{"count":5}' }))
    expect(await screen.findByRole('alert', {}, { timeout: 2000 })).toHaveTextContent('rateError')
    expect(within(group).getByRole('radio', { name: 'stars:{"count":5}' })).toHaveAttribute('aria-checked', 'false')
  })

  it('las estrellas se manejan con flechas (un tope de Tab por título)', async () => {
    renderFlow({ needsTerms: false })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'continueAll' }))
    const [group] = await screen.findAllByRole('radiogroup')
    const stars = within(group).getAllByRole('radio')
    expect(stars.filter((s) => s.tabIndex === 0)).toHaveLength(1)
    fireEvent.keyDown(stars[0], { key: 'ArrowRight' })
    expect(stars[1]).toHaveAttribute('aria-checked', 'true')
    expect(stars[1]).toHaveFocus()
  })
})

describe('títulos para puntuar', () => {
  it('3 notas = el mínimo con el que Inicio deja de enseñar solo lo popular', () => {
    expect(STARTER_MIN_RATINGS).toBe(MIN_LIBRARY_ITEMS)
  })

  it('todos con portada e id del formato "{tipo}_{id}" que acepta /api/library', () => {
    for (const title of STARTER_TITLES) {
      expect(title.poster).toMatch(/^https:\/\//)
      expect(title.id.startsWith(`${title.type}_`)).toBe(true)
      expect(title.title.es && title.title.en).toBeTruthy()
    }
    expect(new Set(STARTER_TITLES.map((t) => t.id)).size).toBe(STARTER_TITLES.length)
  })

  it('primero los formatos elegidos, alternando; si faltan, el resto', () => {
    const picked = pickStarterTitles(['game', 'book'])
    expect(picked).toHaveLength(STARTER_RATE_COUNT)
    expect(picked.slice(0, 4).map((t) => t.type)).toEqual(['book', 'game', 'book', 'game'])
    // Solo cómic (sin títulos fijos): se rellena con el resto, nunca vacío.
    expect(pickStarterTitles(['comic'])).toHaveLength(STARTER_RATE_COUNT)
  })
})
