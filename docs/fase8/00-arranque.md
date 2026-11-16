# 00 · Arranque (día 1)

Plan: §1, §4 (8A.0), §9.2, §9.6, §10, §12.

## 1. Precondiciones
- [ ] Saneamiento: fases **9, 10 y 12 cerradas** (necesario para 8A.2, no para 8A.0/8A.1). 12.3 (banderas) activa antes de la primera bandera `F8_*`. — Víctor
- [ ] Línea base de Sentry/TTFB/5xx de la fase 10 disponible (alimenta G4). — Claude (agente) comprueba
- [ ] Rama del `error.tsx` (H20) resuelta: lo fusionado antes del cierre de la 12 es del saneamiento; lo restante pasa al PR n+3 de 8A.3b. — Víctor
- [ ] Datos de partida vivos: 124 entradas, 8 usuarios, 4 activos a 30 días (§8.6). Se recalculan con `docs/metricas-fase8.sql` en 8A.2. — Claude (agente)
- [ ] Ninguna puerta tiene que estar pasada para empezar 8A.0. G0 **no** bloquea 8A.
- [ ] Revisar [`decisiones-pendientes.md`](decisiones-pendientes.md) y responder al menos D1–D4.

## 2. Herramientas y cuentas (coste 0)
| Herramienta | Para qué | Cuándo | Permiso explícito de Víctor |
|---|---|---|---|
| pencil / pen.dev (MCP en sesión) | Exploración de pantallas, moodboard y tablero de biblia (`docs/design/biblia.pen`); Claude genera y lee vía MCP | 8A.0 | **Sí** (app y, si aplica, cuenta pen.dev; verificar plan gratuito) |
| Rama desechable `proto/8a1-*` + Storybook | Prototipo navegable de ficha 2D y entrega a código (datos ficticios) | 8A.1 | No (Storybook ya en D7) |

**Decidido 2026-11-13:** cadena pencil (pen.dev, MCP) → código en rama desechable + Storybook, porque Claude controla ambos directamente (MCP y repo), la fidelidad a código es total y no se suben datos a terceros; descartados Google Stitch (estética genérica de IA, nube de Google), Penpot (solo GUI manual, sin control de Claude) y Figma (de pago).
| Storybook + `@storybook/addon-a11y` + `@storybook/test-runner` | Guía interna, axe por historia | 8A.3 (no antes) | **Sí** (instalar dependencias nuevas; hoy no existe `.storybook/`) |
| Playwright (`@playwright/test` ya en `package.json`) | Snapshots `toHaveScreenshot`, E2E | 8A.2 | No (ya instalado); el contenedor Linux fijo sí requiere «sí» si añade imagen nueva |
| `@lhci/cli@0.15.1` | Lighthouse en CI (ya en `.github/workflows/ci.yml`) | 8A.2 | No |
| Fuentes OFL: JetBrains Mono, Newsreader (alt.: Courier Prime, Literata); Bricolage ya en uso | Tipografía | Elegir 8A.0, montar 8A.3 | No (OFL, 0 €); comprobar *Reserved Font Name* |
| Videollamada con servidor UE o con DPA; grabación local | Rondas R1/R2 | 8A.1 | **Sí** si exige cuenta nueva |
| `chrome://inspect`, `adb`, Safari Web Inspector o `ios-webkit-debug-proxy` | Medición G1 | 8A.1 | **Sí** (instalar software) |
| `ffmpeg` + script de luminancia | Destellos A11Y-07 | 8A.3/8A.4 | **Sí** si no está instalado |
| Dispositivos G1 (6 modelos, §8.3) | G1 | 8A.0 (inventario) | **Sí** para comprar de 2.ª mano (ver D1) |
| Vercel Spend Management (aviso a 50 $) | Alerta de coste | 8A.0 | **Sí** (cambio de configuración de cuenta) |
| Créditos de IA generativa, Meshy, Blender MCP, MCP nuevos | Fuera por defecto | — | **Sí**, cada uno |

## 3. Acciones legales inmediatas (8A.0, lo primero)
- [ ] **D-HOY-1** Inventario por entradas y host: `docs/legal/hoy-inventario.sql` + lista de componentes `next/image` sin `loader`. — Claude (agente)
- [ ] **D-HOY-2** `docs/legal/decision-hoy.md`: opción (a), mantener portadas reales, optimizador y OG; riesgo R1b asumido. — Víctor
- [ ] **D-HOY-3 / P-7** PR 8A.0-P: `/privacy` cuenta portadas por `/_next/image` (copia hasta 7 días) y OG. Texto en plan §9.3; claves en `messages/es.json` (`…privacy…p3`, hoy ~l. 1742) y `messages/en.json`. — Claude (agente) redacta, Víctor aprueba
- [ ] **D-HOY-4 / P-10** Mismo PR: Vercel como encargado de optimización y caché de imágenes y OG (clave `vercel`, hoy ~l. 1731). — Víctor
- [ ] `privacy.updated` con la fecha del PR. — Claude (agente)
- [ ] **D-HOY-5** Encargo mínimo enviado (P1, P2, P4, P7, P8, P14; P1 como «esto ya ocurre: ¿es aceptable?») a clínica jurídica universitaria o servicio gratuito de colegio de abogados. — Víctor
- [ ] Correo de permiso a cada proveedor (TMDB, RAWG, ComicVine, AniList, MangaDex, MyAnimeList/Jikan, Open Library, Google Books, Steam, JustWatch) con [`plantillas/correo-proveedor-portadas.md`](plantillas/correo-proveedor-portadas.md). — Víctor envía; Claude (agente) prepara borradores
- [ ] **M1** Copia fechada de términos de cada proveedor en `docs/legal/terminos/`. — Claude (agente)
- [ ] Canal de retirada para titulares en `/legal` (respuesta ≤ 7 días). — Claude (agente), Víctor aprueba

Hechos de código comprobados (2026-11-13): `src/lib/images/poster-url.ts` (optimizador en l. 30-33; MangaDex siempre en l. 93; respaldo por defecto l. 96); `next.config.mjs` (`minimumCacheTTL` 7 días l. 199; 14 `hostname` en `remotePatterns`); `src/lib/best/poster.ts`; `src/lib/og/poster.ts`; CSP `img-src` en `src/lib/csp.ts:123`; `public/sw.js` y `tests/unit/pwa/sw.test.ts` existen.
