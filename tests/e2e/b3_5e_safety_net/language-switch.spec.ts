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
// El sub-test 'landing pública' se eliminó en B3.5e-3-local-FIX.
// Razón: la landing pública NO renderiza <LanguageSwitcher>; solo
// existe en <AuthHeader> (app autenticada). El sub-test 'home
// autenticado' cubre el feature íntegro.
// ============================================================

import { test, expect } from '@playwright/test'
import { login, hasCredentials, BASE } from './_helpers'

test.describe('LanguageSwitcher [B3.5e]', () => {
  test('desde /es/home autenticado → click switcher → URL cambia a /en/home', async ({ page }) => {
    test.skip(!hasCredentials(), 'Requiere TEST_USER_EMAIL/TEST_USER_PASSWORD')

    await login(page)
    // login redirige a home — asegurarse de estar en /es/home
    const currentUrl = page.url()
    if (!currentUrl.includes('/es/')) {
      await page.goto(`${BASE}/es/home`)
    }

    // F-14 movió el selector de idioma al menú de la cuenta (disclosure):
    // botón "Menú de la cuenta de …" y dentro, el botón "English".
    const accountMenu = page.getByRole('button', { name: /Menú de la cuenta de/ })
    await expect(accountMenu).toBeVisible({ timeout: 5_000 })
    await accountMenu.click()
    const switcher = page.getByRole('button', { name: 'English' })
    await expect(switcher).toBeVisible({ timeout: 5_000 })
    await switcher.click()

    // ASERCIÓN: URL debe contener /en/
    await expect(page).toHaveURL(/\/en\//, { timeout: 8_000 })

    // ASERCIÓN: el atributo lang del documento cambió a "en"
    // Más robusto que buscar texto: funciona en desktop y mobile sin
    // depender de qué elementos de nav están visibles en cada viewport.
    await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 8_000 })
  })
})
