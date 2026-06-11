// ============================================================
// E59-R6 — Descubrir: i18n de labels de filtros (trigger + opciones) y badge.
//
// Verifica el cambio R6: los labels de trigger y de opción de la barra de
// filtros, y el badge de tipo de las cards (modo "all"), salen del namespace
// i18n `discoverFilters` (antes placeholders humanizeKey/humanizeSlug). El
// value (slug canónico) NO cambia: sigue intacto en la URL.
//
// Estrategia: mockear **/api/discover* para que el grid pinte cards
// deterministas (sin Jikan/TMDB reales, sin flakiness). El login es real
// (route group (app) exige sesión). Los labels NO vienen del mock — vienen
// del bundle i18n del locale, así que es↔en difieren.
//
// Selectores: SIEMPRE data-testid o href/params. Nunca texto literal de label
// (sería circular: el test verifica el label, no debe asumirlo en el selector).
// ============================================================

import { test, expect, type Page } from '@playwright/test'
import { login, BASE } from './_helpers'

/** MediaItem mínimo que MediaGrid sabe renderizar. */
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
 * Intercepta /api/discover. type=all → mezcla de tipos (interleave) para probar
 * el badge por card. Resto → 12 items del tipo pedido. totalPages=1 (no nos
 * importa paginar aquí).
 */
async function mockDiscover(page: Page) {
  const ALL_TYPES = ['movie', 'tv', 'anime', 'book', 'manga', 'game', 'comic']
  await page.route('**/api/discover*', async (route) => {
    const url = new URL(route.request().url())
    const type = url.searchParams.get('type') ?? 'movie'
    const items =
      type === 'all'
        ? ALL_TYPES.map((t, i) => mockItem(t, 500 + i)) // 1 por tipo, interleave
        : Array.from({ length: 12 }, (_, i) => mockItem(type, 100 + i))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items, totalPages: 1, fetchErrorKind: null }),
    })
  })
}

test.describe('Descubrir — i18n filtros + badge [E59-R6]', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await mockDiscover(page)
  })

  // ── type=all: interleave de tipos + badge typeBadge visible y localizado ────
  test('type=all pinta interleave con badge de tipo localizado', async ({
    page,
  }) => {
    await page.goto(`${BASE}/es/discover?type=all&page=1`)

    // Las cards de varios tipos coexisten (interleave): movie, anime, game.
    await expect(
      page.locator('a[href*="/media/movie/"]').first()
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('a[href*="/media/anime/"]').first()
    ).toBeVisible()
    await expect(
      page.locator('a[href*="/media/game/"]').first()
    ).toBeVisible()

    // Badge de tipo presente (solo en modo "all", showType) y localizado: la
    // card de movie muestra el badge singular ES "Película", la de game
    // "Videojuego". Targeteamos la card por href, el badge por testid dentro.
    const movieBadge = page
      .locator('a[href*="/media/movie/"]')
      .first()
      .getByTestId('media-type-badge')
    await expect(movieBadge).toHaveText('Película')

    const gameBadge = page
      .locator('a[href*="/media/game/"]')
      .first()
      .getByTestId('media-type-badge')
    await expect(gameBadge).toHaveText('Videojuego')
  })

  test('badge de tipo se traduce al cambiar a /en', async ({ page }) => {
    await page.goto(`${BASE}/en/discover?type=all&page=1`)
    const movieBadge = page
      .locator('a[href*="/media/movie/"]')
      .first()
      .getByTestId('media-type-badge')
    await expect(movieBadge).toHaveText('Movie')
  })

  // ── type=book con filtros: chips activos + params correctos (slug intacto) ──
  test('book: genre + year aplican slug intacto a la URL', async ({ page }) => {
    await page.goto(`${BASE}/es/discover?type=book&page=1`)
    await expect(
      page.locator('a[href*="/media/book/"]').first()
    ).toBeVisible({ timeout: 10_000 })

    // Abrir trigger genre (searchable) y seleccionar la opción slug "fantasia".
    await page.getByTestId('filter-trigger-genre').click()
    await page.getByTestId('filter-opt-genre-fantasia').click()
    // El value (slug) viaja a la URL intacto, NO el label traducido.
    await expect(page).toHaveURL(/[?&]genre=fantasia(&|$)/, { timeout: 8_000 })

    // Abrir trigger year (single) y seleccionar "classic".
    await page.getByTestId('filter-trigger-year').click()
    await page.getByTestId('filter-opt-year-classic').click()
    await expect(page).toHaveURL(/[?&]genre=fantasia(&|$)/)
    await expect(page).toHaveURL(/[?&]year=classic(&|$)/, { timeout: 8_000 })

    // El trigger genre queda "activo" (badge searchable cuenta selección).
    await expect(page.getByTestId('badge-genre')).toBeVisible()
  })

  // ── Cambio de locale es↔en: trigger + opciones muestran label traducido ─────
  // Verificamos 1-2 claves concretas por idioma (no todas), por testid.
  test('labels de trigger y opción difieren es vs en', async ({ page }) => {
    // ---- ES ----
    await page.goto(`${BASE}/es/discover?type=movie&page=1`)
    await expect(
      page.locator('a[href*="/media/movie/"]').first()
    ).toBeVisible({ timeout: 10_000 })

    // trigger genre → "Género" (no slug "genre", no "Genre")
    await expect(page.getByTestId('filter-trigger-genre')).toContainText(
      'Género'
    )
    // opción sort title_az → "Título A–Z". Abrir el popover sort primero.
    await page.getByTestId('filter-trigger-sort').click()
    await expect(page.getByTestId('filter-opt-sort-title_az')).toHaveText(
      'Título A–Z'
    )

    // ---- EN ----
    await page.goto(`${BASE}/en/discover?type=movie&page=1`)
    await expect(
      page.locator('a[href*="/media/movie/"]').first()
    ).toBeVisible({ timeout: 10_000 })

    await expect(page.getByTestId('filter-trigger-genre')).toContainText(
      'Genre'
    )
    await page.getByTestId('filter-trigger-sort').click()
    await expect(page.getByTestId('filter-opt-sort-title_az')).toHaveText(
      'Title A–Z'
    )
  })
})
