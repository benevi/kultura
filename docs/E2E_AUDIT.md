# E2E_AUDIT — B3.5h-AUDIT-E2E-1

**Fecha:** 2026-05-13  
**Commit auditado:** `e94ee1f` (deploy `6n13qXoVB`)  
**Auditor:** Claude Sonnet 4.6 (solo lectura — sin cambios en specs)  
**Bloque anterior:** B3.5g (RLS audit cerrado)

---

## 1. Resumen ejecutivo

| Métrica | Valor |
|---------|-------|
| Specs totales auditados | 6 |
| Tests totales | 17 |
| 🟢 Sanos | 2 specs / 8 tests |
| 🟡 Sospechosos | 3 specs / 7 tests |
| 🔴 Falsos verdes / asserts no alcanzables | 1 spec / 2 tests |
| ⚪ Ilegibles | 0 |

**Porcentajes sobre specs:**
- 🟢 33 % (2/6)
- 🟡 50 % (3/6)
- 🔴 17 % (1/6)
- ⚪ 0 %

> **Nota metodológica:** "Tests" = declaraciones `test(...)` en código fuente, contadas con `rg "^\s*test\(" tests/e2e --type ts -c`. No son corridas (cada declaración se ejecuta ×2 plataformas: chromium + Mobile Chrome, totalizando 34 corridas). Los conteos en este documento son siempre de **declaraciones**, no de corridas.

### Hallazgos críticos top 3

1. **E40 confirmado** — `auth.spec.ts` test 9 ("successful registration flow") es agnóstico al entorno: el assert acepta cualquiera de tres ramas (`/Revisa tu correo/`, `/correo/`, heading de app), lo que hace que el test sea verde tanto contra `kultura-test` como contra producción. No verifica sesión real creada.

2. **E39 confirmado** — `playwright.config.ts` usa `reuseExistingServer: !process.env.CI`. Si hay un dev server manual en `:3000` cargando `.env.local` (que apunta a producción), Playwright lo reutiliza sin aplicar los overrides de `.env.test.local`. Los tests correrían contra el proyecto Supabase de producción sin ninguna advertencia.

3. **E26 confirmado y sin resolver** — `chat-send.spec.ts:27` usa `page.locator('button').filter({ hasText: /\w+/ }).first()` para seleccionar un "amigo". El regex `/\w+/` coincide con cualquier botón que tenga texto alfanumérico, incluyendo botones de navegación, headers, y acciones del sistema. Sin anclar a contexto DOM la selección es indeterminada.

---

## 2. Tabla resumen por archivo

| Archivo | Plataformas | N° tests | Veredicto agregado | Notas |
|---------|-------------|----------|--------------------|-------|
| `auth.spec.ts` | Desktop Chrome + Mobile | 9 | 🟡 | 7 sanos, 1 🔴 (test 9), 1 🟡 (test 4) |
| `b3_5e_safety_net/_helpers.ts` | — | utilidad | 🟢 | Helper limpio, sin asserts |
| `b3_5e_safety_net/chat-send.spec.ts` | Desktop + Mobile | 1 | 🔴 | Selector E26 sin resolver |
| `b3_5e_safety_net/discover-pagination.spec.ts` | Desktop + Mobile | 4 | 🟡 | Aserción control condicional, flakiness externa (Jikan API) |
| `b3_5e_safety_net/group-feed-post.spec.ts` | Desktop + Mobile | 1 | 🟢 | Bien acotado, skip si sin creds |
| `b3_5e_safety_net/language-switch.spec.ts` | Desktop + Mobile | 1 | 🟡 | Selector switcher frágil (fallback a texto `^ES$`) |
| `b3_5e_safety_net/notifications-render.spec.ts` | Desktop + Mobile | 1 | 🟡 | Precondición implícita: user debe tener notifs en DB |

---

## 3. Lista detallada por veredicto

### 🔴 Rojo — Falsos verdes o asserts no alcanzables

| ID | Archivo:línea | Descripción | Recomendación |
|----|--------------|-------------|---------------|
| E26 | `chat-send.spec.ts:27` | `page.locator('button').filter({ hasText: /\w+/ }).first()` — cualquier botón con texto alfanumérico. Sin contexto DOM, indeterminado. | Reemplazar con `data-testid` o `getByRole('button', { name: /nombreAmigo/ })` dentro del modal de picker. |
| E40a | `auth.spec.ts:81-87` | Test "successful registration" acepta 3 ramas OR (email confirm msg ∨ texto genérico `/correo/` ∨ heading de app). La rama `/correo/i` coincide con texto estático del formulario incluso sin enviar. Verde en cualquier entorno. | Colapsar a assert único: `toHaveURL(/\/(es\|en)\/(home\|library)/)` si hay auto-login, o `getByText(/Revisa tu correo/i)` si hay confirm-email. No OR. |

### 🟡 Amarillo — Sospechoso / debilidad estructural

| ID | Archivo:línea | Descripción | Recomendación |
|----|--------------|-------------|---------------|
| E39 | `playwright.config.ts:50` | `reuseExistingServer: !process.env.CI` permite reutilizar server dev manual que puede apuntar a producción. | Ver Deep-dive 2 — opciones a/b/c. |
| E40b | `auth.spec.ts:49-53` | Test "login with invalid credentials" usa `text=/incorrecto\|inválido\|error/i`. Si la app muestra cualquier texto con "error" (incluso en otro contexto), pasa. | Acotar selector al contenedor del formulario: `page.locator('form').getByText(...)`. |
| — | `discover-pagination.spec.ts:57-67` | Test "paginación anime" tiene bloque `if (!paginationExists) { expect(paginationExists).toBeTruthy() }` — falla correctamente, pero la lógica condicional oscurece el flujo. No es falso verde pero sí confuso. | Eliminar el if; dejar `await expect(nextBtn).toBeVisible()` directo. |
| — | `language-switch.spec.ts:32-33` | Fallback `page.locator('button').filter({ hasText: /^ES$/ })` — si el switcher cambia de label (ej. muestra bandera o `ES/EN`), el selector cae silenciosamente al siguiente `.first()`. | Añadir `data-testid="language-switcher"`. |
| — | `notifications-render.spec.ts:37-52` | Precondición implícita no verificable desde el test: "el usuario debe tener al menos 1 notificación en DB". Si no la tiene, el segundo `expect(hasItems).toBeTruthy()` falla con mensaje confuso. | Documentar precondición en fixture de seed, o crear notificación en global-setup. |

### 🟢 Verde — Sanos

| Archivo | Tests sanos | Justificación |
|---------|-------------|---------------|
| `auth.spec.ts` | tests 1-3, 5-8 (7 tests) | Selectores por `getByRole`, `getByLabel`, texto específico de UI. Flujos reales de formulario. |
| `_helpers.ts` | utilidad | `login()` usa selectores por label + `waitForURL` con regex estricta. Sin ambigüedad. |
| `group-feed-post.spec.ts` | test 1 | Skip explícito sin creds, selector `textarea.first()` acotado a contexto grupo, assert exacto del texto enviado. |

---

## 4. Deep-dive 1 — `auth.spec.ts` (caso E40)

### 4.1 Tabla resumen

| # | test_name | flujo | requiere_sesion | agnostico | veredicto |
|---|-----------|-------|----------------|-----------|-----------|
| 1 | landing page loads and CTAs visible | Navega `/es`, verifica heading y links | No | Sí — legítimo | 🟢 agnóstico legítimo |
| 2 | login page renders both tabs and form fields | Navega `/es/login`, verifica inputs | No | Sí — legítimo | 🟢 agnóstico legítimo |
| 3 | register tab switches correctly | Navega `/es/login?mode=register`, click tab, verifica field | No | Sí — legítimo | 🟢 agnóstico legítimo |
| 4 | login with invalid credentials shows error | Submit form con credenciales falsas, espera texto de error | No | Parcialmente | 🟡 selector débil |
| 5 | register with mismatched passwords shows error | Submit con passwords distintos, espera mensaje | No | Sí — legítimo | 🟢 agnóstico legítimo |
| 6 | register with short password shows error | Submit con password corto, espera mensaje | No | Sí — legítimo | 🟢 agnóstico legítimo |
| 7 | forgot password link shows reset form | Click botón "Olvidaste", verifica botón nuevo | No | Sí — legítimo | 🟢 agnóstico legítimo |
| 8 | unauthenticated access to library redirects | Navega `/es/library`, espera redirect a `/login` | No | Sí — legítimo | 🟢 agnóstico legítimo |
| 9 | successful registration flow | Submit registro real, espera mensaje OR heading | Sí (crea sesión real) | **No debería** — E40 🔴 | 🔴 falso verde |

---

### 4.2 Sub-secciones por test

#### Test 1 — "landing page loads and CTAs visible"

```typescript
await expect(page.getByRole("heading", { name: /Descubre, registra/ })).toBeVisible();
await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
await expect(page.getByRole("link", { name: "Registrarse" })).toBeVisible();
```

El assert verifica heading de landing y dos CTAs por role+name. Estos elementos son estáticos: existen en el HTML generado por el servidor independientemente del estado de autenticación o del entorno Supabase conectado. El resultado sería idéntico contra `kultura-test` y contra producción, porque no consulta DB. **Agnóstico legítimo** — la UI pública es lo que se testea.

---

#### Test 2 — "login page renders both tabs and form fields"

```typescript
await expect(tabLogin(page)).toBeVisible();
await expect(tabRegister(page)).toBeVisible();
await expect(page.getByLabel("Correo electrónico")).toBeVisible();
await expect(page.getByLabel("Contraseña")).toBeVisible();
```

Verifica que los elementos del formulario de login existen en el DOM. No interactúa con Supabase, no envía credenciales. Los selectores son estables (`getByLabel` por texto visible). Resultado idéntico en cualquier entorno. **Agnóstico legítimo.**

---

#### Test 3 — "register tab switches correctly and shows confirm password"

```typescript
await tabRegister(page).click();
await expect(page.getByLabel("Confirmar contraseña")).toBeVisible();
```

Simula click en la pestaña de registro y verifica que aparece el campo adicional. Interacción puramente client-side con estado UI (React). No toca red ni Supabase. **Agnóstico legítimo.**

---

#### Test 4 — "login with invalid credentials shows error"

```typescript
await page.getByLabel("Correo electrónico").fill("nobody@nowhere.com");
await page.getByLabel("Contraseña").fill("wrongpassword");
await page.locator("form button[type=submit]").click();
await expect(page.locator("text=/incorrecto|inválido|error/i")).toBeVisible({ timeout: 10000 });
```

El assert usa `text=/incorrecto|inválido|error/i` sobre toda la página (no acotado al formulario). El regex incluye `error` que podría coincidir con cualquier elemento de error preexistente en el DOM (ej. un toast de red, un mensaje de validación de campo vacío, o incluso texto en un placeholder). Sin embargo, en la práctica el test llama a Supabase con credenciales inválidas y espera la respuesta del servidor — sí requiere una llamada de red real. Contra producción vs. `kultura-test` el comportamiento es el mismo (ambos rechazan credenciales inexistentes). **Sospecha leve**: el selector no está acotado al form. No es falso verde por estructura, sino potencialmente flaky si hay otros textos "error" en DOM. **🟡**

---

#### Test 5 — "register with mismatched passwords shows error"

```typescript
await page.getByLabel("Correo electrónico").fill(TEST_EMAIL);
await page.locator("#password").fill("Test1234!");
await page.locator("#confirmPassword").fill("Different1!");
await page.locator("form button[type=submit]").click();
await expect(page.locator("text=/contraseñas no coinciden/i")).toBeVisible({ timeout: 5000 });
```

Validación client-side pura: el frontend compara `password !== confirmPassword` antes de enviar a Supabase. El mensaje "contraseñas no coinciden" es generado por el componente React. No depende de estado DB. Idéntico en cualquier entorno. **Agnóstico legítimo. 🟢**

---

#### Test 6 — "register with short password shows error"

```typescript
await page.locator("#password").fill("abc");
await page.locator("#confirmPassword").fill("abc");
await page.locator("form button[type=submit]").click();
await expect(page.locator("text=/al menos 8/i")).toBeVisible({ timeout: 5000 });
```

Validación client-side de longitud mínima. Mensaje hardcodeado en el componente. Sin dependencia de Supabase. **Agnóstico legítimo. 🟢**

---

#### Test 7 — "forgot password link shows reset form"

```typescript
await page.getByRole("button", { name: /Olvidaste/ }).click();
await expect(page.getByRole("button", { name: /Enviar enlace/ })).toBeVisible();
```

Interacción UI: click en link "Olvidaste tu contraseña" muestra un formulario de reset. El assert verifica la presencia del botón de envío. El formulario se renderiza client-side. No llama a Supabase hasta que el usuario ingresa email y envía. **Agnóstico legítimo. 🟢**

---

#### Test 8 — "unauthenticated access to library redirects to login"

```typescript
await page.goto(`${BASE}/es/library`);
await expect(page).toHaveURL(/\/login/);
```

Verifica que la middleware/ruta protegida redirige a login cuando no hay sesión. Este comportamiento es del middleware Next.js (server-side, antes de Supabase). Consistente en cualquier entorno. **Agnóstico legítimo. 🟢**

---

#### Test 9 — "successful registration flow" — 🔴 E40 CONFIRMADO

```typescript
await page.getByLabel("Correo electrónico").fill(TEST_EMAIL);
await page.locator("#password").fill(TEST_PASSWORD);
await page.locator("#confirmPassword").fill(TEST_PASSWORD);
await page.locator("form button[type=submit]").click();
// Supabase email confirm → shows "Revisa tu correo" message
// OR auto-login → redirects away from /login
await expect(
  page.locator("text=/Revisa tu correo/i").or(
    page.locator("text=/correo/i")
  ).or(
    page.getByRole("heading", { name: /Descubrir|Mi biblioteca|Inicio/i })
  )
).toBeVisible({ timeout: 12000 });
```

**¿Qué hace el assert exactamente?**  
Espera que CUALQUIERA de tres locators sea visible:
- `text=/Revisa tu correo/i` — mensaje de confirmación post-registro
- `text=/correo/i` — cualquier texto que contenga la palabra "correo" (el propio label del campo email lo contiene)
- heading con nombre `Descubrir|Mi biblioteca|Inicio` — pantalla post-login

**¿Daría el mismo resultado en `kultura-test` vs. producción?**  
Sí — y eso es el problema. La rama `text=/correo/i` coincide con el label del input `Correo electrónico` que está en el DOM del formulario en todo momento, incluso antes de hacer submit. Si Supabase rechaza el registro (proyecto equivocado, rate limit, error de red), el formulario permanece visible con ese label, y el assert pasa de todas formas porque `text=/correo/i` está presente en el DOM estático.

**Contra producción**: el email `test_<timestamp>@kultura-test.dev` llegaría a la base de producción. En algunos casos Supabase devuelve error por dominio bloqueado o por configuración del proyecto — igualmente el test pasaría por la rama `/correo/i`. **El test nunca puede fallar** si el formulario de login permanece visible, lo cual lo hace agnóstico cuando NO debería serlo.

**Gravedad**: 🔴 — es un false positive estructural. No detecta si el registro funcionó o falló.

---

## 5. Deep-dive 2 — `playwright.config.ts` (caso E39)

### 5.1 Documentación línea por línea

```typescript
import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import * as fs from "fs";
import * as path from "path";
```
Imports estándar. `@next/env` carga `.env.local` al proceso de Playwright, haciendo disponibles las variables en `process.env` durante la configuración.

```typescript
loadEnvConfig(process.cwd());
```
Carga `.env.local` (la base). Esto incluye las credenciales de producción (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) y las credenciales del usuario de prueba (`TEST_USER_EMAIL`, `TEST_USER_PASSWORD`).

```typescript
const testEnvPath = path.resolve(process.cwd(), ".env.test.local");
const testEnvOverrides: Record<string, string> = {};
if (fs.existsSync(testEnvPath)) {
  for (const line of fs.readFileSync(testEnvPath, "utf-8").split("\n")) {
    // ...parse KEY=VALUE...
    testEnvOverrides[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
}
```
Lee `.env.test.local` si existe y construye un diccionario de overrides. Contiene los valores de Supabase del proyecto `kultura-test`. Esto sobreescribirá las vars de producción en el webServer.

```typescript
export default defineConfig({
  testDir: "./tests/e2e",        // directorio de specs
  fullyParallel: false,          // sin paralelismo entre specs
  forbidOnly: !!process.env.CI,  // falla si hay test.only en CI
  retries: process.env.CI ? 2 : 0, // 2 reintentos en CI, 0 local
  workers: 1,                    // un worker (secuencial)
  reporter: "html",              // reporte HTML
  use: {
    baseURL: "http://localhost:3000",  // URL base para todos los tests
    trace: "on-first-retry",          // traza solo en primer reintento
  },
```

`baseURL` hardcodeado a `:3000`. No hay override por entorno.

```typescript
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
```

Dos proyectos de dispositivo. Todos los specs se ejecutan en ambos, doblando el tiempo de ejecución.

```typescript
  webServer: {
    command: "npm run dev",            // arranca `next dev`
    url: "http://localhost:3000",      // URL que Playwright espera que esté disponible
    reuseExistingServer: !process.env.CI,  // ← CASO E39
    env: {
      ...(process.env as Record<string, string>),  // todas las vars del proceso
      ...testEnvOverrides,             // sobreescribe con vars de kultura-test
    },
  },
```

El campo `env` combina correctamente las variables base con los overrides de test — **si el webServer se inicia**. El problema está en `reuseExistingServer`.

### 5.2 Mecánica del bypass (caso E39)

```
INICIO: npx playwright test (en local, CI=undefined)

  reuseExistingServer = !process.env.CI = !undefined = true

  Playwright hace GET http://localhost:3000
    ├── RESPONDE (server externo ya en :3000)
    │     └── Playwright REUTILIZA ese server
    │           └── NO ejecuta `npm run dev`
    │           └── NO aplica `webServer.env`
    │           └── El server usa SU PROPIO .env (puede ser .env.local → producción)
    │           └── ⚠ Tests corren contra Supabase de PRODUCCIÓN
    │
    └── NO RESPONDE (no hay server externo)
          └── Playwright ejecuta `npm run dev` con webServer.env
                └── testEnvOverrides sobreescribe Supabase → kultura-test ✓
```

**Resultado del bypass**: si el dev manual está activo, `testEnvOverrides` nunca llega al proceso del servidor. El servidor usa las vars de su propio entorno de arranque, que típicamente es `.env.local` apuntando a producción. Los tests de la safety net escriben datos reales en producción (`chat-send`, `group-feed-post`).

### 5.3 Tres opciones de fix

#### Opción (a) — Forzar `reuseExistingServer: false` siempre

**Pros:**
- Fix de una línea, fácil de entender.
- Garantiza que Playwright siempre inicia su propio servidor con `webServer.env` correcto.
- Elimina cualquier posibilidad de contaminación por servidor externo.
- Comportamiento idéntico local y CI — no hay bifurcación lógica.
- Sin dependencias de infraestructura adicional.

**Cons:**
- Cada ejecución de `playwright test` arranca un server nuevo, incluso si el dev ya estaba corriendo (mayor tiempo de inicio, ~10-20s).
- El desarrollador pierde la conveniencia de reutilizar el server caliente.
- Si el dev server externo ocupa el puerto :3000, el arranque del webServer falla (conflicto de puerto). Requiere cerrar el dev manual antes de ejecutar tests.
- No distingue entre "dev intencional en :3000" y "proceso zombie" que ocupa el puerto.

---

#### Opción (b) — Cambiar el puerto del webServer a `:3001`

**Pros:**
- Separación física entre el dev manual (`:3000`) y el servidor de test (`:3001`).
- El dev puede seguir corriendo en :3000 sin interferir.
- No hay conflicto de puerto — Playwright siempre arranca su servidor en :3001 con las vars correctas.
- `baseURL` en `:3001` garantiza que todos los tests apuntan al servidor de prueba.
- Convivencia armoniosa: desarrollar en :3000 y correr tests en :3001 simultáneamente.

**Cons:**
- Requiere cambiar `baseURL`, `webServer.url`, y el comando de arranque (añadir `PORT=3001` o equivalente Next.js).
- Los helpers que hardcodean `http://localhost:3000` (como `BASE` en `_helpers.ts`) deben actualizarse.
- En CI también levantaría en :3001, lo cual es diferente al comportamiento actual — puede requerir ajustes en pipelines.
- Si Next.js no respeta `PORT=3001` por configuración del proyecto, se necesita verificar el mecanismo de override de puerto.
- Mayor diff de cambios (config + helpers + docs).

---

#### Opción (c) — Health-check pre-run que valide qué `.env` carga el server activo

**Pros:**
- No cambia el comportamiento de Playwright cuando las cosas están bien.
- Documenta explícitamente la precondición y falla con mensaje claro si no se cumple.
- Permite mantener `reuseExistingServer: true` para la conveniencia de desarrollo.
- Educativo: entrena al equipo a configurar el entorno antes de ejecutar tests.
- Global setup puede verificar que `NEXT_PUBLIC_SUPABASE_URL` del servidor activo contiene el identificador de `kultura-test`, no el de producción.

**Cons:**
- Requiere escribir un `globalSetup` que haga una request al servidor y compare la respuesta con algún endpoint que exponga el entorno (no hay uno hoy).
- La app Next.js no expone `NEXT_PUBLIC_SUPABASE_URL` via API pública — habría que añadir un endpoint de debug o inferir el entorno por otro medio (ej. un endpoint `/api/health` que devuelva el project-ref).
- Añade un endpoint solo para tests — posible vector si se deja en producción por error.
- Complejidad de mantenimiento: si la estructura de la respuesta del health-check cambia, el globalSetup falla con error confuso.
- No previene el problema, solo lo detecta. El desarrollador sigue teniendo que actuar (cerrar el server incorrecto y volver a correr tests).

---

### 5.4 Recomendación

**Opción (b) — Puerto separado `:3001` para Playwright.**

Es la única opción que elimina la clase de error en lugar de trabajar alrededor de ella. La opción (a) forza a cerrar el dev manual antes de cada ejecución de tests — fricción innecesaria que, en la práctica, llevará a desarrolladores a saltarse los tests. La opción (c) agrega complejidad sin resolver el problema de raíz: si el globalSetup detecta el entorno incorrecto, el desarrollador tiene que intervenir de todas formas.

La opción (b) tiene un mayor diff inicial, pero el diff es mecánico (buscar-reemplazar `:3000` → `:3001` en Playwright config y helpers). El resultado es un contrato claro: `:3000` es desarrollo humano, `:3001` es Playwright. Sin ambigüedad, sin riesgo de contaminación de producción.

---

## 6. Deep-dive 3 Parte A — `chat-send.spec.ts` (caso E26)

### Selector problemático — línea 27

```typescript
const friendButton = page.locator('button').filter({ hasText: /\w+/ }).first()
```

**Ubicación exacta:** `tests/e2e/b3_5e_safety_net/chat-send.spec.ts:27`

**Confirmación:** El selector sigue presente tal como se anotó en el backlog. No se ha resuelto desde la anotación previa (el commit auditado `e94ee1f` no modifica este archivo).

**Análisis del problema:**  
`page.locator('button')` selecciona TODOS los botones de la página. `.filter({ hasText: /\w+/ })` filtra los que tienen al menos un carácter alfanumérico — esto incluye prácticamente cualquier botón con texto (navegación, enviar, cerrar, etc.). `.first()` toma el primero en orden DOM. El orden DOM en un modal de selección de amigos puede variar según el estado del componente, el orden de renderizado de React, o el número de friends cargados.

**Lo que debería seleccionar:** el primer friend en el picker de "nueva conversación".

**Lo que puede seleccionar en realidad:** cualquier botón visible en el DOM en ese momento — el botón de volver atrás, un item de navegación del sidebar, o el primer friend. El test puede pasar o fallar de forma indeterminada dependiendo del DOM actual.

**Selector alternativo estable (descripción sin diff):**  
El picker de amigos debería tener un `data-testid="friend-picker-item"` en cada elemento de la lista. El selector sería:
```
page.getByTestId('friend-picker-item').first()
```
O, si el nombre del amigo es conocido desde el fixture:
```
page.getByRole('button', { name: TEST_FRIEND_NAME })
```
Si el picker está dentro de un dialog/modal, anclar primero:
```
page.getByRole('dialog').getByRole('button', { name: /\w+/ }).first()
```
Esta última opción limita el scope al dialog y es más robusta sin requerir cambios de `data-testid` en el componente.

---

## 7. Deep-dive 3 Parte B — Grep de vecinos (selectores frágiles)

### Resultados de búsqueda

#### `.filter(` — 3 ocurrencias

| Archivo:línea | Selector exacto | Evaluación |
|--------------|-----------------|------------|
| `chat-send.spec.ts:27` | `page.locator('button').filter({ hasText: /\w+/ }).first()` | 🔴 **Clarísimamente frágil** — regex universal, sin contexto DOM |
| `chat-send.spec.ts:49` | `page.locator('[role="alert"]').filter({ hasText: /error/i })` | 🟢 Legítimo — role semántico + texto específico, sin `.first()` |
| `language-switch.spec.ts:32` | `page.locator('button').filter({ hasText: /^ES$/ })` | 🟡 Sospechoso — `^ES$` es estricto pero sin anclar al componente del switcher; falla si hay otro botón con texto "ES" |

#### `.first()` — 8 ocurrencias

| Archivo:línea | Selector con .first() | Evaluación |
|--------------|----------------------|------------|
| `chat-send.spec.ts:24` | `page.getByRole('button', { name: /nueva conversación\|new conversation\|start.*chat/i }).first()` | 🟡 Sospechoso — `getByRole` con name específico es bueno, pero `.first()` implica que puede haber múltiples; debería ser único |
| `chat-send.spec.ts:27` | `page.locator('button').filter({ hasText: /\w+/ }).first()` | 🔴 **Clarísimamente frágil** — (mismo que arriba) |
| `chat-send.spec.ts:37` | `page.locator('input[type=text]').or(page.locator('textarea')).first()` | 🟡 Sospechoso — si hay múltiples inputs de texto en el DOM del chat, `.first()` puede seleccionar el incorrecto |
| `chat-send.spec.ts:41` | `page.getByRole('button', { name: /enviar\|send/i }).or(page.locator('button[aria-label*="end"]')).first()` | 🟡 Sospechoso — OR de dos locators diferentes + `.first()` hace el comportamiento impredecible |
| `discover-pagination.spec.ts:75` | `page.getByRole('button', { name: /siguiente\|next\|›\|»/i }).or(page.locator('button[aria-label*="next"]')).first()` | 🟡 Sospechoso — OR + `.first()`, misma clase que el anterior |
| `language-switch.spec.ts:33` | `.first()` en OR de dos locators del switcher | 🟡 Sospechoso — contexto: OR entre `button[aria-label*="Switch"]` y `button.filter(/^ES$/)` |
| `group-feed-post.spec.ts:28` | `page.locator('textarea').first()` | 🟢 Legítimo — en una página de grupo con un solo textarea de post, es predecible |
| `group-feed-post.spec.ts:36` | `page.getByRole('button', { name: /publicar\|publish\|enviar/i }).first()` | 🟢 Legítimo — nombre de acción específico; `.first()` es precaución razonable |

#### `locator('button')` — 2 ocurrencias

| Archivo:línea | Selector | Evaluación |
|--------------|----------|------------|
| `chat-send.spec.ts:27` | `page.locator('button').filter({ hasText: /\w+/ }).first()` | 🔴 **Clarísimamente frágil** — (ya catalogado) |
| `language-switch.spec.ts:32` | `page.locator('button').filter({ hasText: /^ES$/ })` | 🟡 Sospechoso — (ya catalogado) |

#### `locator("button")` — 0 ocurrencias

#### `page.locator('[a-z]+').` (tag simple) — 3 ocurrencias

| Archivo:línea | Selector | Evaluación |
|--------------|----------|------------|
| `chat-send.spec.ts:27` | `page.locator('button')` | 🔴 (ya catalogado) |
| `group-feed-post.spec.ts:28` | `page.locator('textarea').first()` | 🟢 (ya catalogado) |
| `language-switch.spec.ts:32` | `page.locator('button')` | 🟡 (ya catalogado) |

### Resumen de selectores frágiles por gravedad

| Gravedad | N° ocurrencias | Archivos afectados |
|----------|---------------|-------------------|
| 🔴 Clarísimamente frágil | 1 selector único (3 refs al mismo) | `chat-send.spec.ts` |
| 🟡 Sospechoso | 5 ocurrencias distintas | `chat-send.spec.ts`, `discover-pagination.spec.ts`, `language-switch.spec.ts` |
| 🟢 Legítimo | 4 ocurrencias | `chat-send.spec.ts` (alert), `group-feed-post.spec.ts` x2, `language-switch.spec.ts` aria-label |

**Patrón dominante:** El uso de `.first()` en combinación con selectores `.or()` compuesto es la mayor fuente de fragilidad. OR + .first() hace que el selector "gane" el primer elemento que coincida con CUALQUIERA de los dos ramas, cuyo orden en DOM es impredecible entre renders.

---

## 8. Plan de refactor B3.5h-AUDIT-E2E-2

| # | ID | Hallazgo | Archivo(s) afectados | Dependencias | Orden | Estado |
|---|----|---------|--------------------|-------------|-------|--------|
| 0 | E37 | Puerto hardcodeado en baseURL | `playwright.config.ts`, `_helpers.ts` | Ninguna | — | ✅ DONE |
| 1 | E39 | `reuseExistingServer` bypass a producción | `playwright.config.ts`, `_helpers.ts` | Ninguna (opción b requiere cambio de puerto) | 1 | ⬜ PENDING |
| 2 | E26 | Selector frágil `button.filter(/\w+/).first()` en chat-send | `chat-send.spec.ts:27` | Requiere `data-testid` en componente FriendPicker | 2 | ⬜ PENDING |
| 3 | E40 | Test "successful registration" acepta 3 ramas OR; falso verde | `auth.spec.ts:81-87` | Ninguna | 3 | ⬜ PENDING |
| 4 | E40b | Selector de error de login no acotado al form | `auth.spec.ts:49-53` | Ninguna | 4 | ⬜ PENDING |
| 5 | — | `.or() + .first()` en chat input, send button, pagination next | `chat-send.spec.ts:37,41`, `discover-pagination.spec.ts:75` | Puede requerir `data-testid` en componentes | 5 | ⬜ PENDING |
| 6 | — | Selector switcher sin `data-testid` | `language-switch.spec.ts:32-33` | Requiere `data-testid="language-switcher"` en `AuthHeader` | 5 | ⬜ PENDING |
| 7 | — | Precondición implícita en notifications (user debe tener notifs) | `notifications-render.spec.ts` | Requiere global-setup o fixture de seed | 6 | ⬜ PENDING |

**Orden recomendado:** E39 primero (elimina riesgo de escritura en producción), E26 segundo (selector más frágil), E40 tercero (corrección de falso verde). Items 5-7 son mejoras de robustez sin urgencia crítica.

---

## 9. Decisiones y notas

### 9.1 Criterios dudosos

**notifications-render.spec.ts**: el segundo `expect(hasItems).toBeTruthy()` solo falla si el usuario de prueba tiene notificaciones en DB pero la página no las muestra. Si el usuario no tiene notificaciones, el test falla con un mensaje sobre "posible bug" cuando en realidad la precondición no está cumplida. Clasificado como 🟡 por precondición implícita, no como 🔴 porque el fallo indicaría un problema real si la precondición está cumplida.

**discover-pagination.spec.ts**: los tests dependen de la API externa de Jikan (anime/manga). Si Jikan está caído o rate-limita, los tests fallan sin que haya un bug en Kultura. Clasificado como 🟡 por flakiness externa. No es responsabilidad del spec, sino de la arquitectura de tests (debería mockearse Jikan para tests E2E deterministas).

### 9.2 Suposiciones

1. El archivo `tests/setup.ts` es setup de Vitest (unit tests), no de Playwright. Excluido del alcance.
2. No hay `global-setup.ts` ni fixtures de Playwright custom. Si existieran en una ubicación no estándar, quedarían fuera de esta auditoría.
3. El `BASE = ""` en `auth.spec.ts` (línea 4) combinado con `baseURL: "http://localhost:3000"` en la config resulta en URLs como `http://localhost:3000/es`. La variable `BASE` es redundante (podría eliminarse), pero no constituye un defecto funcional.
4. `TEST_EMAIL = \`test_${Date.now()}@kultura-test.dev\`` en `auth.spec.ts` genera un email único por ejecución. Contra producción, esto crearía usuarios reales en la DB. Contra `kultura-test`, es el comportamiento esperado. Sin embargo, hay un riesgo: si `reuseExistingServer` activa el server de producción (E39), el test 9 podría crear usuarios en producción.

### 9.3 Propuestas de nuevos IDs de BACKLOG (no añadir aún — solo propuesta)

- **E41**: Jikan API sin mock en tests E2E de discover — flakiness externa no documentada. Proponer mock de Jikan en `global-setup` o `msw`.
- **E42**: `BASE = ""` redundante en `auth.spec.ts` — variable declarada pero vacía; confunde cuando se lee sin conocer la `baseURL` de config. Cleanup menor.
- **E43**: OR + `.first()` como antipatrón sistémico en safety-net specs — 5 ocurrencias en 3 archivos. Candidato a lint rule (`no-or-first` custom Playwright linter) para prevenir regresión.

---

## 10. Apéndice A — Estructura `tests/e2e/`

```
tests/e2e/
├── auth.spec.ts                                    (92 líneas, 9 tests)
└── b3_5e_safety_net/
    ├── _helpers.ts                                 (37 líneas, utilidad)
    ├── chat-send.spec.ts                           (52 líneas, 1 test)
    ├── discover-pagination.spec.ts                 (113 líneas, 4 tests)
    ├── group-feed-post.spec.ts                     (43 líneas, 1 test)
    ├── language-switch.spec.ts                     (45 líneas, 1 test)
    └── notifications-render.spec.ts                (72 líneas, 1 test)

Total: 6 spec files + 1 helper = 7 archivos
Total tests: 17
Total líneas de test code: ~454
```

**No hay:**
- `global-setup.ts`
- `fixtures/` directory
- `page-objects/` directory
- `msw/` o mocks de red

---

## 11. Apéndice B — Snapshot de `playwright.config.ts`

```typescript
import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import * as fs from "fs";
import * as path from "path";

// Cargar .env.local (base) para que TEST_USER_* lleguen al proceso de Playwright
loadEnvConfig(process.cwd());

// Leer .env.test.local y mergear: sobreescribe NEXT_PUBLIC_SUPABASE_* con
// los valores de kultura-test, para que el dev server arranque contra el
// proyecto de test (no producción). Las demás vars se heredan de .env.local.
const testEnvPath = path.resolve(process.cwd(), ".env.test.local");
const testEnvOverrides: Record<string, string> = {};
if (fs.existsSync(testEnvPath)) {
  for (const line of fs.readFileSync(testEnvPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    testEnvOverrides[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ...(process.env as Record<string, string>),
      ...testEnvOverrides,
    },
  },
});
```

**Snapshot tomado en commit:** `e94ee1f` — 2026-05-13
