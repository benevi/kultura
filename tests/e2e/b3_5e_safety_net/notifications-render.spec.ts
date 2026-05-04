// ============================================================
// B3.5e — RED DE SEGURIDAD: Notifications render
//
// Flujo: usuario con notificaciones → /notifications → al menos 1 item visible.
//
// Estado esperado (ROTO): la lista muestra el estado vacío ("sin notificaciones")
//   aunque el usuario sí tenga notificaciones en DB, O la página no renderiza
//   nada porque el Server Component falla silenciosamente.
//
// Nota: NotificationsList es un Server Component que recibe `notifications`
//   del servidor. Si el bug es que la query devuelve vacío (RLS o migración
//   pendiente), el test fallará porque verá el estado vacío en lugar de items.
//
// REQUIERE: TEST_USER_EMAIL, TEST_USER_PASSWORD en .env.local
//   El usuario de prueba debe tener al menos 1 notificación en DB.
// ============================================================

import { test, expect } from '@playwright/test'
import { login, hasCredentials, BASE } from './_helpers'

test.describe('Notifications — render de items [B3.5e]', () => {
  test.skip(!hasCredentials(), 'Credenciales TEST_USER_EMAIL/TEST_USER_PASSWORD no configuradas')

  test('la página muestra al menos 1 notificación si el usuario las tiene', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE}/es/notifications`)

    // Verificar que la página cargó (el título está presente)
    await expect(
      page.getByRole('heading', { name: /notificaciones/i })
    ).toBeVisible({ timeout: 8_000 })

    // ASERCIÓN: debe existir al menos un item de notificación renderizado.
    // Los items tienen clase p-4 y contienen texto de un usuario.
    // En estado roto: solo aparece el estado vacío (Bell icon + "No tienes notificaciones").
    //
    // Si el usuario de prueba no tiene notificaciones, este test pasa vacío
    // (el "roto" es que nunca llegan). Ajustar creando una notificación manualmente
    // en Supabase para el usuario de prueba antes de ejecutar los tests.
    const notifItems = page.locator('div.divide-y > div')
    const emptyState = page.locator('text=/no tienes notificaciones/i')

    // El test falla si aparece el estado vacío cuando el usuario SÍ tiene notificaciones.
    // Verificar que hay items (bg-surface border rounded-xl con divide-y).
    const hasItems = await notifItems.count() > 0
    const hasEmpty = await emptyState.isVisible().catch(() => false)

    // Si hay estado vacío Y el usuario debería tener notifs → fallo esperado.
    // Si hay items → el flujo funciona (test verde = no hay bug aquí).
    expect(
      hasItems || hasEmpty,
      'La página de notificaciones no renderizó ni items ni estado vacío — crash silencioso'
    ).toBeTruthy()

    // Esta segunda aserción es la que detecta el bug específico:
    // si hay estado vacío cuando el usuario tiene notifs en DB → ROJO.
    // (El usuario debe verificar manualmente que TEST_USER tiene notifs.)
    expect(
      hasItems,
      'Estado vacío visible — posible bug: query de notificaciones retorna vacío (RLS o migración pendiente)'
    ).toBeTruthy()
  })
})
