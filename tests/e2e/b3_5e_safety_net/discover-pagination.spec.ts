// ============================================================
// B3.5e — RED DE SEGURIDAD: Discover — tabs anime/manga + paginación
//
// Flujo: usuario en /discover → cambiar a tab "anime" → verificar resultados
//   → paginar a página 2 → verificar que hay resultados en página 2.
//   Repetir con tab "manga".
//
// Estado esperado (ROTO según B3.5b): los tabs anime/manga/comics/manga
//   "no tienen resultados" — la API de Jikan puede fallar o retornar vacío,
//   o la paginación no propaga el param type correctamente.
//
// Este test NO requiere credenciales: /discover es pública para navegación
// (aunque el menú de auth esté presente, el contenido se carga sin auth).
// ============================================================

import { test, expect } from '@playwright/test'
import { BASE } from './_helpers'

test.describe('Discover — tabs anime/manga + paginación [B3.5e]', () => {
  test('tab anime muestra resultados', async ({ page }) => {
    await page.goto(`${BASE}/es/discover?type=anime&page=1`)

    // Esperar a que la página cargue (el grid de media)
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // ASERCIÓN: debe haber al menos 1 item en el grid.
    // MediaGrid renderiza cards con imagen/poster.
    // En estado roto: aparece "Sin resultados" o el grid está vacío.
    const noResults = page.locator('text=/sin resultados|no results/i')
    const mediaCards = page.locator('a[href*="/media/anime/"]')

    const hasResults = await mediaCards.count() > 0
    const hasNoResults = await noResults.isVisible().catch(() => false)

    // El test falla si aparece "sin resultados" (estado roto confirmado)
    expect(
      hasNoResults,
      'Tab anime muestra "sin resultados" — bug confirmado: Jikan API no retorna datos o normalización falla'
    ).toBeFalsy()

    expect(
      hasResults,
      'Tab anime no muestra cards de media — grid vacío sin mensaje de error visible'
    ).toBeTruthy()
  })

  test('tab manga muestra resultados', async ({ page }) => {
    await page.goto(`${BASE}/es/discover?type=manga&page=1`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    const noResults = page.locator('text=/sin resultados|no results/i')
    const mediaCards = page.locator('a[href*="/media/manga/"]')

    const hasResults = await mediaCards.count() > 0
    const hasNoResults = await noResults.isVisible().catch(() => false)

    expect(
      hasNoResults,
      'Tab manga muestra "sin resultados" — bug confirmado'
    ).toBeFalsy()

    expect(
      hasResults,
      'Tab manga no muestra cards de media'
    ).toBeTruthy()
  })

  test('paginación en anime avanza a página 2', async ({ page }) => {
    await page.goto(`${BASE}/es/discover?type=anime&page=1`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Verificar que hay botón de siguiente página
    const nextBtn = page.getByTestId('pagination-next')

    // Si no hay resultados, la paginación no aparece — el fallo es en el test anterior
    const paginationExists = await nextBtn.isVisible().catch(() => false)
    if (!paginationExists) {
      // Marcar explícitamente: si no hay paginación, probablemente tampoco hay resultados
      expect(
        paginationExists,
        'No hay controles de paginación en anime — posiblemente sin resultados (ver test anterior)'
      ).toBeTruthy()
    }

    await nextBtn.click()

    // ASERCIÓN: URL debe cambiar a page=2
    await expect(page).toHaveURL(/page=2/, { timeout: 8_000 })

    // ASERCIÓN: la página 2 también debe tener resultados
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    const page2Cards = page.locator('a[href*="/media/anime/"]')
    expect(
      await page2Cards.count() > 0,
      'Página 2 de anime está vacía — paginación no funciona correctamente'
    ).toBeTruthy()
  })

  test('tab movie (control) tiene resultados — verifica que el problema es específico de anime/manga', async ({ page }) => {
    await page.goto(`${BASE}/es/discover?type=movie&page=1`)
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // Tab movie debe funcionar. Si este test también falla, el problema
    // es más amplio que solo anime/manga.
    const mediaCards = page.locator('a[href*="/media/movie/"]')
    expect(
      await mediaCards.count() > 0,
      'Tab movie también está vacío — problema más amplio que anime/manga'
    ).toBeTruthy()
  })
})
