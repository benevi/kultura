// ============================================================
// KULTURA — Inicio prepara "Para ti" sin llamar a la IA (D-06)
//
// La página lee en el servidor lo que no cuesta nada: las recomendaciones de
// hoy (si ya se generaron) y cuántos títulos con señal tiene la biblioteca.
// Con eso decide qué recibe el componente: las de hoy, lo popular (cuenta sin
// señal) o nada (→ botón "Recomiéndame"). Nunca genera.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Suspense, type ReactElement, type ReactNode } from 'react'

const { readTodayMock, starterMock, getDailyMock, signal } = vi.hoisted(() => ({
  readTodayMock: vi.fn(),
  starterMock: vi.fn(),
  getDailyMock: vi.fn(),
  signal: { count: 5 as number | null, error: null as unknown },
}))

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('es'),
  getTranslations: vi.fn().mockResolvedValue((k: string) => k),
}))
vi.mock('@/lib/claude/recommendations', () => ({
  MIN_LIBRARY_ITEMS: 3,
  readTodayAiRecommendations: readTodayMock,
  getDailyAiRecommendations: getDailyMock,
}))
vi.mock('@/lib/recommendations/starter', () => ({ getStarterItems: starterMock }))

function AiRecommendationsStub() {
  return null
}
vi.mock('@/components/home/AiRecommendations', () => ({ AiRecommendations: AiRecommendationsStub }))
vi.mock('@/components/home/HeroSection', () => ({ HeroSection: () => null }))
vi.mock('@/components/home/MediaRow', () => ({ MediaRow: () => null }))
vi.mock('@/components/home/PopularInCircle', () => ({ PopularInCircle: () => null }))
vi.mock('@/components/home/GenreNews', () => ({ GenreNews: () => null }))

/** Cliente con sesión: perfil existente y consultas de user_media. */
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', email: 'a@b.c' } } }) },
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'user-1' } }) }) }) }
      }
      return {
        select: (_cols: string, opts?: { head?: boolean }) => {
          const chain: Record<string, unknown> = {}
          chain.eq = () => chain
          chain.in = () => chain
          chain.order = () => chain
          chain.limit = () => (opts?.head ? chain : Object.assign(Promise.resolve({ data: [] }), { maybeSingle: async () => ({ data: null }) }))
          chain.maybeSingle = async () => ({ data: null })
          // Recuento de señal (`head: true`): termina en `.or(...)`.
          chain.or = async () => ({ count: signal.count, error: signal.error })
          return chain
        },
      }
    },
  }),
}))

function findProps(node: ReactNode): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProps(child)
      if (found) return found
    }
    return null
  }
  const el = node as ReactElement<{ children?: ReactNode }>
  if (el.type === AiRecommendationsStub) return el.props as Record<string, unknown>
  return findProps(el.props?.children)
}

/** Primer <Suspense> del árbol (o null). */
function findSuspense(node: ReactNode): ReactElement<{ fallback: ReactNode; children: ReactNode }> | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findSuspense(child)
      if (found) return found
    }
    return null
  }
  const el = node as ReactElement<{ children?: ReactNode }>
  if (el.type === Suspense) return el as ReactElement<{ fallback: ReactNode; children: ReactNode }>
  return findSuspense(el.props?.children)
}

async function loadPage() {
  const { default: HomePage } = await import('@/app/[locale]/(app)/home/page')
  return HomePage
}

async function renderPage() {
  return findProps(await (await loadPage())())
}

beforeEach(() => {
  readTodayMock.mockReset()
  starterMock.mockReset()
  getDailyMock.mockReset()
  signal.count = 5
  signal.error = null
})

describe('Inicio — "Para ti" sin coste', () => {
  it('con las de hoy guardadas se las pasa al componente', async () => {
    const today = { recommendations: [{ item: { id: 'movie_1' }, matchScore: 70 }], source: 'ai' }
    readTodayMock.mockResolvedValue(today)

    const props = await renderPage()

    expect(props?.initial).toEqual(today)
    expect(props?.starter).toBeUndefined()
    expect(readTodayMock).toHaveBeenCalledWith('user-1', 'es')
    expect(getDailyMock).not.toHaveBeenCalled()
  })

  it('cuenta sin señal: la página NO espera a lo popular (Suspense con esqueleto)', async () => {
    readTodayMock.mockResolvedValue(null)
    signal.count = 2
    // Una muestra fría que no llega nunca: si la página la esperase, colgaría.
    starterMock.mockReturnValue(new Promise(() => {}))

    const HomePage = await loadPage()
    const tree = await Promise.race([
      HomePage(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('la página esperó a getStarterItems')), 500)),
    ])

    const suspense = findSuspense(tree as ReactNode)
    expect(suspense).not.toBeNull()
    // El fallback es el esqueleto del propio componente, sin pedir nada.
    expect(findProps(suspense!.props.fallback)).toEqual({ pending: true })
    expect(getDailyMock).not.toHaveBeenCalled()
  })

  it('cuenta sin señal: dentro del Suspense, lo popular llega al componente', async () => {
    readTodayMock.mockResolvedValue(null)
    signal.count = 2
    starterMock.mockResolvedValue([{ id: 'movie_9' }])

    const suspense = findSuspense((await (await loadPage())()) as ReactNode)
    const child = suspense!.props.children as ReactElement<Record<string, unknown>>
    const render = child.type as (props: Record<string, unknown>) => Promise<ReactNode>
    const props = findProps(await render(child.props))

    expect(starterMock).toHaveBeenCalledWith('es')
    expect(props?.starter).toEqual([{ id: 'movie_9' }])
  })

  it('cuenta sin señal y muestra vacía o caída → el botón de siempre', async () => {
    readTodayMock.mockResolvedValue(null)
    signal.count = 0
    starterMock.mockRejectedValue(new Error('showcase incompleta'))

    const suspense = findSuspense((await (await loadPage())()) as ReactNode)
    const child = suspense!.props.children as ReactElement<Record<string, unknown>>
    const render = child.type as (props: Record<string, unknown>) => Promise<ReactNode>
    const props = findProps(await render(child.props))

    expect(props?.starter).toBeUndefined()
    expect(props?.pending).toBeUndefined()
  })

  it('con señal y sin nada hoy → ni initial ni starter (el componente enseña el botón)', async () => {
    readTodayMock.mockResolvedValue(null)

    const props = await renderPage()

    expect(props?.initial).toBeNull()
    expect(props?.starter).toBeUndefined()
    expect(starterMock).not.toHaveBeenCalled()
    expect(getDailyMock).not.toHaveBeenCalled()
  })

  it('si el recuento falla se deja el botón en vez de adivinar', async () => {
    readTodayMock.mockResolvedValue(null)
    signal.count = null
    signal.error = { code: '500' }

    const props = await renderPage()

    expect(props?.starter).toBeUndefined()
    expect(starterMock).not.toHaveBeenCalled()
  })
})
