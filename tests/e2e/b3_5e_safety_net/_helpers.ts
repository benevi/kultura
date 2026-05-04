// ============================================================
// B3.5e — Helper compartido para tests de red de seguridad
//
// REQUISITO: variables de entorno en .env.local o entorno CI:
//   TEST_USER_EMAIL    — email de un usuario de prueba existente en Supabase
//   TEST_USER_PASSWORD — contraseña del usuario de prueba
//   TEST_GROUP_ID      — UUID de un grupo del que el usuario es miembro
//
// Si no están configuradas, los tests que dependen de auth devolverán skip
// automáticamente. Ver: docs/TEST_SETUP_B3_5e.md para crear el usuario.
// ============================================================

import type { Page } from '@playwright/test'

export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? ''
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? ''
export const TEST_GROUP_ID = process.env.TEST_GROUP_ID ?? ''

export const BASE = 'http://localhost:3000'

export function hasCredentials(): boolean {
  return Boolean(TEST_USER_EMAIL && TEST_USER_PASSWORD)
}

/**
 * Login via el formulario de /es/login.
 * No mockea auth — usa Supabase real con credenciales del env.
 */
export async function login(page: Page): Promise<void> {
  await page.goto(`${BASE}/es/login`)
  await page.getByLabel('Correo electrónico').fill(TEST_USER_EMAIL)
  await page.getByLabel('Contraseña').fill(TEST_USER_PASSWORD)
  await page.locator('form button[type=submit]').click()
  // Espera a que el redirect post-login complete
  await page.waitForURL(/\/(es|en)\/(home|library|discover)/, { timeout: 15_000 })
}
