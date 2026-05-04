// ============================================================
// B3.5e — RED DE SEGURIDAD: Chat send
//
// Flujo: usuario logueado → /chat → seleccionar amigo → enviar mensaje.
// Estado esperado (ROTO): el mensaje no persiste tras el send —
//   la respuesta 500/403 del API hace que el mensaje optimista desaparezca
//   y aparezca el toast de error, O el mensaje nunca llega al otro lado.
//
// REQUIERE: TEST_USER_EMAIL, TEST_USER_PASSWORD en .env.local
//   El usuario de prueba debe tener al menos 1 amigo.
// ============================================================

import { test, expect } from '@playwright/test'
import { login, hasCredentials, BASE } from './_helpers'

test.describe('Chat — enviar mensaje [B3.5e]', () => {
  test.skip(!hasCredentials(), 'Credenciales TEST_USER_EMAIL/TEST_USER_PASSWORD no configuradas')

  test('el mensaje enviado persiste en la conversación', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE}/es/chat`)

    // Abrir picker de nuevo chat
    await page.getByRole('button', { name: /nuevo|new|chat/i }).first().click()

    // Seleccionar el primer amigo disponible
    const friendButton = page.locator('button').filter({ hasText: /\w+/ }).first()
    await expect(friendButton).toBeVisible({ timeout: 8_000 })
    await friendButton.click()

    // Esperar redirect a /chat/[id]
    await page.waitForURL(/\/chat\/[a-f0-9-]{36}/, { timeout: 15_000 })

    const messageText = `test-b3-5e-${Date.now()}`

    // Escribir y enviar mensaje
    const input = page.locator('input[type=text]').or(page.locator('textarea')).first()
    await input.fill(messageText)
    await page.getByRole('button', { name: /enviar|send/i }).or(
      page.locator('button[aria-label*="end"]')
    ).first().click()

    // ASERCIÓN: el mensaje debe aparecer en la conversación
    // En estado roto: el mensaje optimista desaparece (removed on error)
    // y aparece toast de error. El test falla porque el mensaje NO queda visible.
    await expect(page.getByText(messageText)).toBeVisible({ timeout: 8_000 })

    // Verificar que NO apareció toast de error
    await expect(page.locator('[role="alert"]').filter({ hasText: /error/i }))
      .not.toBeVisible({ timeout: 3_000 })
  })
})
