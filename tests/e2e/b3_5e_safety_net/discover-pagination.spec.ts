// ============================================================
// B3.5e — RED DE SEGURIDAD: Discover — tabs anime/manga + paginación
//
// Flujo: usuario en /discover → cambiar a tab "anime" → verificar resultados
//   → paginar a página 2 → verificar que hay resultados en página 2.
//   Repetir con tab "manga".
//
// CORRECCIÓN: /discover NO es pública — está en el route group (app) cuyo layout
// redirige a /login si no hay sesión. El beforeEach hace login antes de cada test.
//
// E41 DESBLOQUEADO (E59 F2, 2026-06-06): el fetch de Descubrir se movió a un
// Route Handler /api/discover que llama el NAVEGADOR (antes era un fetch en el
// RSC, server-side, que page.route no podía interceptar). Ahora mockeamos
// page.route('**/api/discover*') y devolvemos items deterministas por tipo, así
// los tests no dependen de Jikan/TMDB reales (sin flakiness por rate-limit/red).
// ============================================================

import { test, expect, type Page } from '@playwright/test'
import { login, BASE } from './_helpers'

/** Construye un MediaItem mínimo que MediaGrid sabe renderizar. */
function mockItem(type: string, id: number) {
  return {
    id: `${type}_${id}`,
    externalId: String(id),
    type,
    title: `${type} item ${id}`,
    year: 2024,
    rating: 8,
  }
}

/**
 * Intercepta /api/discover y responde con 20 items deterministas del `type`
 * pedido. E79 slice 1: el gate de "next" ahora usa hasMore (no totalPages).
 * Devolvemos hasMore=true en páginas 1..2 y false en la 3 → páginas 1..3
 * navegables, next deshabilitado en la última.
 */
async function mockDiscover(page: Page) {
  await page.route('**/api/discover*', async (route) => {
    const url = new URL(route.request().url())
    const type = url.searchParams.get('type') ?? 'movie'
    const pageNum = parseInt(url.searchParams.get('page') ?? '1', 10)
    const items = Array.from({ length: 20 }, (_, i) =>
      mockItem(type, pageNum * 100 + i)
    )
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items,
        totalPages: 3,
        hasMore: pageNum < 3,
        fetchErrorKind: null,
      }),
    })
  })
}

/**
 * E79 slice 1 — caso clave: una página filtrada que queda VACÍA tras post-filtro
 * pero cuya FUENTE cruda tiene más (hasMore=true). Antes esto deshabilitaba next
 * (totalPages no reflejaba la fuente); ahora next sigue habilitado y se puede
 * avanzar a la siguiente página, que sí trae resultados.
 */
async function mockFilteredEmptyFirstPage(page: Page) {
  await page.route('**/api/discover*', async (route) => {
    const url = new URL(route.request().url())
    const type = url.searchParams.get('type') ?? 'game'
    const pageNum = parseInt(url.searchParams.get('page') ?? '1', 10)
    // page 1: vacía tras filtrar, pero hay más fuente. page 2: con resultados.
    const items =
      pageNum === 1
        ? []
        : Array.from({ length: 20 }, (_, i) => mockItem(type, pageNum * 100 + i))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items,
        totalPages: 5,
        hasMore: pageNum < 5,
        fetchErrorKind: null,
      }),
    })
  })
}

test.describe('Discover — tabs anime/manga + paginación [B3.5e]', () => {
  // /discover está dentro del route group (app) — el layout requiere auth.
  test.beforeEach(async ({ page }) => {
    await login(page)
    await mockDiscover(page)
  })

  test('tab anime muestra resultados', async ({ page }) => {
    await page.goto(`${BASE}/es/discover?type=anime&page=1`)

    const noResults = page.getByTestId('discover-empty')
    const mediaCards = page.locator('a[href*="/media/anime/"]')

    await expect(mediaCards.first()).toBeVisible({ timeout: 10_000 })
    expect(
      await noResults.isVisible().catch(() => false),
      'Tab anime muestra "sin resultados" pese al mock'
    ).toBeFalsy()
    expect(await mediaCards.count(), 'Tab anime sin cards').toBeGreaterThan(0)
  })

  test('tab manga muestra resultados', async ({ page }) => {
    await page.goto(`${BASE}/es/discover?type=manga&page=1`)

    const mediaCards = page.locator('a[href*="/media/manga/"]')
    await expect(mediaCards.first()).toBeVisible({ timeout: 10_000 })
    expect(await mediaCards.count(), 'Tab manga sin cards').toBeGreaterThan(0)
  })

  test('paginación en anime avanza a página 2', async ({ page }) => {
    await page.goto(`${BASE}/es/discover?type=anime&page=1`)
    await expect(
      page.locator('a[href*="/media/anime/"]').first()
    ).toBeVisible({ timeout: 10_000 })

    const nextBtn = page.getByTestId('pagination-next')
    await expect(nextBtn).toBeVisible({ timeout: 8_000 })
    await nextBtn.click()

    await expect(page).toHaveURL(/page=2/, { timeout: 8_000 })

    const page2Cards = page.locator('a[href*="/media/anime/"]')
    await expect(page2Cards.first()).toBeVisible({ timeout: 10_000 })
    expect(
      await page2Cards.count(),
      'Página 2 de anime está vacía — paginación rota'
    ).toBeGreaterThan(0)
  })

  test('tab movie (control) tiene resultados', async ({ page }) => {
    await page.goto(`${BASE}/es/discover?type=movie&page=1`)
    const mediaCards = page.locator('a[href*="/media/movie/"]')
    await expect(mediaCards.first()).toBeVisible({ timeout: 10_000 })
    expect(await mediaCards.count(), 'Tab movie vacío').toBeGreaterThan(0)
  })

  // E79 slice 1 — página filtrada vacía pero con más fuente: next sigue activo y
  // avanzar a la página siguiente trae resultados (antes venía bloqueada).
  test('página filtrada vacía no bloquea next; página siguiente trae resultados', async ({
    page,
  }) => {
    // Sobrescribe el mock por defecto del beforeEach con el de "primera vacía".
    await mockFilteredEmptyFirstPage(page)
    await page.goto(`${BASE}/es/discover?type=game&page=1`)

    // Página 1 vacía → estado vacío, pero el botón next NO está deshabilitado.
    await expect(page.getByTestId('discover-empty')).toBeVisible({
      timeout: 10_000,
    })
    const nextBtn = page.getByTestId('pagination-next')
    await expect(nextBtn).toBeVisible({ timeout: 8_000 })
    await expect(nextBtn).toBeEnabled()

    await nextBtn.click()
    await expect(page).toHaveURL(/page=2/, { timeout: 8_000 })

    // Página 2 sí trae resultados.
    const cards = page.locator('a[href*="/media/game/"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
    expect(
      await cards.count(),
      'Página 2 vacía pese a hasMore'
    ).toBeGreaterThan(0)
  })
})
