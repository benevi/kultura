// ============================================================
// B3.5e — RED DE SEGURIDAD: GroupFeed post
//
// Flujo: usuario miembro de un grupo → /groups/[id] → escribir post → enviar.
// Estado esperado (ROTO): el post no aparece en el feed.
//   GroupFeed.tsx usa Supabase browser client sin manejo de error.
//   Si las tablas group_posts no tienen datos (migración pendiente) o
//   RLS bloquea la query, el feed se queda vacío silenciosamente.
//
// REQUIERE: TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_GROUP_ID en .env.local
//   TEST_GROUP_ID = UUID de un grupo del que el usuario de prueba es miembro.
// ============================================================

import { test, expect } from '@playwright/test'
import { login, hasCredentials, BASE, TEST_GROUP_ID } from './_helpers'

test.describe('GroupFeed — publicar post [B3.5e]', () => {
  test.skip(
    !hasCredentials() || !TEST_GROUP_ID,
    'Credenciales o TEST_GROUP_ID no configurados'
  )

  test('el post publicado aparece en el feed del grupo', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE}/es/groups/${TEST_GROUP_ID}`)

    // Verificar que cargó la página del grupo (el usuario es miembro)
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 10_000 })

    const postText = `post-b3-5e-${Date.now()}`

    await textarea.fill(postText)

    // Enviar post
    await page.getByRole('button', { name: /publicar|publish|enviar/i }).first().click()

    // ASERCIÓN: el post debe aparecer en el feed
    // En estado roto: el insert falla silenciosamente (sin catch) y el post no aparece.
    // El test falla porque el texto del post NO es visible después del envío.
    await expect(page.getByText(postText)).toBeVisible({ timeout: 10_000 })
  })
})
