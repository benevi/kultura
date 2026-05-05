# B3.5e-3-local-FIX — Resolver bloqueos de entorno E2E

## Contexto

B3.5e-3-local ejecutó los 5 specs pero encontró 2 bloqueos estructurales que impiden validar la red de seguridad:

**H1 — Login imposible**: el dev server usa `NEXT_PUBLIC_SUPABASE_URL=zfrbyphzvfuvejdwjfea` (producción). Los usuarios de test (`test-user-a@example.com`) solo existen en el proyecto de test (`xqvicvypoxxfbezqnkwr`). El `login()` del helper hace submit del formulario → Supabase de producción rechaza credenciales → no redirige → timeout. Afecta: language-switch (test 2), notifications-render, chat-send, group-feed-post (4 tests de 5 specs).

**H3 — Discover vacío globalmente**: `/discover?type=movie` también retorna grid vacío. El control falla igual que los bugs esperados. Puede ser rate-limit de TMDB, timeout de red durante `networkidle`, o que el Server Component de discover falla silenciosamente sin mostrar error. Afecta: los 4 tests de discover-pagination.

## Qué cambia

**Para H1** — Dos opciones (elegir antes de implementar):
- Opción A: crear los usuarios de test también en producción via seed. Riesgo: contamina prod con cuentas de test.
- Opción B: configurar Playwright para que el dev server arranque apuntando al proyecto de test (`NEXT_PUBLIC_SUPABASE_URL=xqvicvypoxxfbezqnkwr`). Requiere un `.env.test.local` o override en `webServer.env` del playwright.config.ts.

**Para H3** — Diagnosticar qué retorna `/api/discover?type=movie` durante los tests y por qué el grid está vacío.

## Cómo sé que funciona

- `login()` completa sin timeout (URL cambia a `/es/home` en ≤15s).
- Tab movie en `/discover` muestra al menos 1 card (test de control verde).
- Los 4 specs que dependen de auth llegan a la página destino y fallan por el bug de la app (no por login).
- El tab movie es verde-esperado; anime/manga/paginación son rojo-esperado.

## Archivos que toco

- `playwright.config.ts` (webServer.env para H1-B, o similar)
- posiblemente `.env.test.local` (nuevo archivo, en .gitignore)
- NO tocar `src/` — solo config de entorno de test

## Cuándo paro

Tras re-ejecutar los 5 specs con el login funcionando y el control de discover verde.
