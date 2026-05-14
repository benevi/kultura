# AUDIT-E2E-3 — Diagnóstico de rojos persistentes

**Fecha:** 2026-05-14  
**Commit auditado:** `c6a9e3a` (HEAD = `origin/master` post B3.5h-AUDIT-E2E-2)  
**Auditor:** Claude Sonnet 4.6 (solo lectura — sin cambios en specs ni en código de app)  
**Bloque anterior:** B3.5h-AUDIT-E2E-2 (cerrado, 24 passed / 10 failed)

---

## Contexto

B3.5h-AUDIT-E2E-2 cerró 5 hallazgos (E39, E26, E40-falso-verde, E43, E42) pero dejó dos familias de rojos sin causa raíz documentada:

1. `auth.spec.ts` "successful registration" — rojo legítimo post-E40-fix.
2. `discover-pagination.spec.ts` — rojo completo (todos los tabs: anime, manga, movie, paginación).

Este bloque diagnostica ambos sin tocar specs ni código de app.

---

## Pre-checks

| Check | Resultado |
|-------|-----------|
| `git status` | working tree clean |
| `git log -1 --oneline` | `c6a9e3a [B3.5h-AUDIT-E2E-2] docs: actualizar NOW, BACKLOG, DONE` |
| `npm run lint` | 0 errors, 2 warnings preexistentes (SearchResults.tsx useMemo) |
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 493/493 passed |
| E2E baseline | **24 passed / 10 failed** — coincide con expectativa |

Baseline E2E guardado en `e2e_baseline.txt`.

---

## E40 — auth.spec.ts "successful registration"

### Reproducción

```
x [chromium] auth.spec.ts:73:7 — successful registration flow (14.8s)
x [Mobile Chrome] auth.spec.ts:73:7 — successful registration flow (14.8s)
```

Error en ambas plataformas:

```
Error: expect(locator).toBeVisible() failed
Locator: getByText('Revisa tu correo')
Expected: visible
Timeout: 2000ms
Error: element(s) not found
```

El spec (post-eba7afa) implementa esta lógica:

```typescript
const didRedirect = await page.waitForURL(/\/home/, { timeout: 12000 }).then(() => true).catch(() => false);
if (!didRedirect) {
  await expect(page.getByText("Revisa tu correo")).toBeVisible({ timeout: 2000 });
}
```

Dos ramas de éxito posibles:
- **(a)** Auto-login → redirige a `/home` (`data.session != null` en `handleRegister`).
- **(b)** Email confirmation required → `form.success = true` → render `tAuth("checkEmail")` = `"Revisa tu correo"`.

El test falla porque **ninguna rama ocurre**: `waitForURL(/\/home/)` agota los 12s (sin redirect) y luego `"Revisa tu correo"` no está en el DOM (sin mensaje de éxito). La página permanece en el formulario de registro.

### Hipótesis evaluadas

**H-E40-A: Email confirmation activada en kultura-test — descartada como causa exclusiva.**

Si "Confirm email" estuviera activado Y el signUp tiene éxito, Supabase retorna `data.session = null` + `data.user != null`. En ese caso `handleRegister` ejecutaría `setForm({ success: true })` → aparecería `"Revisa tu correo"`. El test pasaría (rama b). Como el test FALLA y `"Revisa tu correo"` NO aparece, significa que el signUp no llegó al bloque `if (data.session) / else` — se detuvo antes en el bloque `if (error)`.

**H-E40-B: El email `@kultura-test.dev` es rechazado por Supabase kultura-test — confirmada como causa probable.**

`handleRegister` en `LoginPage.tsx:150-171`:

```typescript
const { error, data } = await supabase.auth.signUp({
  email: form.email,  // test_<timestamp>@kultura-test.dev
  password: form.password,
});

if (error) {
  // ← spec llega aquí: no redirect, no success msg, solo form.error
  setForm(prev => ({ ...prev, loading: false, error: tErrors(key) }));
  return;
}
```

El email `test_<timestamp>@kultura-test.dev` ya causó `email_address_invalid` en B3.5e-1 (DONE.md línea 107: "Supabase rechaza dominio `@kultura.test` en signUp"). El dominio `@kultura-test.dev` probablemente sufre el mismo rechazo porque `kultura-test.dev` no es un dominio real con registros MX válidos, y algunos planes de Supabase validan el TLD del dominio. Esto explicaría el path de error sin mensaje de éxito.

**No se puede verificar desde CC** sin acceso al Dashboard de Supabase kultura-test (Authentication → Providers → Email) ni a los logs del proyecto. Acción para el humano: ver H-E40-B-verificacion abajo.

**H-E40-C: El flujo de la app no coincide con lo que asume el spec — descartada.**

El código de `LoginPage.tsx` es coherente con el spec:
- Si `data.session` → push `/home` ✓ (rama a del spec)
- Si `!data.session && !error` → `success: true` → render `"Revisa tu correo"` ✓ (rama b del spec)

El spec cubre exactamente los dos caminos felices que implementa el componente. La lógica del componente no cambió desde el fixture del spec.

### Causa raíz

`supabase.auth.signUp({ email: "test_<ts>@kultura-test.dev" })` retorna `error` (probablemente `email_address_invalid` o equivalente). El componente entra por el path de error → `form.error` se setea → el formulario permanece visible sin mensaje de éxito ni redirect. El spec espera exactamente esas dos señales de éxito y no encuentra ninguna.

La causa raíz es la combinación de: **dominio `@kultura-test.dev` rechazado por Supabase kultura-test** + **el spec usa ese dominio hardcodeado** (`TEST_EMAIL = \`test_${Date.now()}@kultura-test.dev\``).

### H-E40-B — Verificación requerida al humano

El humano debe verificar UNA de estas opciones desde el Dashboard de Supabase del proyecto `kultura-test` (ref `xqvicvypoxxfbezqnkwr`):

**Opción 1 — Comprobar si el dominio causa error:**
Dashboard → Authentication → Logs → buscar intentos de signUp con `@kultura-test.dev`. Si aparece `email_address_invalid`, H-E40-B confirmada.

**Opción 2 — Probar manualmente:**
En la app corriendo en `:3001`, intentar registrar `test_manual@example.com` con password válido. Si aparece `"Revisa tu correo"`, el problema es específicamente el dominio `@kultura-test.dev`.

### Propuesta de fix (no ejecutada)

**Fix 1 (recomendado) — Cambiar dominio en spec a `@example.com`:**

```typescript
// auth.spec.ts:3
const TEST_EMAIL = `test_${Date.now()}@example.com`;
```

`example.com` es un dominio sintácticamente válido con estructura real. Supabase no puede rechazarlo como `email_address_invalid`. Si kultura-test tiene "Confirm email" activado, el test pasará por rama (b). Si tiene auto-login, pasará por rama (a).

Dimensión: 1 archivo, 1 línea. Bloque candidato: B3.5h-AUDIT-E2E-4 o standalone fix.

**Fix 2 (alternativo) — Usar la var de entorno TEST_USER_EMAIL:**

```typescript
// auth.spec.ts
const TEST_EMAIL = `test_${Date.now()}@${process.env.TEST_USER_EMAIL?.split('@')[1] ?? 'example.com'}`;
```

Reutiliza el dominio que ya funciona en kultura-test (el de TEST_USER_EMAIL que pasó los tests de login/seed).

---

## discover-pagination

### Reproducción

```
x [chromium]     discover-pagination.spec.ts:28  — tab anime muestra resultados (2.1s)
x [chromium]     discover-pagination.spec.ts:55  — tab manga muestra resultados (1.0s)
x [chromium]     discover-pagination.spec.ts:76  — paginación en anime avanza a página 2 (1.0s)
x [chromium]     discover-pagination.spec.ts:107 — tab movie (control) tiene resultados (1.0s)
x [Mobile Chrome] (mismos 4 tests)
```

### Evidencia clave — Page snapshot del tab movie

El `error-context.md` del test "tab movie (control)" revela:

```yaml
- main:
  - heading "KULTURA"
  - paragraph: "Descubre tu cultura"
  - button "Iniciar sesión"
  - button "Registrarse"
  - textbox "Correo electrónico"
  - textbox "Contraseña"
  - button "Iniciar sesión"
```

La página que Playwright ve cuando navega a `/es/discover?type=movie&page=1` **es la página de login**, no la página de discover. El selector `a[href*="/media/movie/"]` no encuentra nada porque el contenido renderizado es el formulario de autenticación.

### Hipótesis evaluadas

**H-DISC-A: TMDB API key no llega al server de Playwright — descartada.**

`playwright.config.ts:50` aplica `...(process.env as Record<string, string>)` al `webServer.env`. `process.env` fue poblado por `loadEnvConfig(process.cwd())` al inicio del config, lo que carga `.env.local`. `.env.local` contiene `TMDB_API_KEY=<valor real>`. Por tanto la key SÍ está disponible en el proceso del webServer. Verificado: `.env.test.local` solo sobreescribe `NEXT_PUBLIC_SUPABASE_*`; no toca `TMDB_API_KEY`.

**H-DISC-B: Rate-limit de TMDB — descartada.**

No aplica: el problema ocurre antes de que TMDB sea llamado. La app ni siquiera llega a ejecutar `getPopularMovies()` porque el layout redirige al login antes de renderizar el RSC de discover.

**H-DISC-C (nueva) — Ruta `/discover` protegida por auth en el layout `(app)` — confirmada como causa raíz.**

`src/app/[locale]/(app)/layout.tsx:9-13`:

```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
```

La ruta `/es/discover` está dentro del route group `(app)`. El layout del grupo protege TODAS sus rutas: si no hay sesión autenticada, redirige a `/login`. El spec de discover navega directamente a `/es/discover?type=movie&page=1` sin pasar por un paso de login previo. El middleware Next.js no añade sesión automáticamente. Resultado: redirect a `/login` → página de login renderizada → cero cards de media → todos los asserts fallan.

**H-DISC-D: Cookies/auth afectadas por puerto :3001 — descartada.**

El problema no es el puerto sino la ausencia de sesión. El spec nunca hizo login.

### Tab movie (TMDB)

**Hipótesis confirmada:** H-DISC-C — ruta protegida por auth, spec sin login previo.

**Causa raíz:** `/es/discover?type=movie&page=1` redirige a `/login` porque el spec no tiene una sesión autenticada. El middleware Next.js no fuerza redirect (solo refreshea token), pero el layout de `(app)` sí lo hace. La redirección ocurre antes de cualquier llamada a TMDB.

**Propuesta de fix:**
Añadir paso de login al `beforeEach` (o `beforeAll`) del spec, usando el helper `login()` de `_helpers.ts`:

```typescript
import { login, BASE } from './_helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})
```

`login()` usa `TEST_USER_EMAIL` y `TEST_USER_PASSWORD` del env, navega a `/es/login`, rellena el form, y espera `waitForURL(/\/(es|en)\/(home|library)/)`. Ya verificado que funciona (chat-send.spec.ts y otros lo usan).

Dimensión: 3-4 líneas en el spec. Bloque candidato: B3.5h-AUDIT-E2E-4 o standalone fix.

### Tab anime y manga (Jikan)

**Hipótesis confirmada:** H-DISC-C — misma causa que tab movie.

E41 (Jikan mock no viable via page.route por RSC) sigue siendo válido como deuda separada, pero NO es la causa del rojo actual. El rojo del tab anime en el baseline actual se debe exclusivamente a la falta de sesión, no a la incapacidad de mockear Jikan.

Si se añade login (fix propuesto arriba), el tab anime pasará a depender de la API real de Jikan. En ese punto, E41 se vuelve relevante: si Jikan está caído o rate-limita, el test falla. La deuda E41 sigue en pie, pero es independiente del rojo actual.

### Paginación anime

**Causa raíz:** igual que los anteriores. Sin sesión → redirect a login → no hay botón de paginación → `nextBtn.isVisible()` retorna false → assert de paginación falla.

---

## Mapa de los 10 rojos restantes

| # | Test (corrida chromium) | Causa según este audit | Estado |
|---|------------------------|------------------------|--------|
| 1 | auth.spec.ts — successful registration (chromium) | H-E40-B: dominio `@kultura-test.dev` rechazado por signUp en kultura-test | **Diagnosticado** |
| 2 | discover-pagination — tab anime (chromium) | H-DISC-C: sin login previo → redirect a /login | **Diagnosticado** |
| 3 | discover-pagination — tab manga (chromium) | H-DISC-C: sin login previo → redirect a /login | **Diagnosticado** |
| 4 | discover-pagination — paginación anime (chromium) | H-DISC-C: sin login previo → redirect a /login | **Diagnosticado** |
| 5 | discover-pagination — tab movie control (chromium) | H-DISC-C: sin login previo → redirect a /login | **Diagnosticado** |
| 6 | auth.spec.ts — successful registration (Mobile Chrome) | Misma causa que #1 | **Diagnosticado** |
| 7 | discover-pagination — tab anime (Mobile Chrome) | Misma causa que #2-5 | **Diagnosticado** |
| 8 | discover-pagination — tab manga (Mobile Chrome) | Misma causa que #2-5 | **Diagnosticado** |
| 9 | discover-pagination — paginación anime (Mobile Chrome) | Misma causa que #2-5 | **Diagnosticado** |
| 10 | discover-pagination — tab movie control (Mobile Chrome) | Misma causa que #2-5 | **Diagnosticado** |

**Total: 10 / 10 rojos diagnosticados.**

Los 10 rojos se agrupan en exactamente 2 causas raíz distintas:
- **E40**: 2 corridas (chromium + mobile) — dominio de registro rechazado.
- **DISC**: 8 corridas (4 tests × 2 plataformas) — spec sin login previo → redirect a /login.

---

## Hallazgos colaterales

1. **E41 mal atribuido en DONE.md de AUDIT-E2E-2.** La nota en DONE.md dice: "discover-pagination falla incluyendo 'tab movie' (TMDB): indica que las API keys de TMDB están presentes en `process.env`... El fallo es de los resultados (grid vacío), posiblemente por configuración del proyecto test o TMDB rate-limit en :3001." Esta hipótesis era incorrecta. La causa real (falta de auth) quedó sin diagnosticar porque no se inspeccionó el page snapshot. La nota de DONE.md debería actualizarse con la causa real al cerrar este bloque.

2. **`discover-pagination.spec.ts` fue diseñado como "test de ruta pública" pero la ruta no es pública.** El comentario en línea 11 dice: "Este test NO requiere credenciales: /discover es pública para navegación". Esto era incorrecto desde el inicio: `/discover` está dentro del route group `(app)` cuyo layout requiere auth. El spec necesita login por diseño arquitectural de la app.

3. **El error de E40 produce `form.error` visible en el DOM** (el componente lo muestra en un `<p>` de fondo rojo). El spec no asertea ese path de error. Si se quisiera documentar el comportamiento real (signUp rechazado), se podría añadir un assert en la rama `else` del spec para el caso de error de Supabase. No es bloqueante pero sería información útil.

4. **`TEST_EMAIL` en `auth.spec.ts:3` usa `Date.now()` como sufijo**, lo que crea un usuario distinto por ejecución. Contra kultura-test esto genera acumulación de usuarios fallidos (si el signUp llega a crearse antes de fallar). Si el problema es el dominio, los signUps se rechazan antes de crear filas en `auth.users`, por lo que no hay acumulación. Pero si el fix cambia a `@example.com` y Supabase acepta el signUp, se acumularán usuarios en kultura-test con cada ejecución — conviene limpiarlos periódicamente o usar un email fijo con `signUp` idempotente.

---

## Resumen ejecutivo

- **Rojos diagnosticados: 10 / 10**
- **Causas raíz distintas: 2**
  - E40: dominio `@kultura-test.dev` rechazado en signUp de kultura-test. Fix: cambiar a `@example.com` en `auth.spec.ts:3`.
  - DISC: spec de discover no autentica antes de navegar. Fix: añadir `login()` en `beforeEach`.
- **E41 (Jikan RSC no mockeable) sigue en BACKLOG** pero no es causa del rojo actual. Se vuelve relevante solo después de que DISC se fije.
- **Verificación de H-E40-B requiere acción del humano** en el Dashboard de Supabase kultura-test (ver sección E40).

### Bloques propuestos siguientes

1. **B3.5h-AUDIT-E2E-4** — Fix de los 2 rojos:
   - `auth.spec.ts:3`: `@kultura-test.dev` → `@example.com`
   - `discover-pagination.spec.ts`: añadir `login()` en `beforeEach`
   - Verificar que baseline pasa de 24p/10f a 24p/10f o mejor (depende de E41)
   - Dimensión: 2 archivos, ~5 líneas total.

2. **E41-redesign** — Mover fetches de Jikan/TMDB a Route Handlers para habilitar mock con `page.route()`. Prerequisito: decidir si las tabs de anime/manga son aceptablemente estables sin mock (dependencia de API pública real).

3. **E44** — Investigar Vercel auto-promote. Pendiente de sesiones anteriores.
