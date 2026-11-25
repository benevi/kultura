// ============================================================
// KULTURA — Esqueleto de Inicio (`loading.tsx`, fase 8.5 I2b).
// Con `SALA_INICIO` apagada, el de hoy, sin nada de «Sala». Encendida, el de
// «Sala» por `next/dynamic`. La bandera solo lee la cookie en `prueba`.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'

const { cookie } = vi.hoisted(() => ({ cookie: { value: undefined as string | undefined, reads: 0 } }))

vi.mock('next/headers', () => ({
  cookies: async () => {
    cookie.reads++
    return { get: () => (cookie.value ? { value: cookie.value } : undefined) }
  },
}))
vi.mock('@/components/home/sala/SalaHomeLazy', () => ({
  SalaHomeSkeletonLazy: () => <div data-sala-stub="skeleton" />,
}))

async function renderLoading(): Promise<string> {
  const { default: HomeLoading } = await import('@/app/[locale]/(app)/home/loading')
  return renderToStaticMarkup((await HomeLoading()) as ReactElement)
}

beforeEach(() => {
  cookie.value = undefined
  cookie.reads = 0
  delete process.env.SALA_INICIO
})
afterEach(() => {
  delete process.env.SALA_INICIO
})

describe('Esqueleto de Inicio', () => {
  it('sin bandera: el de hoy, sin «Sala» y sin leer la cookie', async () => {
    const html = await renderLoading()
    expect(html).toContain('<main class="page-grid [&amp;&gt;*]:max-w-4xl')
    expect(html).not.toContain('data-sala')
    expect(cookie.reads).toBe(0)
  })

  it('SALA_INICIO=1: el de «Sala», sin leer la cookie', async () => {
    process.env.SALA_INICIO = '1'
    expect(await renderLoading()).toBe('<div data-sala-stub="skeleton"></div>')
    expect(cookie.reads).toBe(0)
  })

  it('SALA_INICIO=prueba: el de «Sala» solo con la cookie', async () => {
    process.env.SALA_INICIO = 'prueba'
    expect(await renderLoading()).not.toContain('data-sala')
    cookie.value = '1'
    expect(await renderLoading()).toBe('<div data-sala-stub="skeleton"></div>')
  })
})
