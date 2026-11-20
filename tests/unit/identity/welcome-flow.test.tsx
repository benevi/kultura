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
import { STARTER_MIN_RATINGS, STARTER_RATE_COUNT, STARTER_TITLES, pickStarterTitles } from '@/lib/recommendations/starter-titles'
import { MIN_LIBRARY_ITEMS } from '@/lib/claude/recommendations'

const ok = () => new Response(JSON.stringify({ data: null, success: true }), { status: 200 })

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
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'conflict', message: 'username_taken' } }), { status: 409 }))
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

  // SEG-7: todo se puede saltar menos la casilla de edad y términos.
  it('saltar todo SIN marcar la casilla (alta con Google) no salta: pide la casilla', async () => {
    renderFlow({ next: '/es/u/benevi' })
    fireEvent.click(screen.getByRole('button', { name: 'skipAll' }))
    expect(await screen.findByText('termsRequired')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(h.replace).not.toHaveBeenCalled()
  })

  it('al intentar saltar, la casilla queda marcada como inválida en el paso 1', async () => {
    renderFlow({ needsTerms: true })
    fireEvent.click(screen.getByRole('button', { name: 'skipAll' }))
    expect(await screen.findByRole('heading', { name: 'nameTitle' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('con la casilla marcada, saltar todo acepta y termina en la misma petición', async () => {
    renderFlow({ next: '/es/u/benevi' })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'skipAll' }))
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/es/u/benevi'))
    expect(calls('/api/settings')).toEqual([{ accept_terms: true, onboarding_done: true }])
  })

  it('con los términos ya aceptados, saltar todo solo termina', async () => {
    renderFlow({ next: '/es/u/benevi', needsTerms: false })
    fireEvent.click(screen.getByRole('button', { name: 'skipAll' }))
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/es/u/benevi'))
    expect(calls('/api/settings')).toEqual([{ onboarding_done: true }])
  })

  it('si el servidor responde terms_required (409), no entra y pide la casilla', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'conflict', message: 'terms_required' } }), { status: 409 }))
    renderFlow({ needsTerms: false })
    fireEvent.click(screen.getByRole('button', { name: 'skipAll' }))
    expect(await screen.findByText('termsRequired')).toBeInTheDocument()
    expect(h.replace).not.toHaveBeenCalled()
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

// Fase 8.2 («Llegar», bandera WELCOME_RATE_FIRST): puntuar es la primera pantalla.
describe('WelcomeFlow con rateFirst', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation(async () => ok())
  })

  it('empieza por puntuar: la primera obra se guarda sin pasar por nombre ni formatos', async () => {
    renderFlow({ needsTerms: false, rateFirst: true })

    // Primera pantalla: puntuar, sin «Atrás», en 3 pasos.
    expect(screen.getByRole('heading', { name: 'rateTitle' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'back' })).not.toBeInTheDocument()
    expect(screen.getByText('stepOf:{"current":1,"total":3}')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').filter((li) => li.hasAttribute('aria-current'))).toHaveLength(1)

    const groups = screen.getAllByRole('radiogroup')
    expect(groups).toHaveLength(STARTER_RATE_COUNT)
    for (const group of groups.slice(0, 3)) {
      fireEvent.click(within(group).getByRole('radio', { name: 'stars:{"count":5}' }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'toRecommendations' }))

    // Segunda: el nombre (ya sin el saludo), con las tres obras guardadas.
    await screen.findByRole('heading', { name: 'nameTitle' })
    expect(calls('/api/library')).toHaveLength(3)
    expect(calls('/api/library')[0]).toEqual({ mediaId: pickStarterTitles([])[0].id, status: 'completed', score: 5 })
    expect(screen.queryByText('welcomeBadge')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'back' })).toBeInTheDocument()

    // Tercera: recomendaciones, y a Inicio.
    fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: 'cinefila_92' } })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    await screen.findByRole('heading', { name: 'recsTitle' })
    expect(calls('/api/settings')[0]).toEqual({ username: 'cinefila_92' })
    fireEvent.click(screen.getByRole('button', { name: 'finish' }))
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/es/home'))
    expect(calls('/api/settings').pop()).toEqual({ onboarding_done: true })
  })

  it('los formatos son un filtro dentro de puntuar: elegir uno pone sus títulos primero', () => {
    renderFlow({ needsTerms: false, rateFirst: true })
    const games = screen.getByRole('button', { name: /formats\.game/ })
    fireEvent.click(games)
    expect(games).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('radiogroup')).toHaveLength(STARTER_RATE_COUNT)
    const first = pickStarterTitles(['game'])[0]
    expect(first.type).toBe('game')
    expect(screen.getAllByRole('radiogroup')[0]).toHaveAccessibleName(`rateLabel:{"title":"${first.title.es}"}`)
  })

  it('si falta la casilla de edad y términos (alta con Google), el orden es el de siempre', () => {
    renderFlow({ needsTerms: true, rateFirst: true })
    expect(screen.getByRole('heading', { name: 'nameTitle' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect(screen.getByText('stepOf:{"current":1,"total":4}')).toBeInTheDocument()
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

// Fase 8.4 (C12): caracterización antes de partir WelcomeFlow en piezas.
// Fija foco, anuncios, navegación y errores que los tests de arriba no tocan.
describe('WelcomeFlow: caracterización (C12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockImplementation(async () => ok())
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  })

  async function toRateStep() {
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    fireEvent.click(await screen.findByRole('button', { name: 'continueAll' }))
    await screen.findByRole('heading', { name: 'rateTitle' })
  }

  it('el foco va al título de cada paso nuevo, nunca al cargar', async () => {
    renderFlow({ needsTerms: false })
    expect(screen.getByRole('heading', { name: 'nameTitle' })).not.toHaveFocus()
    expect(window.scrollTo).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    const heading = await screen.findByRole('heading', { name: 'formatsTitle' })
    expect(heading).toHaveFocus()
    expect(heading).toHaveAttribute('id', 'welcome-heading')
    expect(heading).toHaveAttribute('tabindex', '-1')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('progreso: «paso X de N» y aria-current en el paso actual', async () => {
    renderFlow({ needsTerms: false })
    const nav = screen.getByRole('navigation', { name: 'progressLabel' })
    expect(within(nav).getByText('stepOf:{"current":1,"total":4}')).toBeInTheDocument()
    let items = within(nav).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[0]).toHaveAttribute('aria-current', 'step')
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    await screen.findByRole('heading', { name: 'formatsTitle' })
    expect(within(nav).getByText('stepOf:{"current":2,"total":4}')).toBeInTheDocument()
    items = within(nav).getAllByRole('listitem')
    expect(items[0]).not.toHaveAttribute('aria-current')
    expect(items[1]).toHaveAttribute('aria-current', 'step')
  })

  it('el saludo y la falta de «Atrás» solo en el primer paso; «Atrás» conserva lo escrito', async () => {
    renderFlow({ needsTerms: false, suggestChange: false, currentUsername: 'pepa' })
    expect(screen.getByText('welcomeBadge')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'back' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('nameLabel')).toHaveValue('pepa')
    expect(screen.getByText('nameHint')).toBeInTheDocument()
    // Sin cambios en el nombre: avanza sin llamar a la API.
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    await screen.findByRole('heading', { name: 'formatsTitle' })
    expect(global.fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /formats\.anime/ }))
    expect(screen.getByRole('button', { name: 'continue' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    expect(await screen.findByRole('heading', { name: 'nameTitle' })).toHaveFocus()
    expect(screen.getByLabelText('nameLabel')).toHaveValue('pepa')
    // Y al volver a formatos sigue elegido lo de antes.
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(await screen.findByRole('button', { name: /formats\.anime/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('con nombre generado, el campo empieza vacío y la pista enseña el actual', () => {
    renderFlow({ needsTerms: false })
    expect(screen.getByLabelText('nameLabel')).toHaveValue('')
    expect(screen.getByText('nameHintGenerated:{"current":"u_3f9a1c"}')).toBeInTheDocument()
  })

  it('nombre con formato inválido → error, foco en el campo y sin API; escribir lo borra', () => {
    renderFlow({ needsTerms: false })
    const input = screen.getByLabelText('nameLabel')
    fireEvent.change(input, { target: { value: 'a b' } })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(screen.getByText('nameInvalid')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveFocus()
    expect(global.fetch).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'ab_c' } })
    expect(screen.queryByText('nameInvalid')).not.toBeInTheDocument()
  })

  it('invalid_input del servidor → nameInvalid en el campo', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'invalid_input', message: 'x' } }), { status: 400 }))
    renderFlow({ needsTerms: false })
    fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: 'pepe_01' } })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(await screen.findByText('nameInvalid')).toBeInTheDocument()
    expect(screen.getByLabelText('nameLabel')).toHaveFocus()
  })

  it('conflict con username_reserved del servidor → nameReserved', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'conflict', message: 'username_reserved' } }), { status: 409 }))
    renderFlow({ needsTerms: false })
    fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: 'pepe_02' } })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(await screen.findByText('nameReserved')).toBeInTheDocument()
  })

  it('otro fallo al guardar el nombre → aviso (role=alert) y se queda en el paso', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    renderFlow({ needsTerms: false })
    fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: 'pepe_03' } })
    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('saveError')
    expect(screen.getByRole('heading', { name: 'nameTitle' })).toBeInTheDocument()
  })

  it('al intentar saltar sin la casilla, el foco va a la casilla', async () => {
    renderFlow({ needsTerms: true })
    fireEvent.click(screen.getByRole('button', { name: 'skipAll' }))
    await waitFor(() => expect(screen.getByRole('checkbox')).toHaveFocus())
  })

  it('puntuar: contador accesible, pista del mínimo y «Saltar paso» que guarda lo pendiente', async () => {
    renderFlow({ needsTerms: false })
    await toRateStep()
    expect(screen.getByRole('status')).toHaveTextContent(`rateProgress:{"count":0,"min":${STARTER_MIN_RATINGS}}`)
    const next = screen.getByRole('button', { name: 'toRecommendations' })
    expect(next).toHaveAttribute('aria-describedby', 'rate-min-hint')
    expect(document.getElementById('rate-min-hint')).toHaveTextContent(`rateMinHint:{"min":${STARTER_MIN_RATINGS}}`)

    // Dos notas seguidas al mismo título: una sola petición, con la última.
    const [group] = screen.getAllByRole('radiogroup')
    fireEvent.click(within(group).getByRole('radio', { name: 'stars:{"count":3}' }))
    fireEvent.click(within(group).getByRole('radio', { name: 'stars:{"count":5}' }))
    expect(screen.getByRole('status')).toHaveTextContent(`rateProgress:{"count":1,"min":${STARTER_MIN_RATINGS}}`)
    expect(calls('/api/library')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'skipStep' }))
    await screen.findByRole('heading', { name: 'recsTitle' })
    expect(calls('/api/library')).toEqual([{ mediaId: pickStarterTitles([])[0].id, status: 'completed', score: 5 }])
    expect(screen.getByText('recsBodyNoRatings')).toBeInTheDocument()
  })

  it('con el mínimo de notas: estado «listo», sin «Saltar paso» y el cuerpo de recomendaciones con notas', async () => {
    renderFlow({ needsTerms: false })
    await toRateStep()
    for (const group of screen.getAllByRole('radiogroup').slice(0, STARTER_MIN_RATINGS)) {
      fireEvent.click(within(group).getByRole('radio', { name: 'stars:{"count":4}' }))
    }
    expect(screen.getByRole('status')).toHaveTextContent(`rateReady:{"count":${STARTER_MIN_RATINGS}}`)
    expect(screen.queryByRole('button', { name: 'skipStep' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'toRecommendations' })).not.toHaveAttribute('aria-describedby')
    expect(document.getElementById('rate-min-hint')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'toRecommendations' }))
    await screen.findByRole('heading', { name: 'recsTitle' })
    expect(screen.getByText('recsBody')).toBeInTheDocument()
    // «Atrás» desde recomendaciones vuelve a puntuar con las notas puestas.
    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    await screen.findByRole('heading', { name: 'rateTitle' })
    expect(screen.getByRole('status')).toHaveTextContent(`rateReady:{"count":${STARTER_MIN_RATINGS}}`)
  })

  it('en el orden de siempre, puntuar no repite el filtro de formatos', async () => {
    renderFlow({ needsTerms: false })
    await toRateStep()
    expect(screen.queryByRole('group', { name: 'formatsTitle' })).not.toBeInTheDocument()
  })
})
