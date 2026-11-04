# Dirección del rediseño (Paso 0)

Este documento registra lo que decidieron las cuatro skills de diseño y por qué. En la PR 1 se convierte en `DISENO.md` v3.

Cada decisión indica de dónde sale: **[UUPM]** UI UX Pro Max · **[TASTE]** Taste Skill · **[ACD]** Awesome Claude Design · **[DMP]** Design Motion Principles.

## 1. La idea

> **Kultura**: en esta página, *las portadas reales de los 7 formatos* (una peli, un anime, un juego, un libro…) se convierten en *la palabra que falta en la frase*.

- **Dirección [TASTE]**: `sentence-as-layout` («La frase es la composición»), semilla `1399116372`. La guardé en `.taste-skill/direction.json`.
- **Por qué esta y no otras.** De las tres repartidas, `name-as-monument` repetía lo que ya hace la landing v2 (el nombre gigante entre capas). `page-is-the-object` (un tique, una ficha) no pasaba la prueba del competidor: cualquier app de seguimiento puede ser un tique. Esta sí la pasa: Letterboxd o Goodreads solo podrían poner un formato en el hueco, mientras que Kultura lo rellena con los siete.
- **Lo que se puede hacer en la página [TASTE]**: un **titular en el que se escribe**. La sección `showcase` es un `<input>` real que busca en el catálogo real y devuelve el mismo título en todos sus formatos (adaptaciones: la peli, el libro, el juego, el cómic). Sin script, funciona como un enlace a `/discover?q=`.

## 2. Tipografía [TASTE] (+ [ACD] WIRED/The Verge: display alto y estrecho solo en momentos grandes)

| Rol | Fuente | Ajustes |
|---|---|---|
| Display | **Big Shoulders** 800 (OFL) | Mayúsculas, tracking −0,005em, interlineado 0,88. Solo ≥ 40 px, nunca en la UI. |
| Texto y UI | **Public Sans** 400/600 (OFL) | Interlineado 1,5, tracking 0, 16 px mínimo para texto corrido. |

- Se sustituyen Bricolage, Figtree y KulturaDisplay; Geist y GeistMono (sin uso) se eliminan.
- Sin monoespaciada [TASTE] (por eso no se usan las tipografías mono de las referencias de [ACD]).
- [UUPM] proponía Playfair/Inter para *editorial*; prevalece [TASTE] porque su reparto es la dirección.

**Escala cerrada [TASTE]**, cinco pasos visibles por pantalla como máximo:
- `small` 13–14 px
- `body` 17–19 px
- `lead` 20–26 px
- `head` 40–88 px
- `display` (titular de la frase) hasta 13vw

La app añade los pasos de interfaz de `app-screens.md` §9.1 (13, 14, 16, 18 y 24 px).

## 3. Color [TASTE] «Cobalto sobre arena» (+ [ACD] Spotify: la portada es la única fuente de color)

La interfaz es monocroma (cobalto sobre arena) y el color lo ponen las portadas. Un solo acento, que va en la acción.

| Token | Claro (arena) | Oscuro (sala) [TASTE `true-black-flat`] |
|---|---|---|
| `ground` | `oklch(89.5% 0.029 83)` #e6dbc7 | `oklch(0% 0 0)` #000 |
| `surface` (un paso) | `oklch(86.2% 0.034 82)` #ddd0b9 | `oklch(17% 0.004 264)` #0e0f11 |
| `raised` (tarjeta de app) | `oklch(94% 0.016 83)` #f0eadf | `oklch(27% 0.006 264)` #252629 |
| `ink` | `oklch(34.1% 0.162 264)` #082b8a | `oklch(93% 0.022 83)` #efe7d8 |
| `muted` | `oklch(44% 0.12 265)` #314e94 | `oklch(76% 0.02 83)` #b7b0a3 |
| `accent` | = `ink` (cobalto) | `oklch(72% 0.13 264)` #7ba3f6 (marcas); la acción principal va invertida (pastilla arena con texto negro) |
| `tint-1` / `tint-2` | `oklch(90% 0.035 264)` / `oklch(84% 0.055 264)` | — |
| `danger` | `oklch(48% 0.17 28)` #a9231e | `oklch(72% 0.15 28)` #f47c6e |
| `positive` | `oklch(46% 0.11 150)` #1d6835 | `oklch(76% 0.14 150)` #68ca80 |
| `field-line` | `oklch(58% 0.06 264)` #687a9f | `oklch(50% 0.01 264)` #606369 |

**Contraste medido (WCAG AA):**
- Claro: ink/ground 8,92 · muted/surface 5,20 · danger/ground 5,21 · positive/ground 4,94 · field-line/raised 3,60.
- Oscuro: ink/card 15,55 · muted/nest 7,01 · accent/card 7,63.

El `muted` repartido (#3a5aa8) daba 4,30 sobre `surface` y se oscureció a 44 %.

**Formatos sin color propio.** [UUPM] sugería colores por categoría (patrón *Media Platform*). Se descartan por la regla de un solo acento de [TASTE]: el formato se nombra con palabras y se ve en la portada.

## 4. App [TASTE `accent-ladder`, semilla 1099932050]

- **Tintes, no plenos.** El cobalto pleno va solo en marcas pequeñas: el botón relleno, la serie de datos y el icono de navegación activo. Los tintes pálidos cubren las áreas: fila activa, insignias y barras de progreso.
- **Presupuesto de color**: 3–10 % de la pantalla.
- **Armazón «plano abierto»**:
  - Barra lateral de 240 px con etiquetas, sobre el mismo fondo y sin barra superior en escritorio.
  - Navegación con un paso de 34 px; fila activa en píldora de tinte.
  - En móvil, barra superior de 48 px y hoja de navegación a pantalla completa. La barra inferior actual pasa a revisión por [UUPM] (navegación inferior ≤ 5).
- **Su cara.** Escalera construida con el cobalto de la marca, suelo arena (en vez del #f9fafb del kit) y la portada como objeto protagonista.
- **Patrones de pantalla:**
  - Lista: tarjetas-contador que filtran (Biblioteca por estado o formato).
  - Detalle: cabecera-objeto con portada 50×62 más una rejilla de 6 columnas.
  - Ajustes: dos columnas con etiqueta y panel.
  - Inicio y chat: compuestos con las reglas de `app-screens.md`.

## 5. Composición de la landing [TASTE], en orden del argumento

| Sección | Plano dado | Contenido real de Kultura |
|---|---|---|
| Héroe | Frase con tira de imagen | `TU [portadas] EN UN SITIO`. La tira recorre portadas reales de los 7 formatos (`getLandingMedia`). |
| showcase | Titular en el que se escribe | La búsqueda real en el catálogo y sus adaptaciones. |
| features | Filas con fotos al margen | Biblioteca, diario, listas, amigos y grupos, cada uno con un fragmento real de la interfaz (`data-ui`). |
| how-it-works | Arrastrar por las etapas | Un deslizador de 4 pasos (importar, puntuar, organizar, compartir) con la interfaz en cada estado. |
| list | Frase y tabla a la derecha | El ranking real «lo mejor del año» (`/best`). |
| proof | Nombres como una frase | Los catálogos reales de los que lee Kultura (TMDB, AniList, RAWG, MangaDex, Google Books, Open Library, Comic Vine, Steam, JustWatch). Nada inventado. |
| faq | Preguntas grandes, respuestas al lado | Las FAQ actuales, todas abiertas. |
| cta | Frase con un hueco | El correo en línea y el verbo como botón (registro real). |
| footer | Invitación sobre el nombre recortado | El wordmark KULTURA cortado por el borde. |

**Reglas de la casa [TASTE]** (vigiladas por `inspect.mjs`):
- Titulares de ≤ 2 líneas.
- Sin eyebrows, sin numeración 01/02, sin filetes, sin gradientes y sin sombras en reposo.
- Sin vidrio, sin mayúsculas pequeñas con tracking y sin acento estilizado dentro del titular.
- ≥ 4 imágenes reales: aquí, las portadas del catálogo.

## 6. 3D [UUPM *Immersive/Interactive* + *3D*] dentro de la dirección [TASTE]

- **Escena R3F en la landing.** Las portadas de la tira del héroe son objetos con relieve: mapa de profundidad del pipeline semanal, luz de estudio y cámara que sigue al cursor.
- **Cambio de escena.** Al hacer scroll, la tira se abre a pantalla completa y el objeto se presenta con su grosor de formato: lomo de libro, caja de juego, tomo de manga. Es la escena «la imagen que se abre» [TASTE scenes].
- **Detalle de título** (rara vez visitado de forma repetida): la portada inclina hacia el cursor con su relieve.
- **Alternativas obligatorias [UUPM]**: saltar la animación, teclado, movimiento reducido y sin 3D (la imagen plana con la misma composición).

## 7. Movimiento [DMP] (+ presets GSAP [UUPM] + «Shutter image» [TASTE])

- **Ponderación**:
  - Landing: Jakub primario, Jhey secundario y Emil para navegación y formularios.
  - App: Jakub primario, Emil secundario y Jhey solo en los «encantadores» de baja frecuencia (estado vacío, primera puntuación).
- **Puerta de frecuencia [DMP]**:
  - Filtros, pestañas, navegación y atajos de teclado: sin animación o instantáneos.
  - Abrir un modal o un toast: 180–240 ms.
  - Landing y primera visita: expresivo.
- **Movimiento firma [TASTE]**: *Shutter image*. La tira de portadas del héroe se abre con `clip-path` en ~1,1 s mientras la imagen pasa de escala 1,12 a 1.
- **Entradas por sección [TASTE]**: título, texto e imagen escalonados 60–90 ms, subiendo 16–32 px con opacidad (y un desenfoque leve [DMP]), una sola vez. El contenido nunca queda oculto si falla el script.
- **Curvas [DMP]**:
  - Entrada `cubic-bezier(0.22, 1, 0.36, 1)` (expo-out).
  - Salida más corta y más sutil que la entrada.
  - Nunca `ease` a secas.
  - Solo `transform`, `opacity` y `filter`.
- **Transiciones entre pantallas**: View Transitions; Flip de la portada compartida (lista → detalle) según el preset *Page Transition* de [UUPM].
- **Movimiento reducido**: obligatorio en todo. Se conserva el contenido y se elimina el desplazamiento.

## 8. Logo nuevo

- **Wordmark**: KULTURA en Big Shoulders 800.
- **Símbolo**: el hueco de la frase, un rectángulo redondeado (radio 14/56) en cobalto con la K recortada en negativo. El mismo dispositivo del héroe se vuelve marca.
- **Derivados**: favicon, `icon.svg`, `apple-icon`, maskable y OG.
