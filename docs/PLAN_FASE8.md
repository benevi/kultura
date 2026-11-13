> Paquete de arranque (checklists, puertas, plantillas): [`fase8/README.md`](fase8/README.md)

# Plan de la fase 8 · Rediseño «Archivo vivo»

**Versión 3** · 2026-11-12 · Borrador sin commitear. Responsable único: **Víctor**. Cada artefacto indica si lo hace «Víctor» o «Claude (agente)».

Fuentes: decisiones canónicas v3 (mandan), apartados v3.1 (visual, uso y accesibilidad, arquitectura, rendimiento, legal, fases), revisiones de ronda 1 y ronda 2 (**todas las correcciones de ronda 2 están aplicadas** en este texto) y decisiones de Víctor del 2026-11-12 (§1), que mandan sobre todo lo anterior.

Leyenda: **[V]** comprobado en el repo · **[E]** estimación orientativa · **[P]** pendiente del «sí» de Víctor.

---

## 0. Resumen ejecutivo

- **Qué:** identidad visual propia («Archivo»: papel, cartón, latón, tinta, luz cálida) en todas las pantallas, y que la gente registre más y vuelva más. El 2D es el producto; el 3D es una capa opcional.
- **8A (se hace):** rediseño 2D de todas las pantallas + deuda de UI (8A.3b) + 3D solo en la ficha (T1, sala Cine, solo películas), con textura directa del CDN del proveedor en `CORS_OK_HOSTS`. Se entrega completa aunque 8B no exista.
- **8B (condicional):** canvas persistente, vuelo, salas 2–4, sonido, KTX2/profundidad, Wrapped y premios. Solo si pasan G2, G3b, G4, G6 (y G0 para 8B.3).
- **Puertas:** G0 legal · G1 rendimiento en dispositivo · G2 canvas persistente · G3a/G3b usuarios · G4 valor en campo · G5 revisión de alcance · G6 coste de oportunidad (≥ 12 activos a 30 días). Tabla única en §3.
- **Lo primero (8A.0):** declarar en `/privacy` lo que ya ocurre con las portadas (optimizador de Vercel y OG) y a Vercel como encargado; preguntarlo a asesoría legal.
- **Coste objetivo:** ≈ 0 €/mes. Herramientas libres o gratuitas (Google Stitch, Storybook, Playwright, fuentes OFL, dispositivos propios o prestados, voluntarios, asesoría jurídica gratuita).
- **Tiempo:** sin fechas límite. Estimación orientativa 8A en código (8A.2–8A.6): 13,5–22 semanas base, 18–28,5 con +30 % (§4; corregido 2026-11-13: tabla recalculada base × 1,3). Manda el orden de las puertas, no el calendario.

---

## 1. Decisiones tomadas

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-11-12 | **Portadas: «usar portadas reales».** Se mantiene el comportamiento actual: optimizador `/_next/image` para MangaDex, ComicVine y Steam (siempre) y AniList en `/best`; OG con portadas reales. Mínimo obligatorio: declararlo en `/privacy` con Vercel como encargado y preguntarlo a asesoría legal (P1). **Riesgo asumido** (R1b). La regla del 3D se mantiene: textura solo directa del CDN en `CORS_OK_HOSTS`, nunca `/_next/image` | Víctor |
| 2026-11-12 | **Coste ≈ 0:** alternativas libres o gratuitas; el tiempo no importa (§10) | Víctor |
| 2026-11-12 | **Sin fechas límite:** estimaciones solo como orientación; orden por puertas; 8A primero, 8B condicional | Víctor |
| 2026-11-12 | **Guía de diseño en Storybook** (gratuito) con `@storybook/addon-a11y` y `@storybook/test-runner`; montaje 1–2 días en 8A.3; **la guía es interna** (no hay `/design` pública) | Víctor |
| 2026-11-12 | **«8A.3b» es subfase oficial** (deuda de UI heredada). Numeración válida: 8A.0–8A.6 (incluida 8A.3b) y 8B.1–8B.5. Prohibido «8.3b», «8.4», «8.7» | Víctor |
| 2026-11-12 | Si el panel visual falla dos veces, el T1 sale de 8A sin más votación (N8) | Víctor |
| v3 canónico | Navegación ≤ 350 ms; ficha en 8A con `dur-base` 280 ms (View Transitions CSS); preferencias en el perfil; casilla «Uso lector de pantalla» eliminada; sonido a 8B; matriz de contraste 21/42; G0 no bloquea 8A | Canónico |

**Pendientes [P]:** Q34 (medición de v2 = trabajo de 8A.2, sin `worker-src`), Q35 (analítica por pantalla con Vercel, agregada y sin `user_id`; no cambia `/privacy`; el RUM 3D sí, y va por **P-6** con banner de **P-11**), Q36 (tipo de bandera `operativa`, revisión cada 90 días; si no se aprueba, `F8_STAGE` queda con dueño Víctor y revisión trimestral).

---

## 2. Principios

1. **2D primero, 3D opcional.** Cada pantalla se aprueba en 2D antes de tocar el 3D (salvo los spikes técnicos S7 y S10). El 3D es una capa `aria-hidden` que puede faltar sin perder texto, acción ni enlace. Toda tarea se completa igual en 2D.
2. **El HTML del servidor es la fuente de verdad.** Ningún texto en el canvas. El 3D lee del DOM.
3. **El 3D nunca está en el camino crítico.** LCP siempre 2D; el chunk T1 se importa en idle (3 s) tras el LCP y fuera de la traza de Lighthouse.
4. **Cada presupuesto tiene un test que lo hace cumplir.**
5. **Mantenimiento 3D ≤ 20 %** (etiqueta `f8-mant`, medida mensual). > 20 % dos meses seguidos ⇒ `F8_STAGE` apagado por defecto.
6. **Decir la verdad en `/privacy`**, no tratar datos de salud sin necesidad, no derivar portadas sin base.
7. **Coste ≈ 0:** ningún gasto sin un «sí» propio de Víctor.
8. **Esquema real** [V]: biblioteca = `public.user_media` (`media_id` text, `updated_at`); portada = `public.media.poster`. No existen `library_entries` ni `poster_url`.

---

## 3. Tabla canónica de puertas (única; el resto del documento la cita)

| Puerta | Cuándo | Umbral | Evidencia | Si falla | Bloquea |
|---|---|---|---|---|---|
| **G0 · Legal** | Cuando haya respuesta válida al encargo mínimo (enviado al cerrar 8A.0) | Respuesta escrita a **P1, P2, P4, P7, P8, P14** (de asesoría jurídica o, por proveedor, permiso escrito del propio proveedor). Cobertura por entradas **y** por títulos únicos: **≥ 80 % GO**; **50–80 % GO parcial (KTX2 sí, sin profundidad)**; **< 50 % NO-GO**. Regla por proveedor en `provider_art_policy`. **Sin respuesta válida ⇒ NO-GO** | `docs/legal/informe-G0.pdf` (o cartas de proveedores) + salida de `docs/legal/g0-cobertura.sql` | NO-GO: 8B.3 fuera; 3D sigue con textura directa en `CORS_OK_HOSTS` o carátula generativa | 8B.3, S4 en producción, cualquier ampliación de copia propia. **No bloquea 8A**. (La OG con portadas reales continúa como riesgo asumido, §1; si la respuesta a P1 es negativa, se retira) |
| **G1 · Rendimiento** | Fin de 8A.1 | **S1 + S3 + S7 (AVIF/WebP + CORS) + S10.** 6 modelos de §8.3; frame p95 ≤ 1,0 vsync normalizado; ningún frame > 50 ms; **≤ 1 % de frames > 2 vsync; 0 pérdidas de contexto en 10 min; deterioro térmico ≤ 20 %**; memoria sobre línea base 2D: T1 ≤ +150 MB, T2 ≤ +250 MB; bajada de tier si p95 > 2 × vsync en 2 ventanas seguidas (test 30/60/120 Hz). Firefox de escritorio forma parte del modelo «Escritorio» | `docs/spikes/S*.md` + trazas | Falla ≤ 25 %: solo T1 con ajustes. > 25 %: NO-GO del 3D, 8A entera en 2D | Encender T1 (8A.4) |
| **G2 · Canvas persistente** | Antes de 8B.1 (S2) | 0 reinicios de contexto en público → (app) → ficha; CLS ≤ 0,05 en el vuelo; 2D idéntico sin JS | `docs/spikes/S2.md` + E2E | 3D solo dentro de la ficha; 8B.1 fuera | 8B.1 |
| **G3a · Rediseño 2D** | Fin de 8A.1 (ronda 1) | **Criterio de 20 §8 (G3a): todas las tareas completadas por ≥ 4/5; ningún bloqueo para la persona con lector; T2 («buscar → añadir») y T4 en objetivo** | CSV de tareas + `docs/research/R1.md`; P-9 cerrado | Rehacer (máx. 2 iteraciones). **Si el panel visual V2 falla en la 2.ª iteración: 8A sigue solo en 2D; el T1 sale de 8A; G3a valida el 2D como esté; G3b no se celebra** | 8A.2 |
| **G3b · T1 frente a 2D** | En 8A.4, antes de encender `F8_FICHA_T1` (ronda 2) | 4/5 entienden la sala sin instrucciones; 3/5 prefieren T1; ninguna tarea > 10 % más lenta; la persona con lector completa todo | CSV + `docs/research/R2.md` | Rehacer (máx. 2); si falla 2 veces: sin T1, 8B no arranca, V9 no entra | Encender T1; 8B; V9 |
| **G4 · Valor en campo** | Desde 8A.4 al 100 %: **mín. 8 semanas o 150 sesiones 3D ponderadas, lo que llegue después; tope 12 semanas** (después, «direccional») | Filas de §8.5. **Condición dura:** retención y entradas por usuario activo **no bajan**. < 20 sesiones/semana: mediana y máximo, sin percentiles; filas RUM solo bloquean (n ≥ 30) | `docs/metricas-fase8.sql` + export RUM + informe ≤ 1 pág. | 3D pasa a **opcional, desactivado por defecto**; se reevalúa en G6 | 8B |
| **G5 · Revisión de alcance** | Cuando el esfuerzo de 8A.2–8A.4 supere la estimación pesimista (≈ 21,5 semanas de dedicación desde 8A.2: suma +30 % de 8A.2, 8A.3, 8A.3b y 8A.4 en §4; corregido 2026-11-13, antes ≈ 18) sin ficha nueva en producción | Ficha nueva (primer PR de 8A.4) en producción | Fecha de merge del PR de la ficha | Víctor aplica el orden de recorte (§5.7); el T1 puede salir de 8A y lo pendiente se entrega en 2D. No hay corte automático por fecha | Resto de 8A con 3D |
| **G6 · Coste de oportunidad** | Al cerrar 8A.6 y luego cada trimestre | **≥ 12 usuarios activos a 30 días** (mínimo absoluto) **y** entradas por usuario activo ≥ línea base | Consulta G6 de `docs/metricas-fase8.sql` | 8B se aplaza un trimestre; el tiempo va a crecimiento/funciones | 8B entero |

**Revisión independiente:** G1, G3a, G3b y G4 los evalúa un agente de Claude **distinto** del que implementó (`docs/gates/Gx-revision.md`). Decide Víctor.

---

## 4. Fases

Unidad: semana de dedicación completa (una persona + IA). Estimaciones **[E] orientativas**, sin fechas límite. Calendario real ≈ ×1,25 por el mantenimiento.

### Encaje con el saneamiento
Orden vigente [V `PLAN_SANEAMIENTO.md`]: `… → 9 → 10 → 12 → 8 → 11`. 8A.0 y 8A.1 van en paralelo (fuera del código de producto o en ramas desechables); el código de producto empieza en 8A.2.

| Fase del saneamiento | Qué toma la 8 |
|---|---|
| 9 | Entrada de 8A.2; `loading.tsx` + error con reintento (Q32) → 8A.3b |
| 10 | Línea base Sentry/TTFB/5xx → G4 |
| 12 | 12.3 banderas, 12.5 alertas, 12.7 plantilla de PR |
| 11 | Borra código de banderas apagadas (no quedará ninguna de la 8) |
| 5 → 8 (Q28) | Filtros de la biblioteca → 8A.3b |

Rama en curso (H20): el `error.tsx` que se fusione antes del cierre de la 12 es del saneamiento; lo que quede pasa al PR n+3 de 8A.3b.

### 8A.0 · Preparación — 1–2 sem [E]
- **Entra:** nada (fuera del producto, salvo el PR legal).
- **Trabajo:**
  - **PR 8A.0-P (D-HOY-3, el primero de todo): P-7** (`/privacy` cuenta portadas por `/_next/image` y OG) **y P-10** (Vercel encargado de optimización/caché de imágenes y OG), fusionado en 8A.0: es un tratamiento que **ya ocurre** (art. 13 RGPD), no puede esperar a 8A.2. Texto en §9.3. D-HOY-1 (inventario por host con `docs/legal/hoy-inventario.sql` + componentes `next/image` sin `loader`) y D-HOY-2 (decisión escrita en `docs/legal/decision-hoy.md`: opción (a) elegida por Víctor el 2026-11-12) en el mismo paquete.
  - Encargo legal mínimo **enviado** (P1, P2, P4, P7, P8, P14; resto, opcional; el optimizador lo cubren P1 y P2) a una asesoría gratuita (§9.6); en paralelo, petición de permiso escrito a cada proveedor y M1 (lectura de términos con copia fechada en `docs/legal/terminos/`).
  - Fuentes OFL elegidas (§5.4); biblia de dirección de arte (V1) y tablero en Google Stitch.
  - Reclutamiento de R1 (3 usuarios actuales + 2 externos, ≥ 1 con lector) y del panel visual (3 voluntarias externas, ≥ 1 diseñadora con portfolio).
  - Inventario de notificaciones existentes (H17); `docs/ops/vercel-plan.md` (plan, cuota de optimización de imágenes, alerta de 50 $ en Spend Management) (H9); `LICENSES.csv`, `NOTICE` y test (L1 de legal; corregido 2026-11-13: antes «R1 de legal», renombrado para no confundir con el riesgo R1); canal de retirada en `/legal`.
  - Dispositivos de G1: inventario de los propios y préstamos acordados (§8.3).
- **Sale:** PR 8A.0-P fusionado; encargo enviado (no respondido); fuentes en `assets/LICENSES.csv`; **biblia v0** (`docs/design/BIBLIA.md` con dirección, concepto, antirreferencias y tokens base de color/tipografía; corregido 2026-11-13: antes «biblia aprobada»); 5 personas + 3 panelistas confirmados (si no: R15); `docs/ops/vercel-plan.md`.

### 8A.1 · Concepto, spikes técnicos y validación — 3,5–4,5 sem [E]
- **Entra:** 8A.0 cerrada.
- **Trabajo (orden interno obligatorio):**
  1. Ficha, biblioteca e inicio en 2D alta fidelidad (prototipo navegable, Google Stitch o rama desechable). En paralelo, spikes **técnicos no visuales S7** (AVIF/WebP + CORS; produce `CORS_OK_HOSTS` con test) **y S10**.
  2. **Panel visual** a ciegas sobre el prototipo (§5.1) → `docs/design/panel-YYYY-MM.md`. Sin ficha 2D aprobada no empieza ningún spike visual.
  3. Ficha con T1 Cine; spikes **S1** (bundle), **S3** (dispositivo), **S5** (CSP/SW Safari iOS y PWA sin imágenes, en rama desechable), **S6** (a11y y comprensión), **S9** (RUM 3D mínimo).
  4. **P-9** (consentimiento y protocolo del estudio) firmado antes de R1; sin él no hay G3a.
  5. **Ronda 1** (G3a): 5 personas, remoto, 30 min, NVDA + Firefox y VoiceOver iOS.
- **Sale:** veredictos de spikes, actas → **G1**, **G3a**; **biblia V1 aprobada**: `docs/design/BIBLIA.md` completa (§5.2: moodboard, contención, signatura, identidad sonora) con la ficha 2D que pasó el panel visual, y aprobación de Víctor fechada en el propio archivo (corregido 2026-11-13).

### 8A.2 · Fundaciones de medición y privacidad — 1,5–2,5 sem [E] (1–1,5 + 0,5–1 de privacidad; +30 %: 2–3,5)
- **Entra:** fases 9, 10 y 12 ✅; G1 y G3a ✅. **G0 no hace falta.**
- **PRs (uno por punto):**

| PR | Contenido | Tipo |
|---|---|---|
| 8A.2-1 | Analítica por pantalla (Q35) + marca `kultura.quick_action` a `/api/rum/ux` (§8.4) | función |
| 8A.2-2 | `docs/metricas-fase8.sql` + línea base con números (§8.6) | docs |
| 8A.2-3 | Lighthouse: ficha y `/es/u/lucia_lee` con datos sembrados; a11y/SEO como error; LCP/TBT aviso; métrica «JS antes del LCP» | CI |
| 8A.2-4 | Snapshots de Playwright (`toHaveScreenshot`) de las 6 pantallas N1; revisar el comentario de cabecera del job `a11y` en `ci.yml` (corregido 2026-11-13: sin número de línea; «85-86» no apuntaba a nada concreto); presupuesto de minutos de CI (H13) | CI |
| 8A.2-5 | **PR 1 adelantado (firme):** enum `license_basis` + `provider_art_policy` (§7.4), todas las filas `api_hotlink`, para alimentar la atribución. `media_art`, trigger e índice llegan en 8B.3 | migración |
| 8A.2-P1 | **P-1, P-4, P-5:** inventario `docs/privacy/storage-keys.md` + test de claves; tabla `public.user_preferences` con RLS y borrado en cascada; deshacer ≤ 60 s; test de que no existe la casilla de lector de pantalla | privacidad |
| 8A.2-P2 | **P-6:** RUM 3D (endpoint, `rum_stage_daily` agregada, campos de 40 §3.3, sin `user_id`/UA/IP, muestreo dictado por servidor, peso `w`) + **P-2** (sin fingerprinting), declarado en `/privacy` en el mismo PR; también `/api/rum/ux` | privacidad |
| 8A.2-P3 | **P-8 (diseño):** Wrapped, sala pública y OG de perfil privados por defecto, opt-in, revocar ⇒ 404 + purga (implementación en 8B.4) | privacidad |
| 8A.2-P4 | **P-11:** fecha visible, historial al pie, banner único si amplía tratamientos, `es.json`/`en.json` juntos, test de `privacy.updated` | privacidad |

- También: casos nuevos en `tests/unit/pwa/sw.test.ts` (caso «sin imágenes» en 8A) y migración de preferencias existentes.
- **Sale:** CI verde; línea base con números; **P-1, P-2, P-4, P-5, P-6, P-8 (diseño) y P-11 fusionados; P-7, P-9 y P-10 ya fusionados en 8A.0/8A.1** (condición de salida).

### 8A.3 · Sistema 2D — 2–3 sem [E] + 1–2 días de montaje de Storybook
- **Entra:** 8A.2 ✅.
- **Trabajo:** tokens en 3 capas (DTCG, OKLCH); alias heredados marcados obsoletos (trinquete en CI: los usos solo pueden bajar; se borran en 8A.5); matriz de contraste 14/14 (21/21 al entrar Cine); escala tipográfica y fuentes OFL; movimiento e interruptor; kit «Archivo 2D» (8 componentes); carátula generativa y signatura; **montar Storybook** (no existe hoy [V]): `@storybook/addon-a11y` + `@storybook/test-runner`, job de CI propio solo en PR que toquen `src/components/archivo/**`, publicación interna como artefacto de CI.
- **Sale:** guía interna en Storybook; test de contraste verde; CLS sin cambios; axe limpio en todas las historias.

### 8A.3b · Deuda de UI heredada — 3–5 sem [E]
- **Entra:** 8A.3 ✅ (kit y tokens disponibles; corregido 2026-11-13, antes sin definir).

| # | PR | Tipo | Sale cuando |
|---|---|---|---|
| 1 | Botón, input, footer, póster base | refactor | 0 duplicados; snapshots iguales |
| 2–6 | Partir `SettingsForm`, `ConversationClient`, `WelcomeFlow`, `ImportClient`, `ListDetail` (V3b) | refactor | Ningún archivo > 300 líneas; E2E verde; solo componentes del kit |
| 7–n | `style={{}}` → tokens, un PR por carpeta | refactor | 196 → ≤ 10 justificados |
| n+1 | Componentes de servidor | refactor | JS inicial igual o menor |
| n+2 | `loading.tsx` (Q32) | arreglo | 100 % de `(app)` |
| n+3 | Error común con reintento (Q32, H20) | arreglo | 11 `error.tsx` con el mismo componente |
| n+4 | Filtros de biblioteca (Q28) | función | Bandera `F8_FILTROS` (cuenta para el límite de 3); E2E |

### 8A.4 · Pantallas N1 + ficha con T1 Cine — 3,5–5,5 sem [E] (incluye ronda 2)
- **Entra:** 8A.3 ✅; G1 ✅ para el T1.
- **Trabajo:** ficha primero (2D + T1 Cine en películas; `<Canvas events={() => ({ enabled: false, priority: 0 })}>` + test sin `pointermove`; import idle fuera de la traza; textura directa solo en `CORS_OK_HOSTS`); **ronda 2 (G3b)** con las mismas 5 personas antes de encender T1; luego biblioteca → listas → inicio → perfil → `u`. Acciones rápidas con deshacer. **Atribución** (AT) de TMDB, RAWG, ComicVine, AniList, MangaDex y MyAnimeList con test; `/accessibility` actualizada (AC) con la ficha. SEO-01 por pantalla. Sala Cine (V10).
- **Sale:** 6 pantallas al 100 %; código viejo borrado → arranca **G4**. Si > 20 % de las entradas **de tipo película** quedan en 2D por CORS, se reabre con legal.

### 8A.5 · Pantallas N2 y N3 — 3–5 sem [E]
- **Entra:** 8A.4 ✅ (incluye G3b si se celebró; corregido 2026-11-13, antes sin definir).
- N2 (buscar, descubrir, calendario, amigos, grupos, sugerencias, welcome, best) con kit y movimiento; N3 (chat, notificaciones, ajustes, legales) solo tokens; al final, borrado de alias obsoletos.
- **Sale:** 0 pantallas antiguas; pseudolocale +40 % sin cortes; SEO-01 en todas.

### 8A.6 · Observación y cierre — ~0,5 sem de trabajo (8–12 sem de observación)
- En paralelo a 8A.5. Medir §8.6; A11Y-15 completa (TalkBack, VoiceOver macOS si hay acceso); informe G4 con revisión independiente; luego G6.

### Fases de 8B (solo si G2, G3b, G4 y G6 ✅)

| Fase | Entra | Trabajo | Sale | Est. [E] |
|---|---|---|---|---|
| **Previa a 8B.1** | G6 ✅ | Spike **S2** | G2 | 1 |
| **8B.1** Canvas y vuelo | G2 ✅ | Canvas en `[locale]/layout.tsx`; vuelo ≤ 350 ms interrumpible; ficha usable ≤ 350 ms | 0 reinicios; INP p75 ≤ 200 ms | 3–4 |
| **8B.2** Salas 2–4 + sonido | 8B.1 ✅; Q1 con datos; G3b ✅ | Salón, Biblioteca, Recreativos; 42 combinaciones (salas solo noche); V9 sonido (`F8_SOUND`) | ≤ 300 KB por sala; contraste verde | 4–6 |
| **Previa a 8B.3** | G0 GO o GO parcial | Spikes **S4** (profundidad; producción solo con G0), **S7-KTX2**, **S5 completo** (`worker-src`, `kultura-tex`) y **S8** | Veredictos | 2 |
| **8B.3** KTX2 (+ profundidad si GO) | Previa ✅ | `media_art` en 3 PRs; Storage y SW `kultura-tex` solo para `derive_allowed = true`; `worker-src 'self' blob:` y `'wasm-unsafe-eval'` aquí; job de retirada sobre Storage | ≥ 80 % portadas aceptables (SSIM p10 ≥ 0,95); purga probada | 3–4 |
| **8B.4** Momentos especiales | 8B.1 ✅ | Sala del perfil, Wrapped (opt-in), landing; notificaciones RET-01/02 si Víctor las prioriza | OG sin datos privados | 3–5 |
| **8B.5** Pulido y premios | Todo | Panel externo (mismas reglas, 3 voluntarias distintas); envío solo a galerías sin tasa (§10) | Media ≥ 7,5, ninguna < 7 | 2–4 |

### Estimación orientativa

| Fase | Base | +30 % |
|---|---|---|
| 8A.0 | 1–2 | 1,5–2,5 |
| 8A.1 | 3,5–4,5 | 4,5–6 |
| 8A.2 | 1,5–2,5 (1–1,5 + 0,5–1 privacidad) | 2–3,5 |
| 8A.3 | 2,2–3,4 (2–3 + 1–2 días Storybook) | 3–4,5 |
| 8A.3b | 3–5 | 4–6,5 |
| 8A.4 | 3,5–5,5 (3–5 + 0,5 ronda 2) | 4,5–7 |
| 8A.5 | 3–5 | 4–6,5 |
| 8A.6 | 0,5 | 0,5 |
| **8A en código (8A.2–8A.6)** | 13,7–21,9 ≈ **13,5–22** | **18–28,5** |
| 8B (incl. previas) | 18–26 | 23,5–34 |

corregido 2026-11-13: la columna +30 % es base × 1,3 redondeada a 0,5 hacia arriba en cada fase; los totales son la suma de cada columna (antes 8A.2 daba menos con +30 % que en base y 8B no cuadraba con su tabla). G5 usa la suma +30 % pesimista de 8A.2–8A.4: 3,5 + 4,5 + 6,5 + 7 ≈ 21,5.

Trabajo visual en 8A (V1–V8, V10, V11, sin V3b): **≈ 8–12 semanas** (≈ 7,5–11 si se recortan las ilustraciones de V6), ya repartidas dentro de 8A.0–8A.6 (no se suman). Si falta tiempo, manda el orden de recorte de §5.7. La cifra «10–14 sem» de v2 queda histórica.

---

## 5. Dirección visual

### 5.1 Panel visual (8A.1 y 8B.5)

| Aspecto | Regla |
|---|---|
| Quién | 3 personas ajenas, ≥ 1 diseñadora con portfolio publicado; sin relación laboral ni familiar con Víctor. **Voluntarias, sin pago** |
| Material | Prototipo navegable (Google Stitch o rama desechable) de la ficha 2D: día y noche, móvil y escritorio, 3 obras de formatos distintos y 1 título en escritura no latina |
| A ciegas | Puntúan por separado, sin ver otras notas ni versiones anteriores |
| Plantilla | Diseño 40 %, usabilidad 30 %, creatividad 20 %, contenido 10 %; escala 1–10 + 1 frase |
| Umbral | Media ponderada ≥ 7,5 **y** ninguna categoría < 7 |
| Acta | `docs/design/panel-YYYY-MM.md`; redacta Claude (agente), firma Víctor |
| Iteraciones | Máximo 2. **Fallo en la 2.ª ⇒ 8A sigue solo en 2D; el T1 sale de 8A; G3a valida el 2D como esté; G3b no se celebra** |

### 5.2 Biblia de dirección de arte (V1, 8A.0–8A.1)
`docs/design/BIBLIA.md` + tablero en Google Stitch.
- **Concepto:** «Archivo»: papel, cartón, latón, tinta, luz cálida; editorial, no nostálgico. Adjetivos: sobrio, táctil, preciso.
- **Moodboard:** 12–20 referencias Archivo, 6–10 Cine; anotadas y con fuente.
- **Antirreferencias:** rejilla genérica de pósters (Letterboxd/Trakt), skeuomorfismo iOS 6, glassmorphism oscuro, degradados tipo Wrapped, neón cyberpunk.
- **Contención:** por pantalla 1 material, 1 acento, 1 objeto héroe (checklist en plantilla de PR).
- **Entrecierre:** `npm run design:squint` (desenfoque 8 px sobre captura de Playwright; el máximo de contraste local cae en el `data-hero`).
- **Signatura:** código mono `FMT-AAAA-NNNN` (p. ej. `PEL-1994-0231`), igual en lista, ficha y carátula; test de `signature()`.
- **Identidad sonora:** solo texto en 8A (madera, papel, metal; 3 referencias CC0); 0 código de audio.

### 5.3 Tokens, color y contraste (8A.3)
- DTCG como fuente, OKLCH, 3 capas (primitivos → semánticos → componente). Salas cambian superficies; el acento de formato se mantiene.
- Tema Sistema/Día/Noche desde el perfil, sin parpadeo (`data-theme` en `<html>` desde el servidor).
- **Matriz de contraste:** 8A = 21 (Archivo día, Archivo noche, Cine noche; 14 en 8A.3 y Cine en 8A.4); 8B = 42 (salas solo noche; Día fuerza noche solo dentro de Cine). Superficies animadas: **3 fotogramas por sala (inicio, mínimo de luz, fin; el mínimo de luz es el peor caso)**, con reloj controlado; deben dar ≥ 5:1 (el mínimo WCAG 4,5:1 se cumple como consecuencia).
- Elevación `elev-1…3`; radios 4/8/12; espaciado 4…128 px; 0 valores ad hoc (lint).

### 5.4 Tipografía (máximo 3 familias)

| Rol | Familia | Licencia |
|---|---|---|
| Marca / interfaz | Bricolage Grotesque (variable; `KulturaDisplay` es su recorte) | OFL [V en uso] |
| Archivo (mono) | **JetBrains Mono** (alternativa con aire de máquina de escribir: **Courier Prime**) | OFL-1.1 |
| Editorial (serif) | **Newsreader** (alternativa: **Literata**) | OFL-1.1 |

- Antes de fijarlas (8A.0): comprobar *Reserved Font Name*; si lo hay, el subset se renombra o se elige la alternativa. `OFL.txt` en `public/fonts/<familia>/`. Coste 0 €.
- Figtree sale del producto. La serif es recortable (títulos en Bricolage).
- Escala 1,25 (móvil) → 1,333 (≥ 1024 px) con `clamp()`; `xs` 12 y `sm` 14 fijos. Cuerpo 16 px; `tabular-nums` en cifras.
- Otros sistemas de escritura: `font-title-fallback` (pila serif con Noto/Hiragino/Yu) y `font-ui-fallback` (sans → `system-ui`); sin descargar fuentes CJK/árabes.
- `woff2` autoalojadas, subset latín extendido, `font-display: swap`, ≤ 2 precargas por ruta, fallback métrico ⇒ CLS ≤ 0,05.

### 5.5 Movimiento
- Tokens: `dur-instant` 100, `dur-quick` 180 (hover, chips, entrada del toast; ya no abre la ficha), `dur-base` 280, `dur-flight` 320 (rango 280–350), `dur-stage` 600–750 ms **solo para entrar en una sala** (600 ms = plazo de caída a 2D).
- Ficha en 8A: crossfade `dur-base` 280 ms con CSS View Transitions y caída a crossfade simple (no `ViewTransition` experimental de React). Segunda apertura consecutiva: sin animación. Ficha usable (interactiva, foco en `<h1>`) ≤ 350 ms.
- **Interruptor Movimiento:** Sistema / Reducido / Completo (si el SO pide reducir, solo tras confirmación explícita). Reducido: ninguna animación > 100 ms; sin vuelo, paralaje ni partículas.
- **Ambiente:** botón de pausa (WCAG 2.2.2).
- **Destellos (A11Y-07):** ≤ 3 destellos por segundo; ninguna variación de luminancia > 10 % en un área > 25 % del viewport más de 3 veces por segundo. Análisis con reloj controlado (`recordVideo` → `ffmpeg` → script de luminancia).

### 5.6 Kit «Archivo 2D», ilustración y carátula (8A.3)
- **Kit (Storybook, interno):** cabecera de sala, lista-ficha, fila densa (56 px), vacío ilustrado, esqueleto, toast-sello (`aria-live="polite"`, 6 s, pausa con foco/hover, deshacer también con Ctrl/⌘+Z mientras el toast se ve, sin pila más allá de la última acción), modal-carpeta, marca de cola offline. Cada componente con estados (vacío, carga, error, día/noche, reducido) y axe sin `serious`/`critical` vía test-runner.
- **Iconos:** 7 de formato propios (24 px, trazo 1,5), siempre con etiqueta. 6 ilustraciones de estado (SVG ≤ 6 KB, recortables). Textura de papel ≤ 4 KB, opacidad ≤ 6 %.
- **Carátula generativa:** determinista por `media_id`, cartón + signatura + título + icono + 1 de 8 motivos; SVG ≤ 3 KB, `immutable`. Se usa sin portada, para hosts fuera de `CORS_OK_HOSTS` en el 3D, y para capturas, landing y premios. **Seguridad:** títulos escapados como texto XML solo en `<text>`, sin `foreignObject`, CSP `default-src 'none'`, test con títulos maliciosos.
- **OG de la ficha:** sigue con portadas reales (decisión del 2026-11-12); la carátula generativa queda preparada como respaldo si P1 obliga a retirarlas.

### 5.7 Entregables y orden de recorte

| # | Entregable | Fase | Quién | Est. [E] |
|---|---|---|---|---|
| V1 | Biblia | 8A.0–8A.1 | Víctor + Claude (agente) | 3–5 días |
| V2 | Ficha 2D alta fidelidad + prototipo | 8A.1 | Víctor | 1,5–2,5 sem |
| V3 | Tokens DTCG + build + lint + alias | 8A.3 | Claude (agente) | 4–6 días |
| V3b | Migración de 5 componentes heredados | 8A.3b | Claude (agente) | 1,5–2,5 sem |
| V4 | Tipografía | 8A.3 | Claude (agente) | 2–3 días |
| V5 | Movimiento + interruptor | 8A.3 | Claude (agente) | 3–4 días |
| V6 | Iconos, ilustraciones, textura, elevación | 8A.3 | Víctor + Claude (agente) | 1–1,5 sem |
| V7 | Kit en Storybook (montaje 1–2 días + 8 componentes) | 8A.3 | Claude (agente) | 1,5–2 sem |
| V8 | Carátula generativa + signatura | 8A.3 | Claude (agente) | 3–4 días |
| V10 | Sala Cine | 8A.4 | Víctor + Claude (agente) | 1–1,5 sem |
| V11 | Guía interna (Storybook: tokens, tipo, movimiento, kit), enlazada en el README | 8A.6 | Claude (agente) | 2 días |
| V9, V12–V15 | Sonido, salas 2–4, vuelo, ambientes, perfil/Wrapped/landing | 8B | — | dentro de 8B |

**Orden de recorte:** 1) V9 (ya en 8B); 2) ilustraciones de V6 → iconos grandes; 3) serif editorial; 4) textura de papel. **Nunca se recorta:** matriz de contraste, movimiento reducido e interruptor, pausa del ambiente, umbral de destellos, kit (V7), escapado de la carátula.

---

## 6. Uso, accesibilidad e internacionalización

### 6.1 Principios de uso diario
- **UX-01:** estado, progreso (+1) y nota desde estante, listas, inicio y búsqueda sin abrir la ficha.
- **UX-02:** deshacer con toast de 6 s (pausa con foco/hover; Ctrl/⌘+Z mientras se ve); sin modales para lo que se puede deshacer.
- **UX-03:** optimista ≤ 100 ms; sello «guardado» ≤ 300 ms en 4G simulado; revertir y reintentar si falla.
- **UX-04/05:** la animación nunca en el camino crítico; tiempos de §5.5.
- **UX-06:** una acción primaria por pantalla. **UX-07:** todo funciona igual con `?stage=0` y `?stage=1`.
- **Móvil y teclado:** sin gestos de borde propios; primarias en el tercio inferior; táctil ≥ 44 px; atajos de una tecla desactivables (WCAG 2.1.4), diálogo `?`; safe areas en la PWA.

### 6.2 Los 9 flujos
F1 primera visita · F2 buscar → añadir · F3 progreso rápido · F4 nota y diario · F5 qué sigue · F6 abrir y volver de la ficha · F7 offline · F8 compartir · F9 preferencias. Todos en 8A.3 (F6 sin vuelo, F8 sin Wrapped, F9 sin sonido).

### 6.3 Accesibilidad (WCAG 2.2 AA)
- **A11Y-01** axe bloquea `serious`/`critical` con y sin canvas. **A11Y-02** canvas `aria-hidden`, sin eventos, sin texto. **A11Y-03** foco al `<h1>` y retorno. **A11Y-04** anillo doble ≥ 3:1. **A11Y-05** una región `polite`; `assertive` solo si se pierden datos.
- **A11Y-06** matriz §5.3. **A11Y-07** destellos §5.5. **A11Y-08** interruptor. **A11Y-09** pausa del ambiente. **A11Y-10** sonido apagado por defecto; un efecto que coincide con `aria-live` se descarta (sustituye a la casilla de lector, eliminada por ser dato inferible del art. 9 RGPD).
- **A11Y-11** formato nunca solo por color. **A11Y-12** arrastre con alternativa. **A11Y-13** autenticación accesible. **A11Y-14** zoom 200 %, reflujo 320 px, espaciado 1.4.12.
- **A11Y-15** lectores por bandera: NVDA + Firefox y VoiceOver + Safari iOS; antes de cerrar 8A: TalkBack + Chrome y VoiceOver macOS (si hay Mac prestado). JAWS no aplica.

### 6.4 Internacionalización y SEO
- **I18N-01** es/en con paridad 100 %, 0 literales. **I18N-02** pseudolocale `xx` (+40 %) solo en desarrollo y test, fuera de `routing.ts`, middleware, sitemap y `hreflang`. **I18N-03** pilas de respaldo, `dir="auto"`. **I18N-04** sin texto en canvas. **I18N-05** `Intl`/ICU. **I18N-06** cambio de locale recrea el canvas sin perder estado (8B.1).
- **SEO-01 (8A.4/8A.5):** cada pantalla rediseñada conserva `title`, `description`, `canonical`, `hreflang` es/en y JSON-LD (`Movie`/`Book`/`VideoGame` en la ficha); test E2E que compara las etiquetas `<head>` antes y después por ruta; `xx` nunca en el sitemap. Dueño: Claude (agente), revisa Víctor.

### 6.5 Retención ética
Permitido: «qué sigue», actividad de amigos con opt-in, Wrapped privado por defecto, recordatorios opt-in. Prohibido: rachas que castigan, urgencia falsa, scroll infinito en el inicio, baja más difícil que el alta. RET-01 (cada notificación dice por qué llega), RET-02 (0 push sin opt-in; máx. 1/día).

### 6.6 Investigación con usuarios
- **Participantes:** 5 (3 usuarios actuales + 2 externos), remoto, 30 min, ≥ 2 en móvil, ≥ 1 con lector o movimiento reducido. R1 (G3a, fin de 8A.1): prototipo 2D frente a la app actual. R2 (G3b, 8A.4): T1 frente a 2D, contrabalanceado, mismas 5 si es posible. **Sin incentivo económico** (voluntarias); agradecimiento en créditos si lo desean.
- **Base real:** 8 usuarios registrados y 4–5 activos (cifra viva en `docs/metricas-fase8.sql`).
- **Tareas:** T1 añadir a «Pendiente» (más rápido que la actual) · T2 +1 episodio (≤ 5 s mediana) · T3 nota y diario (no más lento) · T4 qué seguir (≤ 5 s) · T5 abrir ficha y volver (nadie se pierde) · T6 cambio offline (entienden que se guardará) · T7 desactivar movimiento (≤ 30 s). Pensar en voz alta, SEQ 1–7, sin SUS.
- **Protección de datos del estudio:**
  - Consentimiento informado escrito antes de cada sesión (art. 6.1.a RGPD), solo adultos (≥ 18): finalidad, qué se graba (pantalla y voz; nunca cara salvo que la persona quiera), dónde se guarda, quién lo ve (solo Víctor) y derecho a parar y a borrar. **Para la persona que usa lector de pantalla se pide además consentimiento explícito (art. 9.2.a RGPD)**, en una casilla separada y no premarcada, porque la grabación revela el uso del lector aunque no se anote. Sin ese consentimiento explícito no se graba la sesión: se toman solo notas seudonimizadas. Plantilla y protocolo según 50 §6.4 (P-9).
  - La respuesta no se guarda junto a la grabación; las actas usan seudónimo (P1…P5) y la tabla que liga seudónimo y persona se guarda aparte y cifrada (50 §6.4).
  - Se borran **90 días** después del fin de cada ronda (50 §6.4). Videollamada con servidor en la UE o con DPA; la grabación es local, no en la nube del proveedor.
  - **Si no se consigue a la persona con lector (riesgo R15):** primero se recluta a través de una asociación de usuarios de lector, con el mismo consentimiento (incluido el art. 9.2.a). Si tampoco se consigue, Víctor hace los 9 flujos con NVDA + Firefox y VoiceOver iOS, levanta acta y lo marca como riesgo aceptado en la puerta correspondiente.
  - **Verificación:** acta de cada sesión con referencia al consentimiento firmado (y a la casilla art. 9.2.a cuando aplique) antes de la hora de inicio de la grabación; G3a no se evalúa sin P-9 cerrado.

### 6.7 Métricas de UX (agregadas, sin `user_id`)
MET-01 tiempo en tarea · MET-02 deshacer en ≤ 10 s / acciones, ventana móvil 7 días, ≤ 5 % · MET-03 acciones fuera de la ficha ≥ 70 % a 4 semanas (informativa) · MET-04 INP ≤ 200 ms y `kultura.quick_action` ≤ 300 ms · MET-05 sonido (8B) · MET-06 movimiento y bajadas a T0 ≤ 40 % · MET-07 lista densa frente a estante por formato · MET-08 cola offline ≥ 99,5 % · MET-09 entradas y retención, cada usuario consigo mismo. < 20 sesiones/semana: mediana y máximo.

### 6.8 API de acciones rápidas y preferencias
- `POST /api/library/actions` `{client_op_id, media_id, op: set_status | progress_delta | set_rating | remove, value, base_updated_at}` sobre `user_media`; idempotente por `client_op_id`; devuelve `undo_token`. `POST /api/library/actions/undo`: el cliente lo ofrece 6 s, el servidor lo acepta 60 s; `409` si hubo otra escritura. `progress_delta` como incremento. Conflicto: gana la última escritura del usuario.
- **Cola offline:** IndexedDB por `user_id`, reintentos exponenciales; `sw.js` no la procesa en 8A.
- **`public.user_preferences`:** `user_id` PK/FK, `motion` (system/reduced/full), `theme` (system/day/night), `rating_scale` enum (los valores de la escala que hay hoy), `single_key_shortcuts`, `view_by_section` jsonb, `scene_3d` (auto/2d_only), `sound` (off/on) + `volume`, `updated_at`. RLS solo el propio usuario; borrado en cascada. Caché `localStorage` `kultura.prefs.v1`; gana la última escritura. Dispositivo nuevo: silencio hasta el primer gesto. Migración en 8A.2 con test «el usuario ve lo mismo antes y después».
- Arquitectura adopta este diseño tal cual; la migración de `user_preferences` sigue el patrón de 3 PR (expandir/usar/contraer) en 8A.2.

---

## 7. Arquitectura

### 7.1 8A · 3D solo en la ficha
- Solo en `src/app/[locale]/media/[type]/[id]/`. Una sala (Cine). **T1 solo para películas**; el resto, 2D con paralaje CSS (fila propia en la tabla de movimiento reducido, con test).
- T1: portada como plano con paralaje (puntero; giroscopio solo con permiso), luz y viñeta. Sin postprocesado, profundidad, KTX2, canvas persistente ni vuelo.
- Canvas en contenedor `position:absolute` sobre la `<img>` del servidor; se desmonta al salir.
- Carga: `dynamic(() => import('@/components/stage/FichaStage'), { ssr:false })`; disparo con tier ≥ 1 y (interacción o visible + idle 3 s). Con `?lh=1` o user-agent de Lighthouse no hay import automático (segunda barrera; no sustituye a `?stage=0`).
- R3F: `<Canvas events={() => ({ enabled: false, priority: 0 })}>` + test sin `pointermove`.

### 7.2 Origen de la textura: CORS directo del proveedor
- **Hecho verificado [V]:** el 2D ya pasa portadas por `/_next/image` (`src/lib/images/poster-url.ts:30-33`; MangaDex siempre en `:93`; respaldo por defecto en `:96`, ComicVine y Steam incluidos); `next.config.mjs:199` `minimumCacheTTL` 7 días; `remotePatterns` en `:200-272` con **14 hosts** [V, contados el 2026-11-12]. AniList en `/best` siempre por el optimizador (`src/lib/best/poster.ts:25`, `OPTIMIZED_HOSTS`; corregido 2026-11-13, antes «:23»); OG descarga la portada en servidor (`src/lib/og/poster.ts`, `revalidate: 86400`). Se mantiene (decisión del 2026-11-12).
- **Regla 3D:** `src/components/stage/cors-ok-hosts.ts` exporta `CORS_OK_HOSTS`, lista comprobada en el spike **S7** (8A.1). La `<img>` de la ficha se pinta con `crossorigin="anonymous"` y la textura sale de `createImageBitmap` (una sola descarga, sin copia propia). Hosts fuera de la lista: T0 o carátula generativa. **`/_next/image` no se usa para el 3D.**
- Un host solo puede estar en `CORS_OK_HOSTS` si `posterLoader` devuelve para él una URL **directa** del CDN, nunca `/_next/image`. Hoy eso excluye `uploads.mangadex.org`, `comicvine.gamespot.com` y `*.cbsistatic.com` (`poster-url.ts:93,96`), y cualquier host que caiga al respaldo por defecto (Steam).
- **Test `tests/unit/stage/cors-ok-hosts.test.ts`:** (a) cada host está en `remotePatterns`; (b) host fuera ⇒ `textureSource()` = `null`; (c) `textureSource()` nunca devuelve `/_next/image` ni Storage en 8A; (d) para cada host de la lista, `posterLoader({src, width: 780})` no empieza por `/_next/image`.
- **Umbral:** qué porcentaje de las entradas de `user_media` **de tipo película** (T1 solo cubre películas en 8A) cae en T0 por CORS; si > 20 %, se reabre con legal.
- CSP sin cambios en 8A (`img-src 'self' data: blob: https:` [V `src/lib/csp.ts:123`]).

### 7.3 Retirada de un proveedor en 8A
Quitarlo de `CORS_OK_HOSTS`, `remotePatterns` y su rama de `poster-url.ts`; invalidar la caché del optimizador (redeploy o invalidación por URL de origen); un test lee las tres listas. Mejor esfuerzo ≤ 7 días. Job sobre Storage solo en 8B.3.

### 7.4 Política por proveedor (tabla única; PR 8A.2-5)

```sql
create type public.license_basis as enum (
  'api_hotlink',    -- por defecto: solo enlace al CDN del proveedor, sin copia
  'cache_allowed',  -- copia/caché propia; derivados según derive_allowed
  'licensed',       -- licencia expresa
  'own_art'         -- arte propio (carátula generativa)
);

create table public.provider_art_policy (
  provider             text primary key,  -- tmdb, rawg, comicvine, anilist, mangadex, myanimelist, openlibrary, google_books, steam
  license_basis        public.license_basis not null default 'api_hotlink',
  derive_allowed       boolean not null default false,  -- KTX2 / recodificación propia
  depth_allowed        boolean not null default false,  -- mapa de profundidad
  attribution_required boolean not null,                -- true en TMDB, RAWG, ComicVine, AniList, MangaDex, MyAnimeList
  attribution_text     text,
  verified_at          date,
  evidence_path        text,   -- ruta al documento de términos, permiso del proveedor o respuesta legal; obligatoria si derive_allowed
  updated_by           text not null,                   -- 'Víctor'
  notes                text,   -- enlace a la fila de la matriz legal
  check ((derive_allowed or depth_allowed) is false
         or license_basis in ('cache_allowed','licensed','own_art')),
  check (depth_allowed is false or derive_allowed),
  check (derive_allowed is false or evidence_path is not null)
);

alter table public.provider_art_policy enable row level security;
-- lectura pública, escritura solo service_role
```

- Se adelanta a **8A.2** (firme) con todas las filas en `api_hotlink`/`false`, para la atribución. `media_art`, trigger e índice: 8B.3.
- Tests: `tests/unit/legal/license-basis.test.ts` (migración = enum), `tests/unit/legal/attribution.test.ts` (texto y `href` del crédito por proveedor), test SQL de RLS.
- Solo Víctor cambia filas, siempre con `evidence_path`. El pipeline de 8B.3 solo procesa `derive_allowed`.

### 7.5 8B (resumen)
- **8B.1:** canvas en `[locale]/layout.tsx`, vuelo ≤ 350 ms interrumpible, store mínimo.
- **Tiers:** T0 = 2D; T1 = plano, DPR ≤ 1,5; T2 = completo, DPR ≤ 2. 30 frames de calentamiento, vsync = mediana; T2 si p95 ≤ 1,0 vsync, T1 si ≤ 1,5; bajada en caliente si p95 > 2 × vsync durante 2 ventanas de 120 frames. Caché `{tier, v, ts}` 14 días.
- **Pérdida de contexto:** Sentry (error) + RUM 3D (tasa).
- **8B.3:** CSP con `worker-src 'self' blob:` y `'wasm-unsafe-eval'`; SW `kultura-tex` 25 MB LRU solo `cors` 200, que sobrevive a `VERSION` (`staleCacheNames` excluye también `PERSISTENT_CACHES`); bucket `art/<pipeline_version>/<sha256>.ktx2` inmutable; migraciones en 3 PR.
- **Banderas:** `F8_<PANTALLA>` (`F8_FICHA_T1`, `F8_FLIGHT`, `F8_PERSISTENT`, `F8_DEPTH`, `F8_ART`, `F8_FILTROS`); ≤ 14 días al 100 %, ≤ 45 días hasta borrar; **máximo 3 vivas**; `F8_STAGE` y `F8_SOUND` operativas (Q36). Día 45 sin borrar: revertir o excepción con caducidad.

---

## 8. Rendimiento y CI

### 8.1 Presupuestos (gzip)

| Ruta | JS antes del LCP | Script total en traza | CLS |
|---|---|---|---|
| Públicas sin 3D | ≤ 150 KB | ≤ 150 KB | ≤ 0,05 |
| Ficha sin parámetro | ≤ 150 KB (única métrica) | — | ≤ 0,05 |
| Ficha `?stage=0` | ≤ 150 KB | ≤ 160 KB | ≤ 0,05 |
| Ficha `?stage=1` | ≤ 150 KB | ≤ 410 KB | ≤ 0,05 |
| N1 con sesión | ≤ 170 KB | ≤ 170 KB | ≤ 0,05 |
| Perfil público `/u/[username]` | ≤ 150 KB | — (solo CLS, a11y y SEO) | ≤ 0,05 |

`?stage=0|1` solo con `NEXT_PUBLIC_STAGE_QUERY=1` (CI y previews), nunca en producción.

**Por chunk** (módulo centinela, build de CI con webpack): T1 ≤ 250, T2 ≤ 90 (8B, solo si un spike justifica postprocesado), wasm Basis ≤ 200 (8B.3, `public/stage/<hash>/basis_*`, `immutable`), sala ≤ 300 KB (audio aparte ≤ 150 KB, 8B). Sumas de referencia 550 (8A) / 840 (8B); **rompe el chunk, no la suma**. Memoria: T1 ≤ +150 MB, T2 ≤ +250 MB sobre `?stage=0`. En 8A el SW no cachea imágenes.

### 8.2 Qué rompe el CI y qué avisa

| Comprobación | Rompe | Avisa |
|---|---|---|
| JS antes del LCP | > 150 KB gzip (170 en N1); falla si un script mide `transferSize` 0 | > 135 KB |
| Ficha `?stage=0`, script total | > 160 KB | — |
| Ficha `?stage=1`, script total | > 410 KB gzip | — |
| Por chunk: T1 / T2 / wasm / sala | > 250 / 90 / 200 / 300 KB; centinela no encontrado; build con Turbopack | ≥ 90 % |
| CLS (todas las URL de Lighthouse) | > 0,05 | — |
| Lighthouse a11y y SEO (ficha `?stage=0`, `/es/u/lucia_lee`) | < 0,95 | — |
| axe | `serious`/`critical` | `moderate` |
| Cabecera `immutable` en `public/stage/<hash>/**` | ausente | — |
| SW: `tests/unit/pwa/sw.test.ts` | cualquier fallo | — |
| Canvas sin `pointermove` | listener presente | — |
| Snapshots visuales de Playwright | diff no aprobado | — |
| Storybook test-runner (axe en historias) | `serious`/`critical` | — |
| LCP / TBT de laboratorio | — | > 2,5 s / 300 ms (3,0 s / 600 ms con `?stage=1`) |
| Frames, memoria, INP, captura de fotogramas | **nunca en CI** | — |
| Peso de audio (8B) | sobre presupuesto | — (LUFS por script local) |

Lighthouse: `@lhci/cli@0.15.1` [V], job con `timeout-minutes: 20` [V]; aserción para `/es/(media/.+\?stage=0|u/lucia_lee)$` con CLS ≤ 0,05, a11y ≥ 0,95 y SEO ≥ 0,95 (`median-run`). Solo en PR que toquen cliente; resto nocturno; alerta al 80 % de la cuota gratuita de minutos.

**SW:** `tests/unit/pwa/sw.test.ts` [V] ya ejecuta el `public/sw.js` real en `node:vm` con `MemoryCache` y `fetch` simulado. **No se crea arnés nuevo; se amplían sus casos:** 8A.2 «no se cachea ninguna imagen»; 8B.3 `kultura-tex` sobrevive a `activate` con otro `VERSION`, LRU por bytes a 25 MB, `opaque` y no-200 nunca se guardan.

**Snapshots visuales:** `toHaveScreenshot` de Playwright en contenedor Linux fijo (fuentes y versión de navegador congeladas), referencias en el repo, actualización solo con PR etiquetado. Sustituye a Argos.

### 8.3 Dispositivo real (G1)

| Clase | Modelo | Navegador |
|---|---|---|
| iOS bajo | iPhone 11 o SE 2.ª gen | Safari + PWA |
| Android bajo | Moto G (4 GB) | Chrome |
| Escritorio | Portátil actual (gráfica integrada) | Chrome, Firefox (y Safari si es Mac) |
| iOS medio | iPhone 13 | Safari |
| iOS 120 Hz | iPhone 15 Pro | Safari |
| Android medio | Pixel 7a | Chrome |

- **Todos físicos:** propios o **prestados** (amigos, familia, comunidad local); segunda mano solo si no hay otra vía y con «sí» de Víctor.
- **Depuración remota gratuita:** Android con `chrome://inspect` por USB y `adb shell dumpsys meminfo`; iOS con Safari Web Inspector si hay Mac (propio o prestado) o, sin Mac, `ios-webkit-debug-proxy` (libre) + DevTools; memoria iOS sin Mac aproximada y documentada como tal.
- **Método:** frames con `?stage=1&perf=1` (recorrido guionizado de 60 s, JSON, p95 en vsync); memoria = pico `?stage=1` − pico `?stage=0`, misma sesión; pérdida de contexto en 10 min + 20 cambios de app; térmica a los 10 min.

### 8.4 Campo
- **Vercel Speed Insights** [V]: LCP, INP, CLS, TTFB p75 por ruta. **Sentry** [V]: `webglcontextlost` y errores de shader.
- **RUM 3D** (`/api/rum/stage`, sin cookies, sin `user_id`, sin IP almacenada, `sendBeacon`, ≤ 200 B). Campos (50 y `/privacy` los copian literalmente):

| Campo | Valores |
|---|---|
| `tier_inicial` | 0, 1, 2 |
| `bajadas` | 0, 1, 2 |
| `frame_p95_vsync` | redondeado a 0,25 |
| `perdida_contexto` | booleano |
| `vsync_hz` | cubos `≤45`, `60`, `≥90` |
| `ruta` | patrón (`/media/[type]/[id]`), nunca el id |
| `version_build` | hash corto del build |
| `w` | peso = 1 / tasa de muestreo aplicada |

  Prohibidos: UA completo, `WEBGL_debug_renderer_info`, `deviceMemory`, resolución. Muestreo dictado por el servidor (`data-rum-rate`: 1,0 hasta 1.000 sesiones ponderadas al mes, 0,25 después); los agregados suman `w`. Almacenamiento: `rum_stage_daily(dia, ruta, tier_inicial, n_ponderado, perdidas_ponderadas, bajadas_ponderadas, frame_p95_hist jsonb)`, sin filas por sesión, retención 90 días.
- **RUM de UX (separado):** la marca `kultura.quick_action` va a `/api/rum/ux` (campos: `ruta` patrón, `dur_bucket` de 50 ms, `w`), con tabla agregada `rum_ux_daily` y retención de 90 días. El INP de las pantallas sigue en Speed Insights. Se instrumenta en 8A.2, antes de rediseñar nada.
- **Alertas de coste:** 8A solo Vercel Spend Management (aviso, no pausa) a 50 $/mes. 8B.3 añade Supabase Storage (aviso al 50 % de la cuota de egress, job semanal que abre un issue).

### 8.5 Umbrales de campo para G4

| Métrica | Fuente | Pasa | Revisar | Falla |
|---|---|---|---|---|
| Retención (condición dura) | producto | no baja | — | baja |
| Entradas por usuario activo (condición dura) | producto | no baja | — | baja |
| LCP p75 ficha | Speed Insights | ≤ 2,5 s y ≤ base + 10 % | 2,5–3,0 s | > 3,0 s |
| INP p75 ficha | Speed Insights | ≤ 200 ms | 200–300 | > 300 |
| CLS p75 ficha | Speed Insights | ≤ 0,05 | 0,05–0,1 | > 0,1 |
| Pérdida de contexto | RUM 3D + Sentry | < 1 % | 1–3 % | > 3 % |
| Bajada a T0 | RUM 3D | ≤ 40 % | 40–60 % | > 60 % |
| Frame p95 (mediana T1) | RUM 3D | ≤ 1,0 vsync | 1,0–1,5 | > 1,5 |
| Errores Sentry / 1.000 sesiones ficha | Sentry | ≤ base + 10 % | +10–50 % | > +50 % |

Línea base: todo lo medido desde el fin de 8A.2 (cuando llega la instrumentación) hasta encender 8A.4 al 100 %; **mínimo 4 semanas**; Sentry/TTFB/5xx desde la fase 10 del saneamiento. Si al encender no hay 4 semanas, se espera (corregido 2026-11-13: antes «8 semanas antes de 8A.4», imposible porque la instrumentación llega en 8A.2).

### 8.6 Métricas de valor (SQL de solo lectura, `docs/metricas-fase8.sql`)
Activos a 30 días (G6), entradas por usuario activo semanal, retención a 4 semanas y cobertura de portadas por host (G0), sobre `public.user_media` y `public.media.poster`. Partida [V]: 124 entradas, 8 usuarios, 4 activos a 30 días. Con 4–8 activos las cifras son **direccionales** y se dan en absolutos.

### 8.7 Spikes

| # | Fase | Pregunta | Éxito | Días |
|---|---|---|---|---|
| **S7** (AVIF/WebP + CORS) | 8A.1, antes del panel | ¿Qué hosts de los 14 de `remotePatterns` envían CORS válido para WebGL y cuánto pesan? | `CORS_OK_HOSTS` con test; % de entradas de película cubiertas | 2 |
| **S10** Shaders/texturas | 8A.1, antes del panel | ¿Tirones al compilar y subir? | Ningún frame > 50 ms; INP abrir ficha ≤ 200 ms | 2 |
| S1 Bundle | 8A.1, tras panel | ¿Peso de T1 y JS antes del LCP? | ≤ 150 / 160 / 250 KB | 2 |
| S3 Dispositivo | 8A.1, tras panel | ¿T1 cumple en 6 modelos? | Umbrales de G1 | 3 |
| S5 CSP/SW sin imágenes | 8A.1, tras panel | ¿SW, canvas y CSP actuales conviven en Safari iOS/PWA/Android? | 0 violaciones sin cambiar la CSP; offline con carátulas | 1 |
| S6 a11y | 8A.1, tras panel | ¿Accesible y comprensible? | 0 `serious`/`critical`; 4/5 entienden | 2 + sesiones |
| S9 RUM 3D | 8A.1, tras panel | ¿Llega y es útil sin fingerprinting? | ≥ 95 % llegan; ≤ 200 B; ±5 % tras cambio de tasa | 2 |
| S2 Canvas persistente | previa 8B.1 | ¿Sobrevive en el layout? | 0 recreaciones en 20 navegaciones; CLS ≤ 0,05 | 4–5 |
| S4 Profundidad | previa 8B.3, solo con G0 | ¿Aceptable y barata? (Depth Anything V2 Small) | ≥ 80 % nota ≥ 4; ≤ 25 KB | 3 |
| S7-KTX2 | previa 8B.3 | ¿ETC1S o UASTC? | SSIM p10 ≥ 0,95; ≤ 30 ms en iPhone 11 | 2 |
| S5 completo | previa 8B.3 | ¿Worker `blob:` y `kultura-tex`? | 0 violaciones; 25 MB respetados | 2 |
| S8 Coste | previa 8B.3 | ¿Coste a 1k/10k MAU? | Egress 10k MAU ≤ 200 GB/mes | 1 |

Todos en rama desechable; Claude (agente) prepara, Víctor ejecuta en dispositivo y firma. **Antes del panel solo S7 y S10.**

---

## 9. Legal y privacidad

> No es asesoría legal: es un plan de cumplimiento. KULTURA es un proyecto personal **sin actividad económica** (`messages/es.json:1892`) con 8 usuarios registrados y 4–5 activos.

### 9.1 Lo que ya ocurre (fila «hoy»)

| Proveedor | Hosts | Ruta hoy en 2D | Copia recodificada en Vercel | OG |
|---|---|---|---|---|
| TMDB | `image.tmdb.org` | Directo; optimizador si la ruta no encaja | Rara | Sí |
| RAWG | `media.rawg.io` | Directo | Rara | Sí |
| AniList | `s4.anilist.co` | Directo; **optimizador en `/best`** | Sí (en `/best`) | Sí |
| Open Library | `covers.openlibrary.org` | Directo | No | Sí |
| MyAnimeList | `cdn.myanimelist.net`, `myanimelist.net` | Directo desde `cdn.`; el otro al optimizador | Parcial | Sí |
| Google Books | `books.google.com`, `books.googleusercontent.com`, `*.googleusercontent.com` | Directo | No | Sí |
| **MangaDex** | `uploads.mangadex.org` | **Siempre optimizador** | **Sí** | Sí |
| **ComicVine** | `comicvine.gamespot.com`, `*.cbsistatic.com` | **Siempre optimizador** | **Sí** | Sí |
| **Steam** | `*.steamstatic.com`, `shared.akamaihd.net` | **Optimizador** | **Sí** | Sí |

Total: 14 hosts en `remotePatterns` [V]. `/privacy` (`es.json:1742`) hoy no cuenta el optimizador ni las OG, y Vercel figura como encargado (`:1731`) solo para alojamiento y medición.

### 9.2 Acción inmediata (8A.0, lo primero)

| ID | Acción | Resp. |
|---|---|---|
| D-HOY-1 | Inventario por entradas y host (`docs/legal/hoy-inventario.sql`) + componentes `next/image` sin `loader` | Claude (agente) |
| D-HOY-2 | Decisión escrita en `docs/legal/decision-hoy.md`: **opción (a), mantener como está** (portadas reales, optimizador y OG), riesgo asumido por Víctor el 2026-11-12 hasta la respuesta a P1 | Víctor |
| D-HOY-3 | `/privacy` corregido (§9.3) en el PR 8A.0-P (P-7) | Claude (agente) redacta, Víctor aprueba |
| D-HOY-4 | Vercel como encargado de optimización y caché de imágenes y OG (P-10), mismo PR | Víctor |
| D-HOY-5 | P1 formulada como «esto ya ocurre: ¿es aceptable?» | Víctor |

### 9.3 Texto para `/privacy` (es; en.json equivalente)
- Final de `privacy…p3`: «Las consultas las hace el servidor de KULTURA con el texto de la búsqueda, sin tu IP ni tu cuenta. Las portadas se muestran de dos formas: muchas se cargan directamente desde los servidores de imágenes de esos catálogos, que reciben tu IP como al visitar cualquier web; otras pasan por el servicio de imágenes de Vercel, que las descarga, las adapta al tamaño de tu pantalla y guarda una copia temporal (hasta 7 días) para servirlas más rápido. En ese caso el catálogo no recibe tu IP. Las imágenes para compartir enlaces pueden incluir la portada del título.»
- Encargado: «**Vercel** (Vercel Inc., EE. UU.): alojamiento de la web, con el servidor en Fráncfort (UE), medición de visitas y optimización y caché temporal de imágenes, incluidas las imágenes para compartir enlaces.»
- En 8A.2 (P-4, P-6): párrafos de **Preferencias** y de **Rendimiento de la vista 3D** (nivel gráfico 0–2, fotogramas en intervalos redondeados, frecuencia de pantalla en tramos ≤ 45/60/≥ 90 Hz, reinicio del gráfico, página y versión; sin cuenta, IP ni navegador completo; solo totales por día) y de la medición agregada de acciones rápidas (`/api/rum/ux`).
- `privacy.updated` con la fecha del PR (P-11).

### 9.4 Matriz por proveedor y regla por defecto
Por proveedor: uso comercial, atribución, caché, derivados, estado (`[PV]` pendiente de verificar o `[V-fecha]` con copia en `docs/legal/terminos/`). MangaDex, ComicVine y AniList «no comercial»; MangaDex con riesgo alto por procedencia (P7); Jikan/MAL y JustWatch en P8. **Mientras una celda diga [PV]:** no se añade caché propia nueva, derivados ni uso en premios; lo que ya ocurre continúa según D-HOY-2. M1 (lectura y copia fechada de términos) en 8A.0; revisión cada 6 meses.

### 9.5 Permitido en 8A y bloqueado hasta G0
- **Permitido en 8A:** rediseño 2D sin ampliar hosts ni usos del optimizador; T1 con textura directa en `CORS_OK_HOSTS`; color dominante y blurhash solo en cliente; carátula generativa; atribución (AT); `provider_art_policy` (8A.2); `LICENSES.csv`/`NOTICE`; paquete P-x.
- **Bloqueado hasta G0:** copia en Supabase Storage, CDN propia o SW (`kultura-tex` en 8B.3); KTX2 y profundidad sobre portadas de terceros; portadas reales en premios, promoción o redes; cualquier proveedor «no comercial» en algo con ingresos.
- **Atribución:** TMDB (logo + aviso), RAWG, ComicVine, AniList, MangaDex, MyAnimeList (enlaces activos) y JustWatch en «Dónde ver»; en ficha 2D y 3D (capa DOM). Test `tests/unit/legal/attribution.test.ts`. **Con la ficha de 8A.4.**
- **Retirada:** §7.3; canal para titulares en `/legal` con respuesta ≤ 7 días.

### 9.6 Encargo legal (G0) sin coste
- **Encargo mínimo:** P1 (lo que ya ocurre, por proveedor; ¿y ampliar a copia propia?), P2 (¿recodificar es reproducción o transformación? ¿el optimizador es caché o derivado?), P4 (¿3D sin copia cambia algo frente al 2D?), P7 (MangaDex), P8 (Jikan/MAL y JustWatch), P14 (qué convierte el proyecto en comercial). Opcionales: P3, P5, P6, P9–P13.
- **Vías gratuitas, en paralelo:**
  1. **Clínicas jurídicas universitarias** (facultades de Derecho con clínica de propiedad intelectual o protección de datos) y servicios de orientación gratuita de colegios de abogados.
  2. **Permiso por escrito de cada proveedor** (correo a su contacto de API), guardado como `evidence_path`.
  3. **Revisión de términos** (M1), con copia fechada.
- **Respuesta válida** = informe escrito de asesoría jurídica a las 6 preguntas, o permiso escrito del proveedor para lo que se pretende con él. **Sin respuesta válida ⇒ NO-GO en G0.** El NO-GO es seguro: 8A no cambia.
- Si se quisiera pagar un abogado, es un gasto opcional con «sí» propio.

### 9.7 Privacidad (P-1…P-11)

| # | Requisito | PR |
|---|---|---|
| P-1 | `localStorage` solo caché de arranque de preferencias; inventario + test | 8A.2-P1 |
| P-2 | Sin fingerprinting (tier, vsync, WebGL sin identificadores) | 8A.2-P2 |
| P-3 | Analítica agregada; `user_id` solo con LIA, opt-out y ≤ 13 meses | — |
| P-4 | Preferencias en el perfil (art. 6.1.b), RLS, borrado en cascada; deshacer ≤ 60 s | 8A.2-P1 |
| P-5 | Sin casilla «Uso lector de pantalla» (art. 9); test | 8A.2-P1 |
| P-6 | RUM 3D con los campos de §8.4 (más `/api/rum/ux`) | 8A.2-P2 |
| P-7 | `/privacy` cuenta optimizador y OG | **8A.0-P** |
| P-8 | Wrapped, sala pública y OG de perfil privados por defecto (diseño) | 8A.2-P3 |
| P-9 | Estudio con usuarios (§6.6) | **8A.1, antes de R1** |
| P-10 | Vercel encargado de imágenes y OG; nuevos encargados en el PR que los añada | **8A.0-P** |
| P-11 | Fecha, historial, banner si amplía, es/en juntos, test | 8A.2-P4 |

Campos RUM en `/privacy` (copia literal de §8.4): `tier_inicial` ∈ {0,1,2}, `bajadas` ∈ {0,1,2}, `frame_p95_vsync` (redondeado a 0,25), `perdida_contexto` (bool), `vsync_hz` en cubos `≤45`/`60`/`≥90`, `ruta` (patrón, sin ids), `version_build`, peso `w`. Sin `user_id`, sin UA completo, sin IP guardada. Solo agregados diarios en `rum_stage_daily`, retención 90 días; no se guardan eventos por sesión.

### 9.8 Recursos y accesibilidad legal
- Ningún recurso sin fila en `assets/LICENSES.csv` (test sobre `public/` y `assets/`). Fuentes OFL; sonidos CC0/CC-BY (8B); modelos 3D CC0/CC-BY/propios; IA generativa solo con términos que permitan la salida; Depth Anything solo Small.
- Blender MCP y herramientas nuevas: fuera por defecto; cada MCP nuevo con «sí» de Víctor.
- EAA probablemente no aplica (sin actividad económica); objetivo WCAG 2.2 AA igualmente. `/accessibility` se actualiza con cada pantalla, primera vez con la ficha de 8A.4.

---

## 10. Costes

Objetivo ≈ **0 €/mes**. Gastos únicos solo si son inevitables y con «sí» de Víctor.

| Concepto | Antes (v3.1) | Alternativa elegida | Mensual | Único |
|---|---|---|---|---|
| Diseño | Figma ~15 $/mes | **Google Stitch** (Google Labs, gratuito con cuenta Google; genera pantallas y exporta HTML/CSS). No subir datos de usuarios reales | 0 | 0 |
| Regresión visual | Argos ~30 $/mes | **Snapshots de Playwright** en CI | 0 | 0 |
| Banco de dispositivos | BrowserStack ~39 $/mes | **Dispositivos físicos** propios o prestados + depuración remota gratuita (§8.3) | 0 | 0 (segunda mano solo si no hay préstamo; opcional) |
| Fuentes | 0–300 € | **Newsreader** + **JetBrains Mono** (OFL; alternativas Literata, Courier Prime) | 0 | 0 |
| Guía de diseño | — | **Storybook** + addon-a11y + test-runner | 0 | 0 |
| Incentivos de usuarios | 200 € | **Voluntarios sin pago** | 0 | 0 |
| Panel visual | 0–90 € + 0–90 € | **Voluntarias sin pago** | 0 | 0 |
| Premios | ≤ 150 € de tasas | **Solo galerías y premios sin tasa** (verificar al enviar). Awwwards, CSS Design Awards y similares con tasa: **opcionales** | 0 | 0 (opcional con «sí») |
| Asesoría legal | ≤ 600 € | **Clínicas jurídicas universitarias**, permisos escritos de proveedores, revisión de términos | 0 | 0 |
| Plan Vercel / optimización de imágenes | 0 si cabe | Se confirma en 8A.0 (`docs/ops/vercel-plan.md`); alerta a 50 $ | 0 | — |
| Minutos de CI | 0 si ≤ cuota | Lighthouse solo en PR de cliente; resto nocturno; alerta al 80 % | 0 | — |
| Supabase Storage (8B.3) | — | Dentro de la cuota del plan actual; alerta al 50 % del egress | 0 | — |
| **Total 8A** | 50–80 $/mes + 500–1.330 € + legal | | **≈ 0 €** | **0 €** |
| **Total 8B** | panel + premios + BrowserStack | | **≈ 0 €** | 0 € (tasas de premios opcionales) |

Cualquier gasto no listado necesita un «sí» propio.

---

## 11. Riesgos

| # | Riesgo | P | I | Mitigación | Puerta |
|---|---|---|---|---|---|
| R1 | Legal prohíbe caché/derivados propios | A | M | 8A no los usa; carátula generativa; `provider_art_policy` | G0 |
| **R1b** | **Uso actual del optimizador (MangaDex, ComicVine, Steam, AniList en `/best`) y OG con portadas reales.** Legal (apartado 50) lo considera **incumplimiento actual**. **Riesgo asumido por Víctor el 2026-11-12** | M | M | Declarado en `/privacy` (P-7, P-10) en 8A.0; P1 al asesor; retirada ≤ 7 días si un titular o proveedor lo pide (§7.3); carátula generativa preparada para OG | G0 |
| R2 | Métricas de valor = ruido con 4–8 activos | A | M | «No empeora» duro; absolutos; sin percentiles < 20 sesiones/sem | G4 |
| R3 | Alcance > estimación (8A.3b) | A | A | +30 %; G5 como revisión de alcance; 3 banderas; orden de recorte | G5 |
| R4 | Safari iOS: memoria/contexto | M | M | Caída a 2D; RUM < 1 %; DPR ≤ 2 | G1 |
| R5 | Bandera > 60 días o `F8_STAGE` sin Q36 | M | M | 14/45; dueño Víctor; revisión trimestral | — |
| R6 | El rediseño baja entradas | M | A | Acciones rápidas; `quick_action` con línea base | G3a, G4 |
| R7 | Divergencia 2D/3D | M | M | 2D fuente de verdad; snapshots | — |
| R8 | Coste de oportunidad | A | A | 8A acotada; G6 con ≥ 12 activos | G6 |
| R9 | Accesibilidad | M | A | axe; NVDA + Firefox, VoiceOver iOS en R1/R2 | G3 |
| R10 | CJK/RTL y textos largos | M | B | Pseudolocale; pilas de respaldo | — |
| R11 | Mezclar arreglo y función | M | M | Tipo por PR; 12.7 | — |
| R12 | Dependencias con fallos | B | M | `npm audit`; versiones exactas | — |
| R13 | Solapamiento con saneamiento | M | B | Criterio de §4 (H20) | — |
| R14 | Respuesta legal tarde, ambigua o inexistente (vías gratuitas más lentas) | A | M | 8A no depende; permisos de proveedores en paralelo; sin respuesta ⇒ NO-GO | G0 |
| R15 | No se reclutan 5 personas o ninguna con lector (sin incentivo) | M | M | Reclutar en 8A.0; asociación de usuarios de lector; si no, Víctor hace los 9 flujos y riesgo aceptado; con 3 personas, «direccional» | G3a, G3b |
| R16 | RUM/analítica amplían tratamiento sin `/privacy` | B | A | P-6 y P-11 condición de salida de 8A.2; P-7/P-10 en 8A.0 | 8A.2 |

---

## 12. Dependencias

| De | Necesita | Dueño |
|---|---|---|
| 8A.2 | Fases 9, 10 y 12 del saneamiento cerradas; 12.3 activa antes de la primera bandera | Víctor |
| 8A.2 | G1 y G3a ✅ | Víctor |
| T1 (8A.4) | `CORS_OK_HOSTS` de S7; escena Cine y carátula antes del chunk T1; G3b | Claude (agente) / Víctor |
| G1 | 6 dispositivos disponibles (propios o prestados) | Víctor |
| G3a | P-9 cerrado; 5 participantes | Víctor |
| G0 | Respuesta válida de asesoría o permisos de proveedores | Víctor |
| 8B | G2, G3b, G4, G6; 8B.3 además G0 | Víctor |
| Arquitectura | Acciones rápidas, deshacer, cola offline y `user_preferences` según §6.8 | Claude (agente) |
| Legal | Enum y tabla de §7.4; campos RUM de §8.4 | Claude (agente) |
| Operación | Cuota de Vercel Image Optimization; egress Supabase (8B); `SUPABASE_SERVICE_ROLE_KEY` en la Action (8B.3) | Víctor |

**RACI (una persona):** código, PRs e informes de puerta: hace Claude (agente), revisa otro agente en G1/G3/G4, decide Víctor. Reclutamiento, panel, encargo legal: Víctor. `f8-mant`, plan de Vercel, cuotas y CI: hace Claude (agente), revisa y decide Víctor.

**Q1 provisional:** solo Cine en 8A; salas 2–4 en 8B.2 con ≥ 300 entradas o 8 semanas de analítica por formato. **Fuera salvo spike (≤ 2 días):** IA generativa, Meshy, Blender MCP, Depth Anything y KTX-Software (se reactivan si S4/S7-KTX2 pasan), `@gltf-transform`, `@react-three/postprocessing`, `detect-gpu`, `zustand`, sonido de pago.

---

## Anexo A · Prototipo 1
- Artifact privado: https://claude.ai/artifact/Hnz4agPThz7S7jAimf3C9z
- Hecho con three r128 suelto, sin R3F, así que su rendimiento no se puede trasladar tal cual a la app.
- Las 5 portadas reales van incrustadas: los artifacts bloquean imágenes de otros dominios.

## Anexo B · Notas de revisión

| Apartado | Ronda 1 | Ronda 2 |
|---|---|---|
| Visual | 7,6 | 9,4 |
| Uso y accesibilidad | 7 | 9 |
| Arquitectura | 7 | 8,4 |
| Rendimiento | 6,2 | 9,2 |
| Legal | 6,5 | 8,6 |
| Fases | 6,5 | 8,2 |
| Coherencia global | — | 8 |

Las correcciones de ronda 2 están aplicadas en este documento. Cambios posteriores por decisión de Víctor (2026-11-12): portadas reales mantenidas (sustituye la recomendación (b) de legal y el paso de MangaDex a `unoptimized`), coste ≈ 0 con alternativas libres, sin fechas límite (G0 y G5 sin fecha), Storybook interno y 8A.3b oficial.
