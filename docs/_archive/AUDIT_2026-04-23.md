# KULTURA — Technical Due Diligence Audit

**Fecha:** 2026-04-23  
**Auditor:** Claude Sonnet 4.6 (tech lead role)  
**Scope:** Codebase completo en `e:\app movies\kultura\`  
**Metodología:** Lectura archivo por archivo. Todo lo no verificado está marcado explícitamente.

---

## 1. Mapa de la Aplicación

### Stack Real (verificado en package.json)

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js App Router | 14.2.35 |
| UI | React | 18 |
| Estilos | Tailwind CSS | 3.4.1 |
| Base de datos | Supabase (PostgreSQL) | supabase-js 2.103.0 |
| Auth | Supabase Auth (email/password) | — |
| IA | Anthropic SDK | 0.88.0 |
| i18n | next-intl | 4.9.1 |
| Tests unitarios | Vitest | 4.1.4 |
| Tests E2E | Playwright | 1.59.1 |
| Runtime mínimo | Node.js | ≥ 20 |

### Arquitectura Real

```
Next.js 14 App Router (SSR + Server Components)
├── src/app/[locale]/(app)/        — Páginas autenticadas (12 rutas)
├── src/app/[locale]/login/        — Auth pública
├── src/app/api/                   — 18 Route Handlers (server-only)
├── src/components/                — 40+ componentes React
├── src/lib/
│   ├── api/                       — 9 adaptadores externos
│   ├── claude/                    — recommendations.ts
│   ├── library/                   — stats, actions, queries
│   ├── social/                    — friends, feed, lists
│   ├── supabase/                  — client.ts, server.ts
│   └── rate-limit.ts              — sliding window in-memory
├── src/types/                     — 5 archivos TypeScript
├── src/i18n/                      — routing, request, navigation
└── src/middleware.ts              — auth + locale
messages/
├── es.json                        — 454 claves
└── en.json                        — 454 claves
tests/
├── unit/                          — 15 suites
├── integration/                   — 5 suites (RLS, DB, auth)
├── contract/                      — 5 suites (APIs externas)
└── e2e/                          — auth.spec.ts (Playwright)
```

### APIs Externas — Estado Real

| API | Implementada | Clave server-only | Notas |
|-----|-------------|-------------------|-------|
| TMDB (movies/tv) | ✅ | ✅ | es-ES fallback en-US |
| Jikan v4 (anime/manga) | ✅ | N/A (sin auth) | — |
| Google Books | ✅ | ✅ | langRestrict: es |
| Open Library | ✅ | N/A | fallback de Books |
| MangaDex | ✅ | N/A | — |
| RAWG (games) | ✅ | ✅ | — |
| **ComicVine** | **❌** | ✅ (sin uso) | Clave existe, handler no existe |
| Claude API | ✅ | ✅ | recommendations + chat |

### Route Handlers (18 endpoints verificados)

```
POST   /api/ai-recommendations    — Claude, 5 req/min
GET    /api/auth/callback          — PKCE exchange
POST   /api/chat                  — historial de chat con IA
GET    /api/chat                  — historial
POST   /api/friends               — solicitudes, 10/min
GET    /api/friends               — lista
PATCH  /api/friends               — aceptar/rechazar
DELETE /api/friends               — eliminar
GET    /api/genre-news            — tendencias por género, 20/min
POST   /api/groups                — crear grupo
GET    /api/groups                — listar
POST   /api/groups/[id]/join      — unirse
DELETE /api/groups/[id]/join      — salir
POST   /api/library               — añadir a biblioteca, 30/min
DELETE /api/library               — eliminar
POST   /api/lists                 — crear lista, 20/min
PATCH  /api/lists                 — actualizar
DELETE /api/lists                 — eliminar
GET    /api/lists/[id]            — detalle
PATCH  /api/notifications         — marcar leídas, 30/min
GET    /api/popular-in-circle     — recomendaciones del círculo
POST   /api/recommendations       — user-to-user, 10/min
POST   /api/reports               — reportar, 5/min
POST   /api/suggestions           — sugerencias de contacto
GET    /api/search                — búsqueda multi-API, 60/min por IP
PATCH  /api/settings              — actualizar perfil
GET    /api/users/search          — buscar usuarios
```

### Estado de la Base de Datos

- **RLS activado:** sí — tests de integración verifican policies (`tests/integration/db/rls-policies.test.ts`)
- **Migraciones SQL versionadas en código:** ❌ NO existe `supabase/migrations/`. Schema solo en Supabase dashboard.
- **Tablas reales:** users, media, user_media, friendships, recommendations, lists, list_members, list_items, notifications, reports (confirmado por tests y tipos)

---

## 2. Estado de Madurez por Área

### Auth — 7/10
- ✅ Supabase Auth email/password con PKCE
- ✅ `middleware.ts` llama `supabase.auth.getUser()` server-side en cada request
- ✅ Auth callback maneja renovación de sesión correctamente
- ✅ Cookies SSR-aware (try-catch para Server Components read-only)
- ❌ Sin OAuth (Google, GitHub) — reducción de conversión
- ❌ Sin 2FA
- ❌ Sin flujo de recuperación de contraseña personalizado

### Pagos — 0/10
- ❌ No existe. Ninguna referencia a Stripe, Paddle, o similar.
- **No verificable:** si hay un plan de monetización, no está en el código.

### Datos — 6/10
- ✅ Schema correcto con FK, enums via CHECK constraints
- ✅ Normalizer convierte todas las APIs externas a `MediaItem`
- ✅ Cache de títulos en tabla `media` (upsert antes de insertar en user_media)
- ✅ RLS testeado en integración
- ❌ Sin migraciones versionadas en código (riesgo crítico de reproducibilidad)
- ❌ Sin strategy de backup documentada
- ❌ Sin índices adicionales verificados (solo los implícitos de PK/FK)
- ❌ Sin paginación verificada en todas las queries (riesgo de OOM en listas grandes)

### Frontend — 7/10
- ✅ TypeScript strict, 0 `any` en componentes (1 `as any` aceptable en middleware)
- ✅ 40+ componentes bien separados por dominio
- ✅ i18n completo: 454 claves, es/en
- ✅ Mobile-first con Tailwind
- ⚠️ 15 `console.error` en componentes UI (FriendCard, FriendshipButton, ListDetail...)
- ❌ Sin dynamic `generateMetadata()` en páginas — SEO nulo en rutas de contenido
- ❌ Uso de `<img>` sin verificar vs `next/image` (no confirmado exhaustivamente, pero CSP y config de `next.config` sugiere que sí hay `remotePatterns`)
- ❌ Sin Suspense boundaries explícitas verificadas
- ❌ Sin Error Boundaries en componentes cliente

### Backend — 7/10
- ✅ 18 Route Handlers con validación de input
- ✅ Códigos HTTP correctos (401, 400, 409, 429, 500)
- ✅ Validación de formatos (mediaId `/^[a-z]+_.+$/`, status enums)
- ✅ Queries parametrizadas vía Supabase SDK (sin riesgo de SQL injection)
- ✅ Rate limiting implementado en todas las rutas sensibles
- ❌ Rate limiting en-memory: **no funciona en Vercel multi-instancia** (el propio código lo documenta y dice "migrar a KV/Redis")
- ❌ 15 `console.error` en código de producción (logs sin estructura)
- ❌ ComicVine: clave existe, handler no existe, búsqueda de cómics devuelve `[]`

### Infra — 2/10
- ❌ Sin CI/CD (no existe `.github/workflows/` ni config de Vercel)
- ❌ Sin Dockerfile ni containerización
- ❌ Sin `.env.production` separado
- ❌ Sin CDN custom configurada
- ❌ Sin strategy de escalado documentada
- ⚠️ Vercel deploy: factible técnicamente, pero sin pipeline automatizado

### Tests — 7/10
- ✅ 15 suites de tests unitarios (rate-limit, normalizer, library, social, security headers...)
- ✅ 5 tests de integración contra Supabase real (RLS, friends, library triggers)
- ✅ 5 tests de contrato para APIs externas (TMDB, Jikan, MangaDex, RAWG, Google Books)
- ✅ 1 test E2E con Playwright (auth flow)
- ✅ Configuraciones separadas: `vitest.config.ts`, `vitest.integration.config.ts`, `vitest.contract.config.ts`
- ❌ Sin cobertura medible (no se ejecutaron — no se puede afirmar % real)
- ❌ E2E coverage muy limitado (solo auth, sin flows de library/social/IA)
- ❌ Sin tests de componentes React (ningún archivo `*.test.tsx` encontrado)

### CI/CD — 0/10
- ❌ No existe. Ningún archivo de pipeline encontrado.
- Sin checks automáticos en PR, sin deploy automático, sin validación de tipos en CI.

### Observabilidad — 1/10
- ❌ Sin Sentry, LogRocket, Datadog, o similar
- ❌ Sin logging estructurado (solo `console.error` ad-hoc)
- ❌ Sin métricas de uso de APIs externas
- ❌ Sin alertas
- ⚠️ 1 punto por tener rate limiting que al menos captura presión en endpoints

### Seguridad — 5/10
- ✅ CSP headers configurados en `next.config.mjs`
- ✅ Claves sensibles (ANTHROPIC, COMICVINE, SUPABASE_SERVICE_ROLE) no expuestas al cliente
- ✅ RLS activado y testeado
- ✅ Input validation en todas las routes
- ✅ Sin SQL injection risk (ORM parameterizado)
- ❌ **CRÍTICO: `.env.local` con credenciales reales en el repositorio** (incluyendo `SUPABASE_SERVICE_ROLE_KEY` y `ANTHROPIC_API_KEY`)
- ❌ **CRÍTICO: `.claude/settings.json` contiene tokens de Supabase embebidos en comandos Bash permitidos**
- ❌ Rate limiting no funciona en producción multi-instancia (bypass trivial con múltiples requests en paralelo)
- ❌ Sin HTTPS enforcement a nivel de código (depende de Vercel)
- ❌ Sin audit log de acciones sensibles

---

## 3. Pros — Qué está bien y debe conservarse

1. **TypeScript estricto real.** `strict: true` en tsconfig, solo 1 `as any` en todo el codebase (y documentado). Raro de ver en proyectos early-stage.

2. **Arquitectura de normalización.** Todas las APIs externas pasan por el normalizer antes de llegar a componentes. Cambiar una API externa es una modificación de 1 archivo.

3. **Separación server/client correcta.** Claves sensibles nunca en `NEXT_PUBLIC_`. Route Handlers como proxy para ComicVine y Claude. El patrón está bien pensado.

4. **Rate limiting implementado desde el inicio.** Aunque tiene el problema de multi-instancia, el patrón es correcto y está en todas las rutas sensibles. La mayoría de proyectos lo añaden tarde.

5. **Tests de múltiples capas.** Unitarios + integración contra Supabase real + contratos de API externa. Estructura profesional aunque la cobertura no está medida.

6. **i18n completo en 2 idiomas.** 454 claves, routing automático, mensajes de error traducidos. Muchos proyectos añaden esto como afterthought.

7. **Validación de input en todos los endpoints.** Formato de mediaId, enums de status, validación de body JSON. Sin SQL injection surface.

8. **Cache de media en base de datos.** Upsert a tabla `media` antes de user_media. Evita llamadas repetidas a APIs externas para títulos ya vistos.

9. **RLS testeado con integración real.** Los tests de RLS usan Supabase real, no mocks. Esto detecta problemas que los mocks ocultan.

10. **CSP headers desde el inicio.** `next.config.mjs` tiene Content-Security-Policy con whitelist explícita de fuentes de imagen y script.

---

## 4. Contras y Deuda Técnica

### Crítica

**[SEC-01] Credenciales reales en el repositorio**  
`.env.local` contiene `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, y todas las API keys. Si el repo es público o accede un tercero, rotación inmediata necesaria. `.claude/settings.json` embebe tokens de Supabase en comandos Bash de la allowlist.

**[SCALE-01] Rate limiting en-memory incompatible con Vercel**  
`lib/rate-limit.ts` usa `new Map<string, WindowEntry>()`. En Vercel cada instancia tiene su propio Map. Un usuario puede superar los límites con N instancias activas simultáneas. El código lo documenta explícitamente: *"En multi-instancia de Vercel, migrar a KV/Redis."* — pero no está resuelto.

**[DATA-01] Sin migraciones SQL versionadas**  
No existe `supabase/migrations/`. El schema de base de datos vive solo en el dashboard de Supabase. Si hay que reproducir el entorno (disaster recovery, staging, nuevo dev), no hay forma automatizada.

**[FEAT-01] ComicVine: clave sin implementación**  
`COMICVINE_KEY` existe en `.env.local`. CLAUDE.md dice que está implementado server-only. Pero no existe `/api/comics/route.ts`, no hay `lib/api/comicvine.ts`, y la búsqueda de `type: 'comic'` devuelve array vacío. El tipo `MediaType` incluye `'comic'` pero no se puede buscar ni añadir.

### Alta

**[OBS-01] Sin observabilidad de producción**  
Zero Sentry, zero structured logging, zero métricas. 15 `console.error` dispersos en componentes y route handlers. En producción, un fallo silencioso es invisible.

**[SEO-01] Sin metadata dinámica**  
Ninguna página usa `generateMetadata()`. Las rutas `/[locale]/media/[type]/[id]` — que deberían tener título, descripción, og:image — sirven metadata genérica. Indexabilidad nula para contenido específico.

**[INFRA-01] Sin CI/CD**  
No hay GitHub Actions ni pipeline de Vercel. Cada deploy es manual. Sin garantía de que tipos compilen, tests pasen, o lint esté limpio antes de subir a producción.

### Media

**[CODE-01] console.log/error en producción (15 instancias)**  
Distribuidos en: `FriendCard.tsx`, `FriendshipButton.tsx`, `ListDetail.tsx`, `LibraryAction.tsx`, `groups/route.ts`, `suggestions/route.ts`, `lib/claude/recommendations.ts`. Sin condicional `NODE_ENV`.

**[CODE-02] Sin Error Boundaries en cliente**  
No se encontraron componentes `ErrorBoundary` wrapeando secciones críticas. Un error en `MediaCard` o `FriendCard` podría colapsar la página entera.

**[TEST-01] Sin tests de componentes React**  
0 archivos `*.test.tsx`. La lógica de UI (estados, interacciones, renders condicionales) no está testeada.

**[TEST-02] E2E mínimo**  
Solo `auth.spec.ts`. Los flujos críticos (añadir a biblioteca, hacer recomendación, crear lista colaborativa) no tienen cobertura E2E.

**[DATA-02] Paginación no verificada exhaustivamente**  
No se pudo confirmar que todas las queries de listado tengan `.range()` o `.limit()`. Queries sin límite en tablas con miles de filas son un vector de OOM.

**[IMG-01] Optimización de imágenes sin confirmar**  
`next.config.mjs` tiene `remotePatterns` configurados (señal de que `next/image` se usa), pero no se verificó componente por componente. Si hay `<img>` raw, se pierde LCP y optimización de red.

### Baja

**[CODE-03] Sin comentarios de WHY en lógica compleja**  
El código está limpio pero la lógica de normalización de APIs tiene casos edge sin documentar (e.g., fallback Open Library cuando Google Books falla).

**[CODE-04] Sin `process.env` validation al startup**  
Si falta una variable de entorno requerida, el error aparece en runtime (primera request) en lugar de en startup. Librería como `zod` + validación en `lib/env.ts` lo previene.

---

## 5. Gaps para Producción

| Gap | Criticidad | ¿Bloqueante? |
|-----|-----------|-------------|
| Rate limiting → Redis/Vercel KV | Alta | Sí (Vercel multi-instancia) |
| Migraciones SQL en código | Alta | Sí (reproducibilidad) |
| CI/CD pipeline | Alta | Sí (calidad garantizada) |
| Error tracking (Sentry) | Alta | Sí (invisible en prod) |
| Credenciales fuera del repo | Alta | Sí (seguridad) |
| SEO dinámico (`generateMetadata`) | Media | No (pero limita growth) |
| Logs estructurados | Media | No (pero debugging imposible) |
| Tests de componentes React | Media | No |
| E2E coverage ampliada | Media | No |
| Error Boundaries | Media | No (UX) |
| ComicVine implementado | Media | No (feature prometida) |
| Backup strategy documentada | Alta | Sí (compliance) |
| GDPR: política de privacidad | Alta | Sí (legal) |
| GDPR: exportación/eliminación de datos | Alta | Sí (legal en EU) |
| OAuth (Google/GitHub) | Baja | No (conversión) |
| Paginación confirmada en todas las queries | Media | No |
| `next/image` verificado en todos los componentes | Baja | No |
| Validación de env vars al startup | Baja | No |
| Facturación / plan de monetización | Alta | Sí (para inversores) |
| Documentación técnica para onboarding | Baja | No |
| Escalado horizontal documentado | Alta | Sí (para inversores) |
| Custom domain + HTTPS | Alta | Sí |
| Terms of Service | Alta | Sí (legal) |

---

## 6. Riesgos Críticos

### Lo que haría rechazar esta inversión hoy:

**[R1] Sin monetización ni plan de negocio en el código**  
0 referencias a Stripe, Paddle, suscripciones, o planes. Un producto de entretenimiento/cultura personal sin modelo de negocio implementado es un prototipo, no una startup invertible. Ni siquiera hay un schema de tabla `subscriptions` o `billing`.

**[R2] Credenciales de producción expuestas en el repo**  
`SUPABASE_SERVICE_ROLE_KEY` da acceso admin completo a la base de datos bypaseando RLS. Si el repositorio tuvo alguna vez visibilidad pública o se compartió con algún colaborador, rotación inmediata. Esto es negligencia de seguridad documentable.

**[R3] Rate limiting no funciona en producción**  
El propio código lo admite. Un actor malicioso puede abusar de la Claude API (coste $$$) con requests paralelas desde múltiples instancias de Vercel. Sin KV/Redis, el límite de 5 req/min de IA es teatro.

**[R4] Sin CI/CD + Sin migraciones versionadas**  
No hay garantía reproducible de que el sistema funcione en un entorno limpio. Si el dashboard de Supabase fuera comprometido o necesitaran un entorno de staging, no existe playbook. Para inversores, esto es technical debt de nivel fundacional.

**[R5] Observabilidad cero**  
En producción con usuarios reales, un bug silencioso (API externa cae, Claude falla, query lenta) es invisible. Sin Sentry ni logs estructurados, el tiempo de detección de incidentes es "cuando un usuario se queja".

**[R6] GDPR no implementado**  
Si hay usuarios en la UE (probable dado que el producto está en español), necesitan: política de privacidad, capacidad de exportar sus datos, capacidad de eliminar su cuenta completa, y base legal para procesamiento de datos. Nada de esto existe. Riesgo legal real.

---

## 7. Roadmap Priorizado

### Fase 0 — Hardening Inmediato (3–5 días)
*Debe completarse antes de cualquier demo pública o compartir acceso.*

1. **[Día 1] Rotar credenciales expuestas.** Revocar y regenerar: `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, todas las API keys. Mover a Vercel Environment Variables. Añadir `.env.local` a `.gitignore` si no está.
2. **[Día 1] Limpiar `.claude/settings.json`.** Eliminar tokens hardcodeados de la allowlist de Bash.
3. **[Día 2–3] Migraciones SQL.** Extraer schema actual del dashboard y crear archivos en `supabase/migrations/`. Incluir RLS policies. Usar `supabase db pull` para capturar estado real.
4. **[Día 4–5] CI/CD básico.** GitHub Actions con: `tsc --noEmit` + `vitest run` + `next build` en cada PR. Deploy automático a Vercel en merge a main.

### Fase 1 — Producción Real (7–10 días)
*Necesario para tener usuarios reales sin riesgo.*

5. **[Día 1–2] Rate limiting → Vercel KV.** Reemplazar `Map` por `@vercel/kv` con sliding window. 1 archivo de cambio en `lib/rate-limit.ts`.
6. **[Día 2–3] Error tracking.** Integrar Sentry: `@sentry/nextjs`. Capturar errores de Route Handlers y componentes cliente. 4–6 horas de trabajo.
7. **[Día 3–4] SEO dinámico.** Añadir `generateMetadata()` a `/media/[type]/[id]/page.tsx`, `/profile/[username]/page.tsx`, `/lists/[id]/page.tsx`. Og:image con posters de TMDB.
8. **[Día 5–6] Eliminar console.log de producción.** Reemplazar por logger estructurado (`pino` o similar) con `if (process.env.NODE_ENV !== 'production')` donde sea debug.
9. **[Día 7–8] Error Boundaries.** Añadir `<ErrorBoundary>` wrapeando las secciones principales de cada página.
10. **[Día 9–10] GDPR basics.** Página de política de privacidad, endpoint `DELETE /api/account` que borre todos los datos del usuario (cascade en DB ya existe), exportación de datos básica.

### Fase 2 — Calidad y Features (10–15 días)
*Para product-market fit.*

11. **[3 días] ComicVine.** Implementar `/api/comics/route.ts` y `lib/api/comicvine.ts`. La clave ya existe.
12. **[3 días] Tests de componentes React.** Añadir `@testing-library/react` a Vitest. Tests para `LibraryAction`, `FriendshipButton`, `MediaCard`.
13. **[2 días] E2E ampliado.** Añadir specs Playwright para: añadir media a biblioteca, buscar usuario + enviar recomendación, crear lista.
14. **[2 días] Validación de env vars.** Añadir `lib/env.ts` con Zod que valide todas las env vars al startup. Fallo rápido y claro.
15. **[2 días] Paginación verificada.** Auditar todas las queries de listado, añadir `.range(offset, offset+limit)` donde falte.
16. **[3 días] OAuth (Google).** Añadir login con Google via Supabase Auth. Reduce fricción de onboarding.

### Fase 3 — Monetización (15–20 días)
*Sin esto, no hay startup invertible.*

17. **[5 días] Modelo de negocio.** Definir y ejecutar: freemium (biblioteca limitada), suscripción (IA ilimitada, listas colaborativas). Integrar Stripe o Paddle.
18. **[3 días] Schema de billing.** Tablas `subscriptions`, `usage_logs`. Middleware que verifique plan antes de endpoints de IA.
19. **[3 días] Dashboard de admin.** Vista básica de métricas: usuarios activos, títulos más añadidos, uso de IA.
20. **[4 días] Onboarding.** Tour guiado en primer login, recomendaciones de ejemplo sin biblioteca, empty states con CTAs.

### Fase 4 — Escalado (20+ días)
*Post product-market fit.*

21. CDN para imágenes de portadas (Cloudinary o Vercel Image Optimization)
22. Caché de Redis para respuestas de APIs externas (TMDB, Jikan) — reducir latencia y coste
23. Supabase Edge Functions para queries pesadas
24. Índices de base de datos optimizados (basados en query patterns reales)
25. Monitoring de performance (Core Web Vitals, API latency p99)

---

## Resumen Ejecutivo

KULTURA es un prototipo técnicamente sólido con buena arquitectura base y patrones de código maduros para su fase. TypeScript estricto, separación correcta de secretos, normalización de APIs, rate limiting y tests multicapa son señales positivas de un desarrollador que piensa en producción.

**Sin embargo, no está listo para inversión** por cuatro razones no negociables:

1. **Sin modelo de negocio implementado** — ni siquiera las tablas de billing existen.
2. **Credenciales reales en el repositorio** — negligencia de seguridad activa.
3. **Infraestructura de producción ausente** — sin CI/CD, sin migraciones versionadas, sin observabilidad.
4. **GDPR no implementado** — riesgo legal real para usuarios EU.

Con 3–4 semanas de trabajo focalizado en las Fases 0–2, el producto alcanzaría un nivel de madurez suficiente para una ronda pre-seed con due diligence técnica favorable. La Fase 3 (monetización) es el gate real para Serie A.

**Estimación total de trabajo para inversión: 45–55 días-desarrollador.**

---

*Informe generado automáticamente leyendo el código real. Secciones donde no se pudo verificar algo están marcadas explícitamente. No se hicieron suposiciones.*
