# KULTURA 2.0 — Sistema de diseño (F2, paso 5 de §6.1)

**Estado:** v1.0 · 2026-11-07 · **aprobado por Víctor (D-F2o).** Revisión independiente: Artisan y Advocate, 2 pasadas, **pasa** (`04_DECISIONES` §4).
**Sustituye a** `DISENO.md` (raíz) para todo lo que se construya en `src/v2/`. `DISENO.md` no se borra (regla 3): sigue describiendo la UI v1 y sus tests hasta que la v2 sirva el 100 % y exista la etiqueta `v1-ui`.
**Manda:** `02_DISEÑO_BRIEF.md` v1.2 (reglas K, I, D, R, B, M, P y X) y la dirección aprobada **A2b «Encuadre con pista»** (`prototipos/f2-tiles/A2b.html`, D-F2h). Este documento no inventa estilo: fija en tokens lo que A2b ya demostró y cierra la deuda que dejó D-F2h.
**Demostración viva (D1):** `prototipos/f2-sistema/muestra.html` con `tokens.css`. Probada el 2026-11-07 (§10).
**Evidencia:** contrastes calculados con la fórmula WCAG 2.x sobre los hex de `tokens.css` (script en §10); tamaños medidos con `getComputedStyle` en Chromium (Playwright del repo). Lo no medido lleva **(no verificado)**.

---

## 1. Principios (lo que el sistema protege)
1. **La portada es la escena; la interfaz es el encuadre.** Color fijo = neutros; el único color con tono sale de la portada (K5).
2. **El progreso es la firma (K8).** La pista y su etiqueta son el único objeto gráfico propio. Sirven a los 7 formatos (P3).
3. **Profundidad sin WebGL.** Capas por luminancia, inclinación B1 y K4; WebGL solo suma (M5).
4. **Un token o nada.** En `src/v2/` no hay literales de color, tamaño, curva ni duración fuera de `tokens.css` (rúbrica 9).

## 2. Color

### 2.1 Tokens fijos
| Token | Valor | OKLCH | Uso | Contraste (s0 / s1 / s2 / s3) |
|---|---|---|---|---|
| `--s0` | `#0a0a0a` | L14 | sala, fondo de página | — |
| `--s1` | `#151515` | L20 | superficie (filas, paneles) | — |
| `--s2` | `#212121` | L25 | elevada (botón tranquilo, campo) | — |
| `--s3` | `#2b2b2b` | L29 | **flotante** (menú, hoja, diálogo); la única con sombra (X17) | — |
| `--ink` | `#f2f0eb` | L95,5 | texto, foco, contorno del tramo actual | 17,4 / 16,0 / 14,1 / 12,4 |
| `--muted` | `#a19d96` | L69,7 | texto secundario | 7,3 / 6,8 / 6,0 / 5,2 |
| `--rail-todo` | `#6b6b6b` | L52,8 | tramo pendiente de la pista | 3,7 / 3,4 / 3,0 / **2,7 ✗** |
| `--error` | `#ff9d8f` | L79 H29 | error, siempre con icono y texto | 9,9 / 9,1 / 8,0 / 7,1 |
| `--scene-fallback` | `#b8ab95` | L74,6 C0,034 (A2b lo redondeaba a L73 y 8,9:1) | reserva del acento y «sin portada» | 8,8 con `--on-scene` |
| `--on-scene` | `#0a0a0a` | — | texto sobre `--scene` | — |
| `--rail-done` | `= --scene` (`= --ink` con más contraste) | — | tramo visto | ≥ 3:1 con s1 (lo garantiza el pipeline) |
| `--scrim` | `rgb(10 10 10 / .7)` | — | fondo tras un diálogo modal | — |
| `--brand` | `#f2f0eb` | — | logotipo fijo (icono de app, favicon, OG) | — |
| `--focus` | `= --ink` | — | anillo de foco; **nunca `--scene`** (K5) | ≥ 12,4 |

Reglas:
- **Separar por luminancia**, nunca con filetes de 1 px ni sombras en reposo (X13, X17). Paso mínimo entre superficies vecinas: un escalón (s0→s1).
- **`--rail-todo` no va nunca sobre `--s3`** (2,7:1 < 3:1, WCAG 1.4.11) ni lleva texto encima salvo `--ink` (4,7:1).
- **Visto frente a pendiente** (`--scene` frente a `--rail-todo`) da 2,0–2,5:1. En los modos discreto y por bloques los separa un hueco de superficie (`--rail-gap`) y cada tramo cumple ≥ 3:1 con ella. En el modo continuo y en el bloque a medias se tocan: los separa la marca `--ink` del punto actual. Además la pista es redundante (`aria-hidden`; el dato K8 siempre va en texto), así que no es información «necesaria» en el sentido de 1.4.11. Con más contraste, los vistos pasan a `--ink` (4,7:1, §2.5).
- **`--ph`** (espacio reservado de la portada) no es un token fijo: lo escribe el pipeline con el color dominante de cada portada. Valor por defecto `#4a3f33`.

### 2.2 Acento de escena (K5) — cómo lo calcula el pipeline
1. Color dominante de la portada protagonista (cubetas de croma, sin grises).
2. Se acota a **L 0,55–0,75 y C ≥ 0,08** en OKLCH.
3. **Si el tono cae en 250–290° (X11)** se gira al **borde frío más cercano, H 245°** (decisión §2.3).
4. Se comprueba **≥ 4,5:1 con `--on-scene`** (el texto del botón) y **≥ 3:1 con `--s1`** (relleno de la pista). Si falla, se sube L de 0,01 en 0,01 hasta 0,75; si aun así falla, `--scene-fallback`.
5. Se guarda junto a la portada (`--scene`, `--ph`) y se inyecta como `style="--scene:…"` en el contenedor de esa portada. Nada lo calcula en el navegador.

Superficie máxima del acento: **≤ 10 % de la pantalla**, salvo un campo a sangre por recorrido (K5). En listas el acento **solo llena la pista**; los botones van en `--s2` (A2b).

### 2.3 Deuda D-F2h cerrada: acento frío (X11)
Prueba con **El caballero oscuro** (dominante medido `#0b142b`: L0,20 C0,048 **H266**, dentro de X11). Tres alternativas, ninguna más (§6.1):

| | Regla | Resultado | Con `--on-scene` | Con `--s1` |
|---|---|---|---|---|
| **A (se elige)** | girar a H245, L0,70 C0,10 | `#67a5d9` | 7,5:1 | 6,9:1 |
| B | girar a H220 | `#4aadc9` | 7,7:1 | 7,1:1 |
| C | reserva fija | `#b8ab95` | 8,8:1 | 8,1:1 |

**A** conserva la identidad (la portada es azul) y queda fuera de la franja morada/índigo; **B** se confunde con el verde agua de Sherlock (H185); **C** borra la portada. Se ve en `muestra.html`, sección «Escena». Con esto el sistema demuestra 4 tonos (72°, 122°, 185°, 245°) sin choque con la anti-lista.

### 2.4 Deuda D-F2h cerrada: verde de escena frente a `--ok` (K5)
Problema: el acento de Los 100 (`#9ab552`, H122) y el `--ok` de A2b (`#8fd3a0`, H152) se leían igual: «verde» podía significar «es la portada» o «todo bien».
**Decisión propuesta (D-F2i):** **el éxito no tiene color propio.** Se retira `--ok` en v2. Un mensaje de éxito es `--ink` + icono de visto + texto («Guardado.», «T2 E5 visto»). Así, en la v2, un color con tono siempre significa «la portada»; y el único color de estado es el error (con icono y texto, nunca solo color, WCAG 1.4.1). Como ninguna portada debe confundirse con un error, si el acento cae en H 15–40° con C > 0,12 el pipeline le baja el croma a 0,10 (sigue siendo la portada, pero no grita como `--error`).

### 2.5 Más contraste y colores forzados
- `@media (prefers-contrast: more)`: `--muted: #d2cec8` (12,6:1); `--rail-done` pasa a `--ink` (4,7:1 frente a `--rail-todo`, que no se toca: subirlo lo acercaba al acento, 1,3–1,6:1, hallazgo de Artisan); foco de 4 px.
- `@media (forced-colors: active)`: los botones (cuyo fondo va en `::before`) ganan `border: 2px solid ButtonText`; la pista usa `forced-color-adjust: none` con pendientes en `Canvas` + borde `CanvasText`, vistos en `Highlight` y el actual en `CanvasText` (sin esto visto y pendiente salían iguales, hallazgo de Advocate). Sin el borde, el botón desaparecería.

## 3. Tipografía

### 3.1 Familias (deuda X21 cerrada)
- **KulturaDisplay** (corte estático de Bricolage: opsz 12, wdth 75, wght 800; 17 KB) — solo display.
- **Bricolage Grotesque** variable 200–800 (41 KB) — todo lo demás, con cifras tabulares (K7).
- **Decisión propuesta (D-F2j): Figtree sale de la v2.** No tiene papel en el brief (D2: cuerpo en Bricolage ≥ 400), y quitarla ahorra **20 KB de fuente** (`src/app/fonts/Figtree-latin.woff2`, 20.156 bytes) de los 80 KB que hoy descarga `/es` (Lighthouse del 2026-11-06, `.lighthouseci/lhr-1793993780852.json`, `font: 80181`). Sin mono (K7, X16). Con esto la v2 usa **una familia** (dos cortes).
  - Figtree sigue en v1 hasta `v1-ui` (regla 3): `src/app/fonts/index.ts:27`, `src/app/[locale]/layout.tsx:83`, `src/app/not-found.tsx:42` y las 4 imágenes OG (`src/app/[locale]/opengraph-image.tsx:95`, `…/best/[format]/[year]/opengraph-image.tsx:59`, `…/u/[username]/opengraph-image.tsx:100`, `…/r/_lib/rated-card.tsx:108`). Las OG de v2 se rehacen en F3 con Bricolage.

### 3.2 Escala fluida (cerrada: 5 tamaños)
| Token | Valor | 320 | 390 | 1024 | 1440 | Peso / interlineado | Uso |
|---|---|---|---|---|---|---|---|
| `--fs-display` | `clamp(3.25rem, 1.75rem + 6.2vw, 8rem)` (una sola curva, sin salto en 1024) | 52 | 52 | 91 | 117 | 800 · 0,90 (caja alta 0,94) | titular (K1) |
| `--fs-k8` | `clamp(2.5rem, 1.625rem + 2.6vw, 4rem)` | 40 | 40 | 53 | 63 | 600 tabular · 0,95 | dato grande de la pista (K8) |
| `--fs-phrase` | `clamp(1.5rem, 1.22rem + 1.15vw, 2.25rem)` | 24 | 24 | 31 | 36 | 500 · 1,15–1,2 | frase I1, `h2` |
| `--fs-body` | `1.0625rem` | 17 | 17 | 17 | 17 | 400 · 1,5 | cuerpo, botón |
| `--fs-small` | `1rem` | 16 | 16 | 16 | 16 | 400–600 | rótulo R2, dato secundario; **nunca menos** |

Medido en `muestra.html` (390 / 1024 / 1440): display 52 / 91 / 117 px, dato 40 / 53 / 63 px, frase 24 / 31 / 36 px. Cumple K1 (≥ 48 a 390, ≥ 96 a 1440) y K2 (display/cuerpo 6,9:1 a 1440 y 3,1:1 a 390). Fuera de la escala solo está `--fs-mark` (22 px, la palabra del logotipo), que K2 no cuenta.

`--fs-body` (17) y `--fs-small` (16) se distinguen por rol, no por tamaño: el pequeño va siempre en `--muted` o en peso 600 (rótulo), nunca como cuerpo. Se mantienen los dos porque el 16 es lo que deja «te quedan 4 episodios» en una línea en la etiqueta a 320.

Reglas:
- **K1 · tracking interpolado sin saltos:** `--tr-display: clamp(-.05em, calc(.12rem - .07em), -.03em)` = 1,92 px − 0,07 × tamaño. Medido: **−3,3 % a 52 px, −4,9 % a 91 px y −5,0 % a 117 px**. Además: `--tr-data: -.02em` (datos y display pequeño), `--tr-caps: -.03em` (caja alta) y `--tr-mark: -.01em` (logotipo). Ningún otro tracking. Interlineados: `--lh-display` .90, `--lh-caps` .94, `--lh-data` .95, `--lh-tight` 1,15, `--lh-phrase` 1,2 y `--lh-body` 1,5.
- **K2 · ≤ 4 tamaños por pantallazo** (el logotipo no cuenta). La portada usa display, dato, pequeño y cuerpo; las pantallas de trabajo, frase, cuerpo, pequeño y, si hay pista protagonista, dato.
- **Caja alta solo con `text-transform`**, nunca en `messages/` (`tests/unit/i18n/glossary.test.ts:105-118`).
- Pesos fijos por rol (D2): 800 display · 600 dato y botón · 500 frase · 400 cuerpo. Un peso < 400 solo en ≥ 24 px.
- Datos con `font-variant-numeric: tabular-nums` siempre (K7).

### 3.3 Carga de fuentes
- KulturaDisplay: `font-display: block`, precargada solo en las rutas que tienen display (portada, perfil público); ~100 ms en blanco antes que Arial (decisión ya vigente en `src/app/fonts/index.ts:35-49`).
- Bricolage: `swap` con `adjustFontFallback: "Arial"` para que el cambio no mueva nada (CLS).

## 4. Espacio, retícula y forma

### 4.1 Espacio (base 4)
`--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-6` 24 · `--sp-8` 32 · `--sp-12` 48 · `--sp-16` 64.
Medidas de componente (también tokens): `--ctl-h` 52 · `--top-h` 72 · `--row-thumb` 72/96 · `--tag-pad` · `--rail-w` 14/20 · `--rail-h` 10 · `--rail-gap` 3 · `--rail-gap-v` 4 · `--rail-now-w` 3 · `--field-line` 2 · `--frame-h` `clamp(280px, 46svh, 420px)` · `--w-panel` 520 · `--w-field` 420 · `--mosaic-gap` 2 · `--ul-off` 4.
Entre secciones `--sp-sec: clamp(4rem, 8.4vw, 7.5rem)` (64 → 120). Cambio de escena en pantallas de relato `--sp-scene: clamp(7.5rem, 16.7vw, 15rem)` (120 → 240, B.7). No hay otros valores.

### 4.2 Retícula
`--cols` 4 (12 desde 1024) · margen `--m: clamp(16px, 2.2vw, 32px)` · medianil `--gut: clamp(12px, 1.6vw, 24px)` · máximo `--max: 1376px`. Un único corte de diseño a **1024 px**; por debajo, una columna de lectura. Mosaicos de portadas como material (R4): 0–4 px de separación, sin tarjetas.

### 4.3 Chaflán y radios (K3)
| Token | Valor | Dónde |
|---|---|---|
| `--ch-ctl` | 14 px | botones, campos con forma, etiqueta K8 a < 1024 |
| `--ch-cover` | 18 px | portadas, fondos 16:9, paneles, hoja en escritorio, etiqueta K8 ≥ 1024 |
| `--ch-mark` | 0,28 em | monograma del logotipo (escala con él: 10 px a 34 px) |
| `--r-max` | 2 px | cualquier otro radio; los círculos (avatar, interruptor) son la única excepción |

Siempre **una esquina, la inferior izquierda**: `clip-path: polygon(0 0, 100% 0, 100% 100%, var(--ch) 100%, 0 calc(100% - var(--ch)))`.
**El foco nunca se recorta:** el chaflán va en `::before` (botón) o en un hijo (póster dentro de un enlace sin `clip-path`). El `outline` del elemento queda entero (WCAG 2.4.7). Comprobado en `muestra.html` con Tab.

## 5. Profundidad

### 5.1 Capas (sin WebGL)
| Capa | Cómo se consigue | Token |
|---|---|---|
| 0 · sala | `--s0` | — |
| 1 · superficie | `--s1` / `--s2` (luminancia) | — |
| 2 · encuadre | portada + pista; inclinación B1 | `--persp: 1200px`, `--tilt: 6deg`, `--t-tilt` + `--spring` |
| 3 · etiqueta K8 | monta sobre el póster, con fondo `--s0` | `--z-tag` |
| 4 · flotante | `--s3` + `--shadow-float` | `--z-float`, `--z-dialog`, `--z-toast` |

Orden de apilado cerrado: `--z-raised` 1 · `--z-tag` 2 · `--z-sticky` 10 · `--z-float` 20 · `--z-dialog` 30 · `--z-toast` 40 · `--z-skip` 50.

- **B1:** solo con `pointer: fine` y sin reduced-motion; ±6° según el puntero, vuelve con `--spring` en 450 ms. Sin giroscopio.
- **K4 (rompe el marco):** solo si la portada tiene mapa de profundidad del pipeline (plan §6.4). El sujeto recortado va en una capa encima del marco y sobresale **≤ 12 % del alto del marco**, una vez por pantalla. Es composición, no movimiento: con reduced-motion sigue ahí, quieta. Sin mapa, la portada va plana. **(No verificado:** el pipeline aún no exporta el recorte; se prueba en el paso 6.)
- La única veladura es `--veil` (neutra, desde abajo, 0,78, solo bajo texto).

### 5.2 WebGL opcional (M5)
- Motor existente: `src/components/landing/engine.ts` (23 KB de fuente; WebGL1, `failIfMajorPerformanceCaveat`, `:91`; detecta render por software, `:65`).
- En v2 solo se usa en pantallas de expresividad **alta** (D3: portada, perfil y lista públicos), sobre la portada protagonista.
- **Se carga después del LCP** con `import()` dinámico en `requestIdleCallback`: no cuenta en el JS inicial.
- **No se carga** con `prefers-reduced-motion`, `navigator.connection.saveData`, `hardwareConcurrency ≤ 4` o sin contexto WebGL.
- Las portadas de TMDB se sirven desde otro origen: la textura necesita `crossOrigin="anonymous"` y que el CDN mande CORS, o servirlas desde el propio pipeline. **(No verificado.)**
- El primer fotograma del `canvas` es idéntico al `<img>` que tapa (misma caja, mismo encuadre), y el `canvas` entra con opacidad en `--t-menu`: **CLS 0**. Si falla, se queda el `<img>` y nadie lo nota.

## 6. Movimiento
| Token | Valor | Uso (M2/M3) |
|---|---|---|
| `--ease` | `cubic-bezier(.2,0,0,1)` | entrar y salir |
| `--move` | `cubic-bezier(.77,0,.175,1)` | desplazarse dentro de la pantalla, I2 |
| `--spring` | `linear(0, .25 7%, .58 17%, .82 29%, .94 42%, .985 57%, 1 75%, 1)` | muelle sin rebote (B1) |
| `--t-press` | 120 ms | pulsación, escala 0,97 |
| `--t-fill` | 160 ms | llenar un tramo al marcar visto (B2) |
| `--t-menu` | 200 ms | menú, aviso, aparición del `canvas` |
| `--t-sheet` | 280 ms | hoja y diálogo |
| `--t-tilt` | 450 ms | vuelta de B1 con muelle (**excepción declarada a M2**: es física, no interfaz, y solo con puntero fino; mientras se mueve el puntero no hay transición) |
| `--t-done` | 600 ms | completar una serie (D4, excepción declarada) |
| `--t-scene` | 900 ms | escenas del relato e I2 (excepción declarada) |

Reglas:
- **Nunca `ease-in`** ni otras curvas. Solo `transform` y `opacity` (M4).
- `linear()` (el muelle) no existe en Safari < 17.2: allí la vuelta de B1 no tiene curva y queda en `ease` por defecto **(no verificado en Safari real)**. Se acepta: B1 es un adorno.
- **Lo que dispara el teclado no se anima** (M3): la clase `.kb` quita la transición cuando `click.detail === 0`.
- **Reduced-motion:** los tokens se reescriben en `tokens.css` (`--t-press/fill/tilt/scene: 0`, el resto a `--t-rm` = 150 ms de opacidad, `--tilt: 0`). Sin escala, sin desplazamiento, sin View Transitions; la hoja aparece con fundido. El contenido se ve entero. **Patrón obligatorio:** toda `@keyframes` con `transform` tiene en el bloque `prefers-reduced-motion` una sustituta solo de opacidad (como `sheet-in` → `fade-in` en la muestra); el test `v2/literals` lo comprobará (§12).
- **Deuda D-F2h cerrada en la landing v1** (`src/components/landing/landing.css`; el brief la cita como `landing.css`): `:60` anima color 500 ms (incumple M2) y `:84` usa `cubic-bezier(.65,0,.35,1)` (incumple M1). **Decisión:** no se toca en este paso (no se toca `src/`) ni en v1; la portada v2 la sustituye en F3 con estos tokens. Si la landing v1 siguiera viva al cerrar F3, se arregla en un PR `[fix]` propio: `:60` → `transition: transform var(--t-press) var(--ease)` sin color; `:84` → `var(--move)` con 800 ms (escena, ≤ 900 ms).

## 7. Componentes base
Todos con área táctil ≥ 44 × 44 y ≥ 8 px entre objetivos; foco = `outline: 3px solid var(--focus); outline-offset: 3px` (4 px con más contraste). Se ven funcionando en `muestra.html` §Componentes.

| Componente | Anatomía | Estados | Foco y lectores |
|---|---|---|---|
| **Botón** primario | `--ctl-h` 52 px, relleno `--scene` en `::before` con `--ch-ctl`, texto `--on-scene` 600 | reposo · `:hover` (solo `hover: hover`) · `:active` escala 0,97 en 120 ms · `aria-disabled` (s2 + muted, sigue enfocable) · ocupado: `aria-disabled`, texto «Guardando…» a contraste completo y anuncio `aria-live` (nada de opacidad: al 55 % daba 3,2–3,4:1) | outline entero; un solo primario por pantalla |
| **Botón tranquilo** | igual, relleno `--s2`, texto `--ink`; hover `--s3` | los mismos | nombre accesible único («Marcar visto: temporada 2, episodio 12 de Los 100»; «T2 E12» solo se ve, no se lee) |
| **Enlace** | 600, subrayado a 4 px, alto 44 px | visitado = igual | — |
| **Marca** | monograma `--scene` con `--ch-mark` + palabra en caja alta por CSS; fija en `--brand` como icono | — | `aria-label="Kultura, inicio"` |
| **Pista (K8)** | un tramo por unidad; vistos `--scene`, pendientes `--rail-todo`, actual con contorno `--ink` 3 px | discreta · por bloques · continua (§7.1) | `aria-hidden`; el dato lo dice en texto |
| **Etiqueta K8** | título (`--fs-small`, muted) · dato (`--fs-k8`) · «te quedan…» (`--fs-small`, `nowrap`); fondo `--s0`, `--ch-ctl`/`--ch-cover` | cuelga del tramo actual | frase completa en `.vh` («Temporada 2, episodio 5») |
| **Encuadre** | pista vertical (14 / 20 px) + 4 px + póster con `--ch-cover` | B1 con puntero fino | — |
| **Póster** | 2:3 entero (R1), `--ch-cover`, rótulo R2 debajo (título 600 + año muted) | cargando: `--ph` estático + `aria-busy` · sin portada: `--scene-fallback` + título en display · error de imagen = sin portada | foco en el enlace que lo envuelve, sin `clip-path` |
| **Fondo 16:9** | `--ch-cover`, `--veil` solo bajo texto | igual que póster | — |
| **Fila «Seguir viendo»** | póster 72/96 px · título + año · pista · dato 24 px + «te quedan» · acciones | B2: «Marcar visto» → tramo lleno en 160 ms, `aria-live` «Temporada 2, episodio 5, visto.», «Deshacer» **10 s** (pausa con foco dentro; el foco vuelve al botón). Sube de los 5 s de B2 por quien llega con lector de pantalla (Advocate) | botón con nombre único |
| **Campo** | etiqueta visible encima · caja `--s2` 52 px · subrayado 2 px `--muted` (5,96:1, 1.4.11) | foco · error (subrayado `--error`, mensaje con icono, `aria-invalid` + `aria-describedby`) · el valor se queda (X18) | etiqueta `for` |
| **Mensaje** | icono 18 px + texto `--fs-small` | error `--error` · éxito `--ink` (§2.4) | en `aria-live` si nace de una acción |
| **Hoja / diálogo** | `<dialog>` nativo, `--s3` + sombra; a 390 hoja desde abajo, ≥ 1024 centrado con `--ch-cover` | entra en `--t-sheet` (fundido con reduced-motion) | foco atrapado y devuelto por `showModal()`; Esc cierra |

### 7.1 Deuda D-F2h cerrada: pistas de más de 100 tramos (P3)
Un tramo necesita **≥ 6 px de ancho y 3 px de separación** para leerse. La fila más estrecha (320 px) deja ≈ 176 px de pista → caben **18 tramos** (6,9 px); a 390 (≈ 246 px) cabrían 24. Como el servidor no sabe el ancho, el umbral se fija para 320: **18**. En el encuadre (≥ 280 px de alto, 4 px de separación) caben de sobra.

**Decisión propuesta (D-F2k):**
| Caso | Modo | Qué se ve |
|---|---|---|
| n ≤ 18 unidades (episodios de la temporada actual, capítulos del arco) | **discreto** | un tramo por episodio/capítulo (A2b) |
| n > 18 y el formato tiene bloques (temporadas, arcos, tomos) con ≤ 18 bloques | **por bloques** | un tramo por bloque; el bloque actual se llena en proporción y lleva el contorno |
| n > 18 sin bloques, o > 18 bloques; libros (páginas); películas (minutos) | **continuo** | una barra de 10 px con relleno proporcional y una marca `--ink` de 3 px en el punto actual |
| juegos (horas, sin total) | **sin pista** | solo el dato («12 h») |

El dato K8 nunca cambia: «cap. 112», «p. 240», «T3 E10». Probado en `muestra.html` (112 episodios en 5 temporadas; 1.100 capítulos). La pista es `aria-hidden` en los tres modos.

## 8. Presupuesto
| Medida | Límite | Hoy (v1) | Reparto para v2 |
|---|---|---|---|
| JS inicial por ruta | **≤ 150 KB** (153.600 B, `lighthouserc.json`) | `/es`: **149.793 B** (Lighthouse 2026-11-06, mediana de 3): sin margen | marco Next/React + i18n ≈ el suelo actual **(no verificado por ruta en v2)**; pantalla ≤ 25 KB; WebGL **0** (diferido); animación sin librerías (CSS + WAAPI) |
| CLS | **≤ 0,05** | `/es`: 0 | portadas con `width`/`height` o `aspect-ratio`; `--ph` reservado; fuentes con métricas ajustadas; nada se inserta encima del contenido |
| Fuentes | — | 80 KB | 58 KB (Bricolage 41 + KulturaDisplay 17) sin Figtree |
| LCP | aviso > 2,5 s | — | póster protagonista con `fetchpriority="high"`, w780 |

Regla para F3: **cada PR de pantalla publica su JS inicial** (Lighthouse CI ya lo bloquea); si una pantalla supera 25 KB propios, se justifica en el PR.

## 9. Accesibilidad
- **Contraste medido:** tabla §2.1 (todo texto ≥ 5,2:1; controles y tramos ≥ 3,0:1, salvo `--rail-todo` sobre `--s3`, prohibido); acentos de escena 7,5–9,2:1 con `--on-scene`; texto `--ink` sobre `--rail-todo` 4,7:1.
- **Foco:** 3 px `--ink`, separación 3 px, fuera del `clip-path`; las barras fijas (`--z-sticky`) dejan `scroll-padding-top` igual a su alto (2.4.11).
- **Objetivos:** ≥ 44 × 44 px (botón 52 de alto) y ≥ 8 px entre ellos; medido en `muestra.html`: 0 objetivos por debajo en 320, 390, 1024 y 1440.
- **Reflow a 320 y zoom 200 %:** una columna por debajo de 1024; `minmax(0, 1fr)` en todas las rejillas; la etiqueta K8 no parte «te quedan…» y puede desbordar el póster pero no la página. Medido: 0 desbordes horizontales a 320.
- **Espaciado de texto ampliado (1.4.12):** alturas en `min-height`, nunca `height` fija en textos.
- **Estados:** `aria-live="polite"` para marcar visto, guardado y recuentos; error con `aria-invalid` + `aria-describedby`.
- **Arrastre (2.5.7):** todo gesto tiene botón equivalente (B2).
- **Reduced-motion:** §6. **Más contraste y colores forzados:** §2.5.
- **Sin probar:** VoiceOver en iOS, NVDA y Safari real (pendiente desde el paso 4). **Es condición de la puerta del paso 6** (lista del criterio 7): el prototipo de Inicio no se da por bueno sin esa prueba, que hace Víctor con un guion de 10 minutos que prepara Claude.

## 10. Pruebas de la muestra (regla 4) — 2026-11-07
`prototipos/f2-sistema/muestra.html`, Playwright + axe-core del repo, servidor estático local, `getContext('webgl')` anulado.
- **axe** (wcag2a/aa, 21a/aa, 22aa, best-practice): **0 infracciones en 8 combinaciones** (390, 1440, 320, 1024 × con y sin reduced-motion). La 1.ª pasada dio 2 `color-contrast` (texto `--s0` sobre la muestra de `--rail-todo`, 3,7:1): de ahí la regla «sobre `--rail-todo` solo `--ink`».
- **Límite de axe:** con el fondo del botón en `::before`, axe deja los botones como «incomplete» (no puede medir su contraste). Se miden aparte (§2.1: 7,5–9,2:1 con `--on-scene`; `--ink` sobre `--s2` 14,1:1) y en F3 lo vigila un test propio (§12).
- Con `prefers-contrast: more`: axe 0. Con `forced-colors: active` emulado, axe da 60 `color-contrast` porque mezcla el color de texto del autor con el fondo del sistema (`#f2f0eb` sobre `#ffffff`); en colores forzados el navegador pinta los dos con colores del sistema, así que es un falso positivo de la emulación **(no verificado en Windows con contraste alto real)**.
- Advocate repitió las pruebas por su cuenta: 31 parejas de contraste recalculadas, 14 pasos de Tab sin foco recortado, B2 con teclado sin animación, `prefers-contrast: more` y `forced-colors`.
- Consola: 0 errores, 0 avisos. Sin desbordes a 320. 0 objetivos < 44 px.
- Escala fluida medida (§3.2) y tracking −3,3 % / −5,0 %.
- Capturas en `prototipos/f2-sistema/capturas/` (las PNG se quedan en local, como en el paso 4).

## 11. Cómo se aplica en F3
- **`src/v2/` no usa Tailwind** (decisión propuesta D-F2l): estilos en CSS con `tokens.css` global y CSS Modules por componente, todo con `var(--…)`. Motivo: los valores del sistema (`clamp`, `clip-path` del chaflán, `linear()` del muelle) no caben en escalas de Tailwind sin valores arbitrarios, que el ESLint actual prohíbe (`.eslintrc.json`); y dos sistemas de clases duplicarían la fuente de verdad. Tailwind sigue para v1 hasta `v1-ui`.
- `tokens.css` pasa tal cual a `src/v2/styles/tokens.css` (sin las `@font-face`, que van por `next/font/local`).
- Cada pantalla de F3 declara su nivel de expresividad (D3) y cita los componentes de §7 que usa. Un componente nuevo entra antes en este documento.

## 12. Los 13 archivos de tests `design|visual` atados al sistema viejo
Ninguno se borra ahora (regla 3). **Aparcar** = sigue corriendo sin cambios, vigilando v1. **Adaptar** = en F3 se crea su equivalente para `src/v2/` (o se amplía su alcance) cuando exista `src/v2/styles/tokens.css`. **Retirar** = se borra en el PR de limpieza posterior a `UI_V2_DEFAULT=1` + etiqueta `v1-ui` (§7.5 del plan).

| Archivo | Vigila hoy | Destino | Equivalente v2 / cuándo |
|---|---|---|---|
| `tests/unit/design/css-tokens.ts` (ayudante) | lee `:root` de `src/app/globals.css` (`:10`) | **Adaptar** | parametrizar la ruta para leer también `src/v2/styles/tokens.css`; el original se retira con v1 |
| `tests/unit/design/contrast.test.ts` | ACC-4 error/campo/foco (`:51`), ACC-9 avatares (`:69`) | **Adaptar** el principio; **retirar** el original con v1 | `v2/contrast.test.ts`: las parejas de §2.1, `--rail-todo` ≥ 3 sobre s0–s2 y < 3 sobre s3 prohibido, acentos ≥ 4,5 con `--on-scene` |
| `tests/unit/design/diseno-doc.test.ts` | `DISENO.md` = `globals.css` (`:33`, `:48`) y ningún `var(--x)` roto (`:63`) | `:33`/`:48` **aparcar → retirar**; `:63` **adaptar** | `v2/design-system-doc.test.ts`: cada token de `03_DESIGN_SYSTEM.md` existe en `tokens.css` y al revés; ningún `var(--x)` de `src/v2` apunta a un token inexistente |
| `tests/unit/visual/diseno-scales.test.ts` | `DISENO.md` = escalas de `tailwind.config.ts` (`:30`) | **Aparcar → retirar** | lo cubre el anterior (v2 sin Tailwind) |
| `tests/unit/design/no-mono.test.ts` | sin `font-mono` (`:29`) ni mono cargada (`:34`) | **Adaptar** (sobrevive entero) | ampliar a `src/v2`: sin mono **y sin Figtree** (D-F2j); renombrar el `describe` «solo Bricolage + Figtree» (`:28`) cuando salga v1 |
| `tests/unit/design/focus-ring.test.ts` | foco pink, no lime (`:36`) | **Aparcar → retirar** | `v2/focus.test.ts`: el foco usa `--focus` y ningún `outline`/`focus` usa `--scene` (K5) |
| `tests/unit/design/dead-colors.test.ts` | clases de color de Tailwind sin regla (`:40`) | **Aparcar → retirar** | no aplica (v2 sin Tailwind); la regla 9 la cubre el test de literales |
| `tests/unit/design/tailwind-alpha.test.ts` | `bg-x/80` genera regla (`:90`) | **Aparcar → retirar** | no aplica |
| `tests/unit/visual/classes-compile.test.ts` | toda clase de `src` genera CSS (`:125`) | **Adaptar el alcance**, luego **retirar** | excluir `src/v2/` del recorrido si los módulos CSS dan falsos positivos; en v2 lo sustituye `v2/literals.test.ts`: ningún hex, `px` de tipo, curva o duración en `src/v2/**/*.css` fuera de `tokens.css` |
| `tests/unit/visual/scales.test.ts` | radios, tipos, sombras cerrados en Tailwind (`:43`, `:72`, `:97`) y ESLint (`:87`) | **Aparcar → retirar** | `v2/literals.test.ts` (radios > `--r-max`, `box-shadow` fuera de `--shadow-float`, `border: 1px`, X5/X13/X17) |
| `tests/unit/visual/poster-frame.test.tsx` | `PosterFrame` v1: radio + gradiente (`:22`), sin portada con iniciales (`:33`) | **Aparcar → retirar** | `v2/poster.test.tsx`: 2:3, chaflán, sin gradiente, sin portada = reserva + título |
| `tests/unit/visual/skeletons.test.ts` | esqueletos v1 con la forma real (`:18`) | **Aparcar → retirar**; el principio se **adapta** | `v2/placeholder.test.ts`: el espacio reservado tiene la caja exacta del contenido y no usa `animate-pulse` (X7) |
| `tests/unit/visual/status-contrast.test.ts` | pastillas de `LibraryAction.tsx` (`:35`) | **Aparcar → retirar** | sin equivalente: en v2 el éxito no tiene color (D-F2i) |

Resumen: **adaptar 4** (`css-tokens`, `contrast`, `no-mono`, `classes-compile` en alcance) más la parte `:63` de `diseno-doc`; **aparcar y retirar con v1 los otros 8**. Los 8 tests nuevos de v2 (`contrast`, `design-system-doc`, `focus`, `literals`, `poster`, `placeholder`, más dos que pidió Advocate: `scene-pipeline` —el acento calculado cumple ≥ 4,5:1 con `--on-scene` y ≥ 3:1 con `--s1`, y nunca cae en H250–290— y `button-contrast` —contraste de los botones calculado desde los tokens, porque axe no lo ve—) se escriben en el primer PR de F3 que cree `src/v2/styles/tokens.css`.

## 13. Decisiones de este paso (aprobadas por Víctor el 2026-11-07, D-F2o)
- **D-F2i** · el éxito no tiene color; se retira `--ok` en v2 (§2.4).
- **D-F2j** · Figtree sale de la v2 (§3.1).
- **D-F2k** · pistas largas: discreta ≤ 18, por bloques, continua, sin pista (§7.1).
- **D-F2l** · `src/v2/` sin Tailwind: CSS + tokens (§11).
- **D-F2m** · acento frío: girar a H245 (alternativa A) (§2.3).
- **D-F2n** · `--rail-todo: #6b6b6b`, nunca sobre `--s3`; con más contraste los vistos pasan a tinta (§2.1, §2.5).
- Landing v1 (`landing.css:60`, `:84`): se sustituye en F3, no se parchea (§6).
