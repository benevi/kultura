# Análisis completo — Fase 1 KULTURA

**Fecha:** 2026-04-12
**Revisado:** 2026-04-12 (dictamen técnico incorporado)
**Estado:** CERRADA ✅ — Fase 2 iniciada
**Tareas:** 1.1 – 1.9 (9/9)
**Tests:** 81 pasando, 0 failures
**Build:** limpio

---

## Resumen ejecutivo

9 tareas completadas, 29 archivos de producción, 17 archivos de test, 81 tests pasando, build limpio. La base técnica es sólida. Hay algunas decisiones de implementación que conviene documentar antes de entrar en Fase 2.

---

## 1. Infraestructura y configuración (1.1)

**Correcto:** `next.config.mjs` en formato ESM correcto. La decisión de usar `.mjs` en vez de `.ts` (DEC-002) evita un bug real de Next.js 14 con TypeScript config. `tailwind.config.ts` define un sistema de diseño propio con tokens semánticos (`bg`, `surface`, `surface2`, `border`, `accent`, `text`, `muted`). Fuentes de Google cargadas con variables CSS y `display: swap` — correcto para rendimiento.

**A revisar:** `MediaCard.tsx` importa `{ ImageIcon }` de `lucide-react`. Es la **única dependencia externa de iconos** en todo el codebase — la landing usa SVGs inline de Heroicons. Crea inconsistencia que hay que resolver en Fase 2.

---

## 2. Base de datos y RLS (1.2)

**Correcto:** La migración es el archivo más sofisticado de la Fase 1. 10 tablas con constraints SQL apropiados, RLS con políticas granulares por operación y por actor, trigger `handle_new_user()` con `security definer` que evita la race condition de crear el perfil desde el cliente, y DEC-008 reflejado en SQL con `media_type check` en `lists`.

**Riesgo 1 — subqueries en `list_items` RLS:** Las políticas hacen subqueries en cada operación (`select owner_id from lists where id = list_id`). Con volumen alto puede ser lento — corregible con índices en Fase 6.

**Riesgo 2 — fallo silencioso del trigger:** Con `security definer`, si `handle_new_user()` falla, el usuario quedará registrado en `auth.users` pero sin perfil en la tabla `users`. Estado inconsistente difícil de detectar: el usuario existe en Auth pero no puede operar en la app. No hay mecanismo de recuperación ni logging explícito. → Corregido en SPEC-010.

---

## 3. Clientes Supabase y middleware (1.3)

**Correcto:** La composición middleware está resuelta correctamente:

```text
Supabase getUser() → acumular cookies → intlMiddleware → aplicar cookies a respuesta
```

El patrón de `pendingCookies[]` compatibiliza `@supabase/ssr` con `next-intl` sin perder cookies de sesión. El uso de `getUser()` en vez de `getSession()` valida contra el servidor de Auth — una sesión revocada pasaría con `getSession()` (solo verifica firma JWT local) pero no con `getUser()`.

**El único `as any` justificado:** `response.cookies.set(name, value, options as any)` en `middleware.ts:40` — type mismatch entre `CookieSerializeOptions` de `@supabase/ssr` y `ResponseCookie` de `NextResponse`. Estructuralmente compatibles, el `eslint-disable` lo documenta. Único uso de `any` en todo el proyecto.

---

## 4. Tipos TypeScript (1.4)

**Correcto:** `MediaItem` con `id: "{type}_{externalId}"` elimina colisiones entre APIs. `metadata: Record<string, unknown>` es el único escape hatch permitido y está documentado. `Database` con `Row/Insert/Update` por tabla escrito a mano siguiendo el SQL. `episode_progress.season` es opcional correctamente — anime movies no tienen temporada.

**Bloqueante resuelto en SPEC-010 — `synopsis` ausente en BD:** `DbMedia` y la tabla `media` no tenían `synopsis`. Solo existía en `MediaItem` (respuesta de API) sin persistirse. Cada página de detalle necesitaría llamar a la API externa obligatoriamente. → Migración `002_add_synopsis.sql` en SPEC-010.

---

## 5. i18n (1.5)

**Correcto:** Paridad perfecta entre `es.json` y `en.json`, verificada por test automatizado en `tests/unit/i18n/messages.test.ts` — falla si se añade una key en un idioma sin añadirla en el otro. Namespace `errors` completo. `auth.resetLinkSent` y `auth.checkEmail` correctamente separados.

**Bug resuelto en SPEC-010:** `LoginPage.tsx:257` — texto hardcodeado `"Descubre tu cultura"`. → Corregido con key i18n.

---

## 6. Componentes UI base (1.6)

**Correcto:** `Button` implementa el patrón `asChild`. `StarRating` con radio buttons accesibles para screenreaders. `StatusSelector` y `Badge` son componentes puros. `Avatar` genera iniciales del nombre.

**Inconsistencia — librería de iconos:** `MediaCard` usa `lucide-react` (`ImageIcon`). El resto usa SVGs inline de Heroicons. → Decisión tomada en SPEC-010: estandarizar en `lucide-react`.

**Deuda — `avatar_initials` desync:** `avatar_initials` se calcula y persiste en la BD al registrarse via el trigger. Si en Fase N el usuario puede cambiar su username, `avatar_initials` quedará desincronizado sin un trigger de actualización. → Pendiente hasta Fase N donde se implemente edición de perfil.

---

## 7. Auth pages (1.7)

**Correcto:** Un único `LoginPage` maneja 3 modos (`login | register | reset`) via `?mode=`. `<Suspense>` en `page.tsx` requerido para `useSearchParams()` en App Router. Validación client-side antes de llamar a Supabase. `handleRegister` bifurca correctamente entre sesión directa y confirmación de email. `useEffect` de redirect usa `getSession()` correctamente en el cliente.

**Bug resuelto en SPEC-010:** `LoginPage.tsx:257` — texto hardcodeado. → Corregido.

**Riesgo medio resuelto en SPEC-010 — `window.location.origin` en reset password:** `handleReset` construía la `callbackUrl` con `window.location.origin`. En Vercel Preview Deployments devolvería la URL de la preview, rompiendo el callback en producción. → `NEXT_PUBLIC_SITE_URL` añadido en SPEC-010.

**Observación de bundle:** `LoginPage` es Client Component completo — incluye siempre la lógica de los 3 modos. Actualmente no es problema, pero si crece en Fase 2 (OAuth, captcha), evaluar split por modo o lazy loading.

---

## 8. Landing pública (1.8)

**Correcto:** Toda la landing es Server Components. `Header` llama a `getTranslations` en el servidor. Patrón `<Button asChild><Link>` bien aplicado. Iconos SVG inline de Heroicons sin dependencias adicionales.

**Trivial resuelto en SPEC-010:** `Footer` tenía `© 2026 KULTURA` hardcodeado. → `new Date().getFullYear()`.

---

## Cobertura de tests

| Área | Tests | Tipo |
| --- | --- | --- |
| i18n paridad | 1 (recursivo) | Unit |
| auth-errors mapping | 8 | Unit |
| Button | 6 | Unit |
| Avatar | 4 | Unit |
| StarRating | 5 | Unit |
| StatusSelector | 5 | Unit |
| MediaCard | 8 | Unit |
| MediaGrid | 5 | Unit |
| LoginPage (login form) | ~12 | Unit |
| LoginPage (register form) | ~12 | Unit |
| Header | 4 | Unit |
| Landing page | 7 | Unit |
| RLS policies | — | Integration* |
| Supabase clients | — | Integration* |
| Trigger auto-perfil | — | Integration* |

\* Tests de integración escritos y listos, bloqueados por `BLOQ-001` (`SUPABASE_TEST_URL` no configurado). El trigger `handle_new_user()` y las políticas RLS son la parte más crítica de seguridad — `BLOQ-001` es **deuda de alta prioridad**.

---

## Deuda técnica — estado al cierre de Fase 1

| Prioridad | Tema | Estado |
| --- | --- | --- |
| 🔴 Bloqueante | `synopsis` ausente en tabla `media` | ✅ Resuelto en SPEC-010 |
| 🔴 Alta (seguridad) | Rate limiting en Auth no documentado | ⏳ DEC pendiente antes de usuarios reales |
| 🔴 Alta (seguridad) | `BLOQ-001` tests de integración sin CI | ⏳ Pendiente — requiere proyecto Supabase real |
| 🟡 Media | `window.location.origin` en reset | ✅ Resuelto en SPEC-010 |
| 🟡 Media | Fallo silencioso del trigger | ✅ Resuelto en SPEC-010 |
| 🟡 Media | `avatar_initials` desync | ⏳ Pendiente hasta Fase de edición de perfil |
| 🟢 Baja | Librería de iconos inconsistente | ✅ Resuelto en SPEC-010 — estandarizado en `lucide-react` |
| 🟢 Baja | `list_items` RLS con subqueries | ⏳ Pendiente — índices en Fase 6 |
| 🟢 Baja | `LoginPage` bundle size | ⏳ Pendiente — evaluar si crece en Fase 2 |

---

## Veredicto

La Fase 1 es una base técnica correcta. El middleware está bien compuesto, la migración SQL es completa y segura, los tipos TypeScript son precisos, y el sistema de i18n tiene tests que garantizan paridad. Los bugs y deudas prioritarias están resueltos o en curso via SPEC-010.

**Fase 2 iniciada.**
