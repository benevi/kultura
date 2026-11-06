# Rescate F0 — lógica sacada de la UI vieja y destino de los tests

PR de rescate de `PLAN_ESTRATEGICO.md` §7.3 (lista de partida: `FUNCIONES_V2.md` §5). `[refactor]` sin cambios de comportamiento (regla 8, §7.5). Este documento es el índice: dice dónde vive ahora cada pieza y qué pasará con cada test cuando se retire la UI vieja. **No se borra nada en este PR.**

## 1. Movimientos (`git mv`, historial conservado)

| Antes | Ahora |
|---|---|
| `src/app/[locale]/login/in-app-browser.ts` | `src/lib/auth/in-app-browser.ts` |
| `src/app/[locale]/login/supabase-lazy.ts` | `src/lib/supabase/lazy.ts` |
| `src/app/[locale]/welcome/starter-titles.ts` | `src/lib/recommendations/starter-titles.ts` |
| `src/app/[locale]/(app)/home/tonight.ts` | `src/lib/home/tonight.ts` |
| `src/app/[locale]/(app)/discover/discover-config.ts` | partido: lógica (`buildYearBuckets`, `isDiscoverType`) → `src/lib/discover/discover-config.ts`; iconos y esqueleto del sistema viejo (`TYPE_ICONS`, `FILTER_ICONS`, `DISCOVER_SKELETON_CELLS`) → `src/components/discover/discover-icons.ts` |
| `src/app/[locale]/(app)/discover/useFilterGroups.ts` | `src/hooks/useFilterGroups.ts` |
| `src/app/[locale]/u/[username]/r/_lib/rating-share.ts` | `src/lib/share/rating-share.ts` |
| `src/app/[locale]/u/[username]/r/_lib/top-four.ts` | `src/lib/share/top-four.ts` |
| `src/app/[locale]/(app)/settings/import/import-storage.ts` | `src/lib/import/import-storage.ts` |
| `src/app/[locale]/(app)/settings/platforms.ts` | `src/lib/platforms/platforms.ts` |
| `src/app/[locale]/share/route.ts` | **se queda**: route handler del `share_target` de la PWA (URL fijada en `src/app/manifest.ts`) |
| `src/app/api/settings/identity.ts` | `src/lib/account/identity.ts` |
| `src/app/api/settings/account-state.ts` | `src/lib/account/account-state.ts` |
| `src/app/api/lists/shared.ts` | `src/lib/social/lists-shared.ts` |
| `src/app/api/reports/shared.ts` | `src/lib/social/reports.ts` |

Los 4 últimos son los módulos de `@/app/api` que importaban 10 pantallas (`FUNCIONES_V2.md` §5). Sin reexportes en la ruta antigua: un `vi.mock` sobre la ruta vieja dejaría de mockear sin avisar, así que los `vi.mock` de los tests se han reapuntado.

`src/app/[locale]/u/[username]/r/_lib/rated-card.tsx` se queda: es UI (tarjeta OG) y se rehará con v2.

## 2. Hooks extraídos

| Hook | De | Qué contiene | Qué queda en el componente |
|---|---|---|---|
| `src/hooks/useAuthFlow.ts` | `login/LoginPage.tsx` | modo y destino desde la URL, atribución, avisos, estado del formulario, validación, entrar / registrarse / Google / recuperar / reenviar, personaje pendiente, navegador integrado, cuenta atrás | render (JSX, `GoogleIcon`, clases); reexporta `RESEND_COOLDOWN_SECONDS` y `welcomeHref` |
| `src/hooks/useAccountSettings.ts` | `(app)/settings/SettingsForm.tsx` | estado de identidad, guardar, escala de notas, correo semanal, cambio de correo, exportar / importar, borrado de cuenta (resumen, cancelar, borrar), avisos push | render, `useRadioGroupKeys` (teclado del radiogroup), `PRIVACY_CONTACT_EMAIL` |

Los dos siguen usando `next-intl` y, `useAccountSettings`, `useToastContext`: la UI v2 los usará con sus propios proveedores.

## 3. Destino de los 36 `tests/**/*.test.ts` que importan `@/app` o `@/components`

Consulta: `grep -rlE "from ['\"]@/(components|app)/|vi\.mock\(['\"]@/(components|app)/" tests --include=*.test.ts` = 36 (2026-11-06).

**A. Conservar tal cual (23)** — prueban route handlers o rutas de metadatos, que no son UI y sobreviven:
`analytics/invite-attack`, `analytics/signup`, `api/discover-route`, `api/health-route`, `api/revalidate-route`, `api/search-route`, `app/seo-routes`, `auth/callback-route`, `calendar-email/cron`, `calendar-email/optin` (solo mockea `components/analytics/VercelAnalytics`), `calendar-email/routes`, `csp/csp-report`, `diary/account-import-export`, `identity/callback-welcome`, `identity/cron-daily`, `import/acceptance`, `import/route`, `legal/security-txt`, `providers/health-probes`, `push/routes`, `pwa/installed-route`, `search/routes`, `shell/pwa`.

**B. Conservar, reapuntados en este PR (5)** — probaban lógica que ya está en `src/lib`:
`adaptations/rating-share`, `auth/in-app-browser`, `import/import-storage`, `identity/reserved`, `moderation/shared`.

**C. Mixto (1)** — `plataformas-listas/tonight`: la parte de `availableTonight`/`matchPlatforms` (lógica, reapuntada) se conserva; la parte de `TonightClient` (UI vieja) se rehace con la pantalla Inicio v2.

**D. Rehacer con la pantalla v2 (3)** — prueban UI o metadatos de pantallas viejas:
`auth/login-metadata` (`login/page`, `LoginPage`, `reset-password`), `next15/og-metadata` (`opengraph-image` de portada y login), `demo/demo` (`DemoBanner`).

**E. Candidatos a un 2.º rescate (4)** — lógica que sigue dentro de `src/components` (no se mueve en este PR):
`landing/engine` (`components/landing/engine`), `pwa/install-policy` (`components/pwa/install-policy`), `pwa/sw-register` (`components/pwa/sw-register`), `pwa/share-target` (`components/pwa/share-target`; la parte de `app/[locale]/share/route` es A).

Además se reapuntaron estos `.test.tsx` (importan o mockean un módulo movido; su destino lo decide la pantalla v2 correspondiente): `identity/welcome-flow`, `adaptations/og-cards`, `adaptations/rated-page`, `catalogo/discover-hooks`, `plataformas-listas/platforms-ui`, `plataformas-listas/settings-page`, `components/auth/register-form`, `calendar-email/settings-form`, `ui-v2/switch`.

## 4. Destino de los 13 archivos de `tests/unit/design|visual`

Atados a `DISENO.md`, `globals.css` y `tailwind.config.ts` del sistema viejo: se rompen con el primer token nuevo. **La decisión final la toma el paso 5 de F2** (`03_DESIGN_SYSTEM.md`, `PLAN_ESTRATEGICO.md` §6). Propuesta por archivo:

| Archivo | Qué comprueba | Propuesta |
|---|---|---|
| `design/contrast.test.ts` | contraste WCAG de los tokens | **rehacer** contra los tokens nuevos (la regla sobrevive) |
| `design/css-tokens.ts` | helper: lee `:root` de `globals.css` | **rehacer** (lo usan contraste y doc) |
| `design/dead-colors.test.ts` | ninguna clase de color sin regla | **rehacer** contra el config nuevo |
| `design/diseno-doc.test.ts` | `DISENO.md` describe el código | **rehacer** contra `03_DESIGN_SYSTEM.md` |
| `design/focus-ring.test.ts` | anillo de foco pink, no lime | **retirar** con la UI vieja; la regla de foco visible pasa a axe y al sistema nuevo |
| `design/no-mono.test.ts` | solo dos familias tipográficas | **rehacer** con las familias del sistema nuevo |
| `design/tailwind-alpha.test.ts` | clases con opacidad generan regla | **rehacer** (comprobación genérica de Tailwind) |
| `visual/classes-compile.test.ts` | ninguna clase de `src` sin regla | **rehacer** (genérico) |
| `visual/diseno-scales.test.ts` | `DISENO.md` = código en sets cerrados | **rehacer** contra `03_DESIGN_SYSTEM.md` |
| `visual/poster-frame.test.tsx` | una sola tarjeta de póster | **retirar** con la UI vieja; el componente de póster v2 trae su test |
| `visual/scales.test.ts` | radios, tipos, sombras y retícula cerrados | **rehacer** con las escalas nuevas |
| `visual/skeletons.test.ts` | esqueletos con la forma real | **retirar** con la UI vieja; v2 trae los suyos |
| `visual/status-contrast.test.ts` | contraste de pastillas de estado | **rehacer** (la regla sobrevive) |

Resumen: 10 rehacer, 3 retirar con la UI vieja. Ninguno se toca hasta F2.
