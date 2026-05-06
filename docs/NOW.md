# B3.5c-3-VERIFY — Verificación visual del usuario

## Qué cambia
Nada de código. El usuario abre la app en `npm run dev` y confirma que los 4 bugs están arreglados.

## Cómo sé que funciona
- /chat: elegir amigo → redirige a /chat/[id] sin error
- /groups/[id]: publicar post → aparece en el feed
- /notifications: página carga sin crash, items visibles
- /discover: grid con cards para tab movie (y otros si las APIs responden)
- Ningún flujo previo se rompe

## Archivos que toco
Ninguno.

## Cuándo paro
Tras pegar resultados de verificación visual (✓/✗ por check).

---

## Nota: E2E pendiente con dev server correcto

Los tests E2E fallaron porque el dev server en puerto 3000 estaba arrancado con Supabase de **producción** (no kultura-test). El login de los usuarios de prueba (`test-user-a@example.com`) falla contra producción porque esos usuarios solo existen en kultura-test.

**Para ejecutar los E2E correctamente:**
1. Cerrar el dev server de producción (`Ctrl+C` en el terminal donde corre `npm run dev`).
2. Ejecutar los tests: `npx playwright test tests/e2e/b3_5e_safety_net/`
3. Playwright arrancará automáticamente el dev server con las env vars de `.env.test.local` (kultura-test).

**Resultado esperado tras cerrar el dev server manual:**
| Spec | Resultado esperado |
|---|---|
| language-switch | VERDE ✓ |
| notifications-render | VERDE ✓ |
| group-feed-post | VERDE ✓ |
| chat-send | VERDE ✓ |
| discover tab movie | VERDE ✓ |
| discover anime/manga | VERDE o ROJO según Jikan rate limit |

**Migration pendiente en producción:** `supabase/migrations/20260506000001_fix_conversation_members_policy.sql` fue aplicada a kultura-test pero NO a producción (app-movies). Aplicar antes de hacer push de los cambios a producción.
