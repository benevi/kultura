# REDESIGN_AUDIT — Kultura antes del rediseño

Fecha: 2026-11-04 · Rama: `ccr-18443458-9u0yo9` · Base: `28479c1` (landing v2, #64)

## 1. Estado actual

Kultura es un diario y una biblioteca social de cultura en 7 formatos: películas, series, anime, manga, videojuegos, libros y cómics. Incluye listas, amigos, grupos, chat, rankings anuales públicos e importadores. Es una app en producción, con datos reales de catálogos externos, autenticación Supabase y dos idiomas.

## 2. Arquitectura detectada

| Área | Detalle |
|---|---|
| Framework | Next.js 15.5 (App Router), React 19.2, TypeScript |
| Estilos | Tailwind 3.4 con escalas **cerradas** (fuera de `extend`) y tokens OKLCH en `src/app/globals.css`. Solo tema oscuro. |
| Componentes | Propios con prefijo K (`src/components/ui/`) sobre Radix (dialog, popover, slot) y CVA. `components.json` de shadcn, aunque no se usa el kit. |
| Fuentes | `next/font/local`: Bricolage Grotesque (display), Figtree (cuerpo), KulturaDisplay (solo landing). Geist y GeistMono están cargadas pero sin uso. |
| Animación | CSS keyframes y un motor WebGL propio sin dependencias (`src/components/landing/engine.ts`, parallax por mapa de profundidad). `three` instalado **sin uso**. Sin GSAP, framer-motion, R3F ni lenis. |
| i18n | next-intl 4, `/[locale]` con es (por defecto) y en; `messages/*.json` (~2.200 líneas cada uno). Se envían al cliente solo los namespaces necesarios (`src/i18n/client-messages.ts`). |
| Auth | Supabase SSR: `src/middleware.ts` (sesión e intl), protección en `[locale]/(app)/layout.tsx`, callback `api/auth/callback`, cuenta demo (`api/auth/demo`). |
| Datos | Supabase (Postgres) + adaptadores por proveedor: TMDB, RAWG, AniList, MangaDex, Google Books, Open Library, Comic Vine, Steam, JustWatch. |
| Imágenes | `next/image` con `remotePatterns` de los catálogos. Portadas de la landing más mapas de profundidad regenerados cada semana (`scripts/landing-media`, Depth Anything V2). |
| Calidad | Vitest (unit, integration, contract), Playwright (e2e, a11y con axe, PWA), Lighthouse CI (script ≤ 150 KB, CLS ≤ 0,05, LCP ≤ 2,5 s), ESLint con reglas de diseño y un paso de CI propio de diseño. |
| PWA | Service worker, manifest, `/offline`, share target. |

## 3. Funcionalidades (37 pantallas; todas se conservan)

- **Públicas**:
  - `/` (landing v2)
  - `/login` (entrar, registro y recuperar contraseña)
  - `/reset-password`, `/welcome` (onboarding)
  - `/best`, `/best/[format]`, `/best/[format]/[year]`
  - `/media/[type]/[id]`
  - `/u/[username]`, `/u/[username]/l/[id]`, `/u/[username]/r/[type]/[id]`
  - `/report`, `/email/confirm`, `/email/unsubscribe`
  - `/privacy`, `/terms`, `/legal`, `/accessibility`, `/offline`
  - 404 y errores
- **App** (`(app)`, con sesión):
  - `/home`, `/discover`, `/library`
  - `/lists`, `/lists/[id]`, `/calendar`
  - `/chat`, `/chat/[id]`, `/friends`, `/groups`, `/groups/[id]`, `/notifications`
  - `/profile/[username]`, `/settings`, `/settings/import`, `/suggestions`
- **Transversales**:
  - Modales: estado de biblioteca, recomendar, crear lista, invitar, confirmar.
  - Toasts.
  - `loading.tsx` en 10 rutas y `error.tsx` en 11.
  - Imágenes OG generadas en 5 rutas.
  - Banner de demo, oferta de notificaciones push e instalación de la PWA.

## 4. Problemas visuales y técnicos

1. **Identidad ajena a la referencia pedida.** El sistema F0 (oscuro, neones pink/lime, sombras duras de pegatina, rotaciones de tarjeta y gradientes) es coherente, pero tiene los rasgos que las cuatro skills de diseño marcan como plantilla: gradientes en pósters, sombras en reposo, eyebrows y pegatinas, rejillas de tarjetas idénticas y varios acentos a la vez.
2. **Dos sistemas visuales.** La landing v2 tiene su propia hoja (`landing.css`, en hex y con su propia escala) fuera de los tokens; el resto de la app usa F0.
3. **Navegación autenticada sobrecargada.** `AuthHeader` lleva 8 enlaces, campana y avatar. El propio `DISENO.md` lo marca como deuda.
4. **Sin sistema de movimiento.** Solo keyframes sueltos (modal, toast, `k-word`), sin tokens compartidos, sin coreografía por sección y sin transiciones entre pantallas.
5. **Estados dispersos.** Los vacíos están en línea en cada componente, sin patrón común. Los esqueletos están copiados a mano por ruta.
6. **Dependencia muerta:** `three` (más `@types/three`).
7. **Código huérfano parcial:** `src/lib/landing/immersive.ts` y `showcase.ts` ya no los usa la landing; solo los OG y alguna sección.
8. **Solo tema oscuro**, sin preferencia del sistema ni selector.

## 5. Lo que funciona y se conserva

- Rutas, API, auth, middleware, contratos y datos reales.
- La voz (`VOZ.md`) y sus tests de i18n.
- Escalas cerradas vigiladas por tests y ESLint. Se cambian los valores, no el mecanismo.
- `page-grid`, el contraste comprobado por test y el foco visible.
- El pipeline semanal de portadas con profundidad: es material real para el 3D.
- La alternativa sin WebGL / con movimiento reducido de la landing (`SceneEnv`).
- `PosterFrame` como tarjeta única: se rediseña, no se duplica.

## 6. Oportunidades

- **Una idea propia de Kultura.** Su diferencia frente a Letterboxd, Goodreads o MAL es que lo junta todo: 7 formatos en una sola biblioteca. Esa es la idea que debe sostener el diseño.
- **La portada de cada título es el color.** El catálogo ya trae arte real a todo color, así que la interfaz puede ser casi monocroma y dejar que el color lo pongan las portadas.
- Un único sistema de tokens para la landing y la app, con tema claro y oscuro.
- Movimiento con frecuencia justificada: expresivo en lo raro (landing, primera visita) e inmediato en lo diario (filtros, navegación).

## 7. Nueva dirección artística

La han decidido las skills (ver `SKILLS_AND_TOOLS.md` y `docs/redesign/DIRECCION.md`):

- **Página** (Taste Skill): «La frase es la composición» (`sentence-as-layout`, semilla 1399116372). Big Shoulders + Public Sans y «Cobalto sobre arena».
- **Pantallas de app** (Taste Skill): `true-black-flat`.
- **Patrones** (UI UX Pro Max): Editorial Grid / Magazine + Exaggerated Minimalism + Immersive/Interactive Experience. Los colores de categoría de Media Platform se descartan por la regla de un solo acento de Taste.
- **Referencias** (Awesome Claude Design): Spotify (las portadas como única fuente de color), WIRED y The Verge (display alto y estrecho solo en momentos grandes).
- **Movimiento** (Design Motion Principles): Jakub primario, Jhey en la landing y en momentos raros, Emil en navegación, formularios y acciones frecuentes.

## 8. Tecnologías

Next.js / Tailwind (se mantienen), GSAP + ScrollTrigger, React Three Fiber + drei (import selectivo y carga diferida), View Transitions API y `next/font/local`.

## 9. Riesgos y compatibilidades

- **Peso de R3F + three**: chunk diferido. Si Lighthouse lo cuenta en `/es`, se ajusta el presupuesto solo en esa ruta, con justificación.
- **Tests de guarda**: se reescriben con la identidad nueva, sin desactivar ninguno.
- **Snapshots de marcado** (`discover-client-markup`): se actualizan en la PR que toque Descubrir.
- **Las reglas de Taste chocan con hábitos actuales** (sin gradientes, sin sombras en reposo, sin mayúsculas tracking, sin monoespaciada, sin eyebrows). Se aplican igual: lo decidió el usuario.
- **Supabase real** no está disponible en el contenedor: las pantallas con sesión se prueban con el mock de a11y y con la cuenta demo cuando sea posible.
