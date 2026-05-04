// ============================================================
// B3.5e — RED DE SEGURIDAD: Language switcher
//
// Flujo: usuario en /es/home → click en LanguageSwitcher → verificar que
//   la URL cambia a /en/home Y que aparece texto en inglés.
//
// Estado esperado (ROTO): tras el click, la URL sigue siendo /es/
//   o la página muestra texto en español. El bug reportado es que
//   el switcher no cambia el idioma efectivamente.
//
// Este test NO requiere credenciales: verifica la landing pública.
// Para cubrir el caso autenticado (home), el test alternativo usa auth.
// ============================================================

import { test, expect } from '@playwright/test'
import { login, hasCredentials, BASE } from './_helpers'

const ES_LANDING_HEADING = /Descubre, registra/i
const EN_LANDING_HEADING = /Discover, track/i

test.describe('LanguageSwitcher [B3.5e]', () => {
  test('desde landing pública /es → click switcher → URL cambia a /en', async ({ page }) => {
    await page.goto(`${BASE}/es`)

    // Verificar que estamos en español
    await expect(page.getByRole('heading', { name: ES_LANDING_HEADING }))
      .toBeVisible({ timeout: 8_000 })

    // Buscar el botón del language switcher (muestra ES con bandera)
    const switcher = page.locator('button[aria-label*="Switch"]').or(
      page.locator('button').filter({ hasText: /^ES$/ })
    ).first()
    await expect(switcher).toBeVisible({ timeout: 5_000 })
    await switcher.click()

    // ASERCIÓN 1: URL debe cambiar a /en/
    // En estado roto: la URL sigue siendo /es/ o no cambia.
    await expect(page).toHaveURL(/\/en(\/|$)/, { timeout: 8_000 })

    // ASERCIÓN 2: el contenido debe estar en inglés
    // En estado roto: sigue en español aunque la URL haya cambiado.
    await expect(page.getByRole('heading', { name: EN_LANDING_HEADING }))
      .toBeVisible({ timeout: 8_000 })
  })

  test('desde /es/home autenticado → click switcher → URL cambia a /en/home', async ({ page }) => {
    test.skip(!hasCredentials(), 'Requiere TEST_USER_EMAIL/TEST_USER_PASSWORD')

    await login(page)
    // login redirige a home — asegurarse de estar en /es/home
    const currentUrl = page.url()
    if (!currentUrl.includes('/es/')) {
      await page.goto(`${BASE}/es/home`)
    }

    const switcher = page.locator('button[aria-label*="Switch"]').or(
      page.locator('button').filter({ hasText: /^ES$/ })
    ).first()
    await expect(switcher).toBeVisible({ timeout: 5_000 })
    await switcher.click()

    // ASERCIÓN: URL debe contener /en/
    await expect(page).toHaveURL(/\/en\//, { timeout: 8_000 })

    // ASERCIÓN: algún texto de UI en inglés visible (el header de la app)
    // Por ejemplo el título de la sección Home en inglés vs español
    // En es: "Mi Actividad" | "Mis Amigos" — en en: "My Activity" | "My Friends"
    await expect(
      page.getByText(/My Activity|My Friends|Discover|Library/i).first()
    ).toBeVisible({ timeout: 8_000 })
  })
})
