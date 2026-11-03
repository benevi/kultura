# Kultura · Sistema de diseño «Álbum de cromos»

Este documento es el criterio de diseño de Kultura. La idea: **tu biblioteca
es un álbum de cromos que llenas.** Cada título que quieres tiene su hueco
numerado antes de tenerlo, y acabarlo pega el cromo. El mundo es el álbum de
Panini que llenaba todo el mundo: páginas impresas en tintas planas, huecos
numerados con el contorno discontinuo y el título impreso dentro, el cromo
con su borde blanco, los «brillantes», el sobre, los repes y la página de
control del final.

- **Páginas públicas** (portada, rankings, login, bienvenida, perfil y listas
  públicos, legales) = las páginas impresas del álbum: cian de imprenta,
  amarillo, tinta marina, página blanca y el rosa de KULTURA para la ÚNICA
  acción principal de cada pantalla. El color manda por regiones enteras.
- **La app con sesión** = el álbum abierto de noche en el sofá: fondo azul
  marino profundo (la tinta de la tapa, nunca negro puro), huecos un escalón
  más claros, cromos con su borde blanco. El rosa es el único color de
  acción. El cian y el amarillo solo como **bandas de orientación** (la
  sección en la que estás, el foco de un hueco), nunca como relleno detrás
  de lo que se lee.
- **Colores de formato** = datos, nunca decoración: el punto, la tira de
  progreso y la pestaña del hueco, siempre junto al nombre del formato.
- **Nunca:** papel crema, degradados fuera del brillo, sombras en reposo,
  halos, cristal o desenfoque de fondo, emoji, antetítulos («eyebrows»),
  violeta, monoespaciada, `transition-all`.

Las pantallas de la app son de trabajo (modo *Operate*): densas, con
controles estándar; el álbum entra por los huecos, los números y las bandas,
no por adornos.

Los **textos** (tono, tuteo, glosario, cifras) no están aquí: van en la guía
de voz, [`VOZ.md`](VOZ.md). Nunca «sin registro»: «gratis».

**El documento describe el código.** Los sets cerrados (radios, tamaños de
texto, sombras y retícula) son los de `tailwind.config.ts`, fuera de
`extend`: una clase que no esté en el set no genera CSS. Lo comprueban
`tests/unit/visual/` y `tests/unit/design/` (este documento = config, ninguna
clase sin regla, contraste de cada par) y ESLint (`text-[Npx]`,
`rounded-[…]` y `shadow-[…]` prohibidos).

## Tokens (OKLCH, literales, no aproximar a hex)

Viven en `src/app/globals.css`. `:root` es la **noche** (la app); la clase
`.theme-paper` (o el componente `AlbumPage`) redefine los mismos nombres con
los valores de **papel**, y todo lo que hay dentro se re-viste solo. En
Tailwind cada token es una clase (`bg-surface-default`, `text-album-navy`,
`bg-format-anime`…) y admite opacidad (`bg-surface-base/80`).

```css
/* Tintas del álbum (fijas) */
--album-cyan: oklch(66.9% 0.147 237.2);
--album-yellow: oklch(91.7% 0.192 101.4);
--album-navy: oklch(30.9% 0.119 262.5);
--album-white: oklch(100% 0 0);
--album-pink: oklch(66.2% 0.246 0.9);
--album-ink: oklch(18% 0.06 262.5);

/* Formatos (datos) */
--format-movie: oklch(69.2% 0.22 358.6);
--format-tv: oklch(72.2% 0.148 252.3);
--format-anime: oklch(90% 0.191 123.3);
--format-manga: oklch(70.9% 0.184 29.1);
--format-game: oklch(81.3% 0.125 203.5);
--format-book: oklch(82.1% 0.149 72.1);
--format-comic: oklch(90.7% 0.164 97.2);
--format-movie-ink: oklch(72% 0.2 358.6);

/* Noche: superficies y texto */
--surface-base: oklch(21% 0.068 262.5);
--surface-default: oklch(25.5% 0.08 262.5);
--surface-elevated: oklch(30.5% 0.09 262.5);
--surface-border: oklch(38% 0.09 262.5);
--text-primary: oklch(98% 0.006 262.5);
--text-secondary: oklch(86% 0.035 262.5);
--text-tertiary: oklch(76% 0.05 262.5);

/* Acción, estados, campos y orientación */
--accent-pink: var(--album-pink);
--accent-pink-hover: oklch(71% 0.22 0.9);
--on-accent-pink: var(--album-ink);
--accent-positive: oklch(80% 0.17 150);
--accent-highlight: var(--album-yellow);
--accent-info: oklch(72.2% 0.148 252.3);
--accent-danger: oklch(62% 0.21 25);
--accent-danger-text: oklch(74% 0.16 25);
--accent-danger-solid: oklch(55% 0.21 25);
--on-accent-danger: oklch(97% 0.01 25);
--field-border: oklch(63% 0.07 262.5);
--focus-ring: var(--album-yellow);
--wayfinding: var(--album-yellow);

/* Piezas del álbum */
--cromo-border: var(--album-white);
--cromo-back: oklch(93% 0.02 237);
--button-secondary-bg: var(--surface-elevated);
--button-secondary-fg: var(--text-primary);

/* Acentos heredados: ya apuntan a las tintas (sin violeta) */
--accent-lime: var(--album-yellow);
--accent-purple: var(--album-cyan);
--accent-orange: var(--format-book);
--accent-blue: var(--format-tv);
--accent-yellow: var(--album-yellow);
```

Además: `--slot-line` (contorno del hueco: blanco al 28 % de noche, marino
al 40 % en papel), `--shadow-lift` (la única sombra), los `--format-*-ink`
del resto de formatos (de noche = el color base) y los alias del canvas F0
(`--bg`, `--surface-2`, `--pink`…), que siguen existiendo para que el código
viejo pinte.

### Papel (`.theme-paper`)

```css
.theme-paper {
  --surface-base: var(--album-white);
  --surface-default: var(--album-white);
  --surface-elevated: oklch(96.5% 0.018 237);
  --surface-border: oklch(86% 0.04 250);
  --text-primary: var(--album-navy);
  --text-secondary: oklch(40% 0.1 262.5);
  --text-tertiary: oklch(47% 0.09 262.5);
  --field-border: oklch(55% 0.09 262.5);
  --focus-ring: var(--album-navy);
  --wayfinding: var(--album-navy);
  --button-secondary-bg: var(--album-white);
  --button-secondary-fg: var(--album-navy);
  --button-secondary-border: var(--album-navy);
  /* + positivo, info, error y `--format-*-ink` oscurecidos para texto */
}
```

Campos de color: `AlbumPage tone="cyan"` / `tone="yellow"` (clases
`paper-cyan` / `paper-yellow`) ponen todo el texto en tinta marina (4,59:1
sobre cian, 10,65:1 sobre amarillo).

**Portales**: un `Popover`, `Modal` o `Toast` se pinta en `<body>`, fuera de
`.theme-paper`, así que en una página de papel sale con los tokens de noche.
Es deliberado (los menús y avisos son la «capa de noche»); si una página
pública necesita uno en papel, que ponga `theme-paper` en su contenido.

### Contraste (comprobado en `tests/unit/design/contrast.test.ts`)

| Par | Noche | Papel |
|-----|-------|-------|
| Texto principal / fondo | 17,5:1 | 13,5:1 |
| Texto terciario / superficie elevada | 6,3:1 | 6,2:1 |
| Texto del primario / rosa | 5,4:1 | 5,4:1 |
| Foco / fondo (no texto, ≥ 3:1) | amarillo 14,6:1 | marino 13,5:1 |
| Borde de campo / tarjeta (≥ 3:1) | 4,5:1 | 4,9:1 |
| Rosa (forma del botón) / fondo (≥ 3:1) | 5,3:1 | 3,5:1 |

El rosa `#ff2d8a` con texto blanco da 3,4:1: **el primario lleva texto en
tinta marina casi negra** (`--album-ink`), no blanco. Los colores de formato
pasan como texto sobre la noche (película con su variante `-ink`); sobre el
papel, siempre la variante `-ink`.

## Tipografía

- **Display: Lilita One** (`next/font/google`, peso 400, latino + latino
  extendido; variable `--font-display`, clase `font-display`). Solo
  titulares, numerales de hueco y de ranking y la nota grande. Nunca texto
  corrido, etiquetas ni botones. Es de un solo peso: `font-bold` no la
  engorda (`font-synthesis: none`), así que no hace falta ni sirve.
- **Texto y UI: Figtree** (400–700, autoalojada; `--font-body`,
  `font-body`). Cifras tabulares (`tabular-nums`) en progreso, fechas y
  notas.
- **Guarda**: por debajo de 18 px (`text-xs`…`text-base`), `font-display`
  pinta Figtree. Para un numeral pequeño en Lilita, `font-numeral`.
- **Logotipo**: el wordmark `kultura.` (minúsculas, punto rosa) sigue en
  Bricolage Grotesque 700, un subconjunto de sus 6 glifos (`font-logo`).
  La marca no cambia con el sistema.

### Escala de tamaños (cerrada)

Son los únicos tamaños de texto (`text-[13px]` no existe: ESLint lo rechaza).
Las páginas públicas usan ≤ 7 por página y ancho
(`tests/e2e/a11y/type-scale.spec.ts`; el logotipo no cuenta).

<!-- escala:inicio -->
| Clase | Tamaño | Interlineado | Uso |
|-------|--------|--------------|-----|
| `text-xs` | 12px | 16px | Caption: etiquetas de formato, bandas de estado, barra inferior |
| `text-meta` | 13px | 18px | Metadatos, etiquetas de campo, ayudas |
| `text-sm` | 14px | 20px | UI general, botones, títulos de cromo |
| `text-body` | 15px | 22px | Cuerpo en escritorio (campos desde `md`) |
| `text-base` | 16px | 24px | Cuerpo; campos en móvil (iOS no hace zoom) |
| `text-lg` | 18px | 26px | Entradillas; número del hueco (Lilita) |
| `text-xl` | 20px | 28px | Título de sección pequeña, título de modal |
| `text-2xl` | 24px | 30px | h3 / h1 en móvil, número de caja mediana |
| `text-3xl` | 32px | 1.15 | h2 / h1 de página en móvil |
| `text-4xl` | 40px | 1.1 | h1 de página (`PageHeading` desde `md`), número grande |
| `text-5xl` | 48px | 1 | h1 de los legales en escritorio |
| `text-6xl` | 60px | 1 | h2 de la portada, número del podio |
| `text-7xl` | 72px | 1 | 404, número del podio (`NumberBadge size="xl"`) |
| `text-8xl` | 96px | 1 | Número 1 del podio de rankings |
| `text-display` | clamp(3.25rem, 5.4vw, 5.75rem) | 1 | h1 de la portada |
<!-- escala:fin -->

## Radios (cerrados: 4 + píldora)

Materia impresa: esquinas nítidas. Los nombres viejos se conservan con el
valor nuevo para que el código existente no cambie.

<!-- radios:inicio -->
| Clase | Radio | Uso |
|-------|-------|-----|
| `rounded-cromo` | 4px | Cromo, hueco, caja de número, miniaturas, esqueletos de portada |
| `rounded-lg` / `rounded-2xl` / `rounded-button` | 8px | Botones, campos, filas, menús, tarjetas, avisos |
| `rounded-bento` | 12px | Contenedores: bloques, secciones, tarjetas de lista |
| `rounded-bento-xl` | 16px | Modales, héroe, piezas protagonistas |
| `rounded-full` / `rounded-pill` | 9999px | Chips, avatares, puntos de formato |
<!-- radios:fin -->

## Sombras (ninguna en reposo)

<!-- sombras:inicio -->
| Clase | Valor | Uso |
|-------|-------|-----|
| `shadow-lift` | `var(--shadow-lift)` | La única: un cromo mientras se mueve (hover, arrastre, pegado) |
| `shadow-soft` | `var(--shadow-lift)` | La misma, para un menú o popover ABIERTO |
| `shadow-hard` | `none` | Retirada (compila, no pinta) |
| `shadow-hard-sm` | `none` | Retirada (compila, no pinta) |
| `shadow-sticker` | `none` | Retirada (compila, no pinta) |
<!-- sombras:fin -->

`--shadow-lift` = `0 10px 24px -8px oklch(12% 0.05 262.5 / 0.55)`: corta y
suave, con desplazamiento. Nada de halos de color ni sombras duras.

## Retícula (única)

Todas las páginas con cabecera usan **`page-grid`** (`tailwind.config.ts`):
ancho máximo 72rem, centrado, **16 px** de margen lateral en móvil y
**32 px** desde `md`. La llevan la cabecera pública y la de la app, el pie y
el `<main>` de cada página. Las columnas estrechas (lectura legal, chat,
avisos, ajustes) van **dentro**, alineadas a la izquierda
(`[&>*]:max-w-2xl`), nunca centradas aparte
(`tests/e2e/a11y/grid.spec.ts`).

En las páginas públicas, `AlbumPage` mete la retícula dentro del campo de
color y, con `left` y `right`, pinta un **pliego**: dos páginas con el lomo
en el centro (raya de 2 px) desde `md`, una página cada vez en el móvil.

## Componentes del álbum (`src/components/album`)

Sin `"use client"`: sirven en servidor y en cliente. Ningún texto fijo: el
texto llega por props, traducido con el namespace `album` de
`messages/{es,en}.json` (`album.format.*`, `album.status.*`, `album.slot`,
`album.rating`, `album.foil`, `album.folded`, `album.progress`…).

- **`Cromo`** — la portada con borde blanco de 3 px y radio 4 px, 2:3 (o
  `fill` en una celda bento). El respaldo de color con las iniciales va
  SIEMPRE detrás y primero (`cromoPlaceholder`, dos paradas del mismo
  matiz, nunca violeta): si la portada da 404 queda el color, nunca un
  hueco. Estados: `pasted` (completado, por defecto), `placed` (en curso:
  `ProgressStrip` al pie en el color del formato), `folded` (abandonado:
  esquina superior derecha doblada, sigue legible). `foil` = 10/10. Con
  puntero fino, la esquina se levanta 4° al pasar el ratón por el cromo o
  por su enlace (`group`) y también al enfocar el enlace con teclado; la
  sombra `lift` solo mientras está alzado. `paste="in"` / `"out"` reproduce
  el pegado / despegado. `still` lo deja quieto.
- **`Slot`** — el hueco numerado (pendiente): 2:3, contorno discontinuo de
  2 px (`--slot-line`), número arriba a la izquierda en Lilita One con
  cifras tabulares y el título impreso en pequeño dentro; pestaña de esquina
  en el color del formato (con `formatLabel` para el lector). Con
  `children`, el cromo ocupa el hueco. `band` = la `StatusBand` debajo.
- **`ProgressStrip`** — pista en tinta y relleno del color del formato,
  crece con `transform` (sin mover la maquetación); `label` para el lector.
- **`FormatTag`** — punto del color del formato + su nombre (obligatorio).
- **`StatusBand`** — estado + «hace N días» (`Intl.RelativeTimeFormat`,
  es/en) en `<time dateTime>`.
- **`Foil`** — el brillo: banda especular en bucle, solo en cromos 10/10 y en
  el podio. Es la única animación infinita y se para con movimiento reducido.
- **`AlbumPage`** — la página impresa (aplica `theme-paper`), tono `white`,
  `cyan` o `yellow`, una página o un pliego.
- **`NumberBadge`** — el número en su caja redondeada (Lilita, tabular):
  tintas `surface`, `white`, `navy` y, en páginas públicas, `yellow` /
  `cyan`. Tamaños `sm` (hueco) a `xl` (podio).

Estado de biblioteca → forma (`albumShapeFor`, `src/lib/design/album.ts`):
pendiente = `Slot` vacío; en curso = `Cromo state="placed"`; completado =
`Cromo` pegado (y `foil` si es 10/10, `isFoil`); abandonado =
`Cromo state="folded"`, visible y reversible.

### La tarjeta de catálogo

`PosterFrame` (`src/components/media/PosterFrame.tsx`) conserva su API y ahora
pinta un `Cromo`, así que `MediaRow`, `ContinueRow`, el perfil y las listas
públicas ya son cromos sin cambios. `MediaCard` (rejillas de Descubrir,
Biblioteca, listas, recomendaciones) usa `Cromo` directamente: título y año
DEBAJO (Figtree 600), la nota en una caja de número sobre la esquina con
formato del idioma (8,5) y nombre para el lector, el formato como
`FormatTag` bajo el título (nunca encima de la portada). En catálogo, ninguna
card sin portada (`requirePoster`); en la biblioteca del usuario sí
(respaldo + título). `MediaGrid` pega sus cromos una vez al montar.

## Botones y controles (`src/components/ui`)

- **Primario** (`KButton`): rosa sólido, texto en tinta (`--album-ink`),
  radio 8 px, Figtree 700, 44 px de alto mínimo en pantallas táctiles
  (`pointer-coarse:h-11`). Uno por pantalla.
- **Secundario**: de noche, relleno marino un escalón más claro y texto
  blanco; en papel, blanco con tinta marina y raya de 2 px. Lo deciden los
  tokens `--button-secondary-*`.
- **Elegido** (chip de filtro, segmento, pestaña, página actual, idioma): el
  chip «pegado», en la tinta del texto: `bg-text-primary text-surface-base`
  (blanco con marino de noche, marino con blanco en papel). Nunca rosa (es
  acción) ni amarillo de relleno.
- **Foco**: contorno de 2 px `--focus-ring` con 2 px de separación
  (`focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring`;
  en la navegación, `FOCUS_RING` de `nav-shared`). Amarillo de noche, marino
  en papel. Contorno y no sombra: la sombra se borra en `forced-colors`.
  `:focus-visible` lleva el mismo contorno por defecto en todo lo demás.
- **Transiciones**: solo color y transformación
  (`transition-[color,background-color,border-color,transform]`, o
  `transition-colors`), nunca `transition-all`.
- **Campo** (`KInput`, `Select`, `Input`): relleno `--surface-elevated` y
  borde de 1 px `--field-border`; error con borde `--accent-danger`,
  mensaje `role="alert"` y `aria-invalid` + `aria-describedby`. 16 px en
  móvil.
- **Cifras**: nota con `formatScore` (8,5 / 8.5), recuentos con
  `formatCount` (1.234), fechas relativas con `formatSince`
  (`src/lib/design/format.ts`). Nunca `toFixed` ni `{n && …}` en JSX.

## La app de noche (`src/components/layout`)

Cabecera, barra inferior y pie sobre el fondo (`--surface-base`) con raya de
2 px `--surface-border`. El destino activo lleva la **banda de orientación**:
raya amarilla de 3 px al pie (cabecera, `WAYFINDING_BAND`) o arriba (barra
inferior), con el texto en tinta principal. El contador de avisos es la
única pieza rosa de la cabecera. Logotipo `kultura.` con el punto rosa; el
monograma, tres cromos en rosa, amarillo y cian sobre la superficie elevada.

## Movimiento (`src/lib/motion`)

- Duraciones **180 / 240 / 360 ms** (`duration-fast` / `-base` / `-slow`) y
  cambio de ruta **200 ms** (`duration-route`, `animate-route`).
- Curvas: `ease-out` = `cubic-bezier(.2,.8,.2,1)`; `ease-paste` =
  `cubic-bezier(.3,1.3,.5,1)` (el cromo cae con un pequeño rebote y se
  asienta; `animate-paste`, y `animate-unpaste` en 180 ms).
- Con `prefers-reduced-motion`: todo instantáneo y el brillo parado.
- Dentro de la app **nada va ligado al scroll**. En las páginas públicas, un
  pegado escalonado por rejilla la primera vez que entra en pantalla.
- **GSAP** (`gsap@3.15.0`) solo para secuencias orquestadas y SIEMPRE con
  import dinámico, nunca en el layout: el JS inicial de cada ruta sigue en
  ≤ 150 KB. Ayudas: `prefersReducedMotion()`, `loadGsap()` (import
  memorizado), `pasteGrid(elementos)` (una vez, 40 ms por cromo, ≤ 600 ms
  en total, parte de un estado visible, nada con movimiento reducido),
  `pasteSchedule(n)` y el hook `usePasteGrid(ref, { trigger })` (`mount` en
  la app, `enter` en público). Para un hover o un pegado suelto, CSS.
- Prohibido: confeti, medallas, rachas, sonidos, contadores que suben,
  rebotes en bucle, scroll secuestrado, carruseles automáticos, parallax en
  texto, cargas con porcentaje, cursores propios, halos, cualquier entrada
  de más de 600 ms.

## Principio de extensión

Ante una pantalla nueva, se construye con estas piezas: `page-grid`,
`AlbumPage` (público) o el fondo de noche (app), `Slot` / `Cromo` /
`NumberBadge` / `StatusBand` para los títulos, `KButton` y los controles de
`ui`, los radios y la escala de arriba. Si algo no está aquí, se replica el
patrón más parecido que exista; no se inventa paleta, sombra ni radio.

## Referencia: tokens OKLCH → hex sRGB

El OKLCH manda; el hex es su conversión **exacta** a sRGB (la que pinta
Chrome, recortando al gamut), para lo que no entiende OKLCH: `theme_color`,
imágenes OG, correos. `tests/unit/design/diseno-doc.test.ts` falla si no
coincide. La conversión está en `src/lib/design/color.ts`. Valores de noche
(`:root`).

| Token | Alias | OKLCH | Hex sRGB | Uso |
|-------|-------|-------|----------|-----|
| `--album-cyan` | — | `oklch(66.9% 0.147 237.2)` | `#00a0e3` | Cian de imprenta (campos públicos, orientación) |
| `--album-yellow` | — | `oklch(91.7% 0.192 101.4)` | `#ffe600` | Amarillo (campos públicos, foco y banda de noche) |
| `--album-navy` | — | `oklch(30.9% 0.119 262.5)` | `#0b2a6b` | Tinta marina (texto en papel) |
| `--album-white` | — | `oklch(100% 0 0)` | `#ffffff` | Página, borde del cromo |
| `--album-pink` | — | `oklch(66.2% 0.246 0.9)` | `#ff2d8a` | La acción |
| `--album-ink` | — | `oklch(18% 0.06 262.5)` | `#04102c` | Texto sobre rosa, amarillo y cian |
| `--format-movie` | — | `oklch(69.2% 0.22 358.6)` | `#ff4f9a` | Película |
| `--format-tv` | — | `oklch(72.2% 0.148 252.3)` | `#5aa9ff` | Serie |
| `--format-anime` | — | `oklch(90% 0.191 123.3)` | `#c6f24e` | Anime |
| `--format-manga` | — | `oklch(70.9% 0.184 29.1)` | `#ff6b5a` | Manga |
| `--format-game` | — | `oklch(81.3% 0.125 203.5)` | `#3fd9e6` | Videojuego |
| `--format-book` | — | `oklch(82.1% 0.149 72.1)` | `#ffb347` | Libro |
| `--format-comic` | — | `oklch(90.7% 0.164 97.2)` | `#ffe04a` | Cómic |
| `--format-movie-ink` | — | `oklch(72% 0.2 358.6)` | `#ff63a3` | Película como texto de noche |
| `--surface-base` | `--bg` | `oklch(21% 0.068 262.5)` | `#061637` | Fondo de noche |
| `--surface-default` | `--surface` | `oklch(25.5% 0.08 262.5)` | `#0c2049` | Huecos, tarjetas |
| `--surface-elevated` | `--surface-2` | `oklch(30.5% 0.09 262.5)` | `#152c5c` | Secundario, campo, banda de estado |
| `--surface-border` | `--stroke` | `oklch(38% 0.09 262.5)` | `#274172` | Rayas de 2 px, hover del secundario |
| `--text-primary` | `--text` | `oklch(98% 0.006 262.5)` | `#f6f8fd` | Texto principal |
| `--text-secondary` | — | `oklch(86% 0.035 262.5)` | `#c5d2e9` | Texto secundario |
| `--text-tertiary` | `--muted` | `oklch(76% 0.05 262.5)` | `#a0b2d2` | Texto terciario, fechas |
| `--accent-pink` | `--pink` | `oklch(66.2% 0.246 0.9)` | `#ff2d8a` | Botón primario |
| `--accent-pink-hover` | — | `oklch(71% 0.22 0.9)` | `#ff559a` | Primario al pasar el ratón |
| `--accent-lime` | `--lime` | `oklch(91.7% 0.192 101.4)` | `#ffe600` | Heredado (= amarillo) |
| `--accent-orange` | `--orange` | `oklch(82.1% 0.149 72.1)` | `#ffb347` | Heredado (= libro) |
| `--accent-purple` | `--purple` | `oklch(66.9% 0.147 237.2)` | `#00a0e3` | Heredado (= cian; no hay violeta) |
| `--accent-blue` | `--blue` | `oklch(72.2% 0.148 252.3)` | `#5aa9ff` | Heredado (= serie) |
| `--accent-yellow` | `--yellow` | `oklch(91.7% 0.192 101.4)` | `#ffe600` | Heredado (= amarillo) |
| `--accent-positive` | — | `oklch(80% 0.17 150)` | `#5edb81` | Estado positivo |
| `--accent-highlight` | — | `oklch(91.7% 0.192 101.4)` | `#ffe600` | Nota, destacado |
| `--accent-info` | — | `oklch(72.2% 0.148 252.3)` | `#5aa9ff` | Información, enlaces |
| `--accent-danger` | — | `oklch(62% 0.21 25)` | `#ea3c3f` | Rojo: fondos y bordes de error |
| `--accent-danger-text` | — | `oklch(74% 0.16 25)` | `#ff7e76` | Rojo: texto de error |
| `--accent-danger-solid` | — | `oklch(55% 0.21 25)` | `#d01c29` | Rojo: botón destructivo |
| `--on-accent-danger` | — | `oklch(97% 0.01 25)` | `#fcf3f2` | Texto sobre rojo sólido |
| `--field-border` | — | `oklch(63% 0.07 262.5)` | `#7289b4` | Borde de campo |
| `--focus-ring` | — | `oklch(91.7% 0.192 101.4)` | `#ffe600` | Foco de noche (= amarillo) |
| `--on-accent-pink` | — | `oklch(18% 0.06 262.5)` | `#04102c` | Texto sobre rosa |
| `--cromo-back` | — | `oklch(93% 0.02 237)` | `#dceaf4` | Dorso del cromo (esquina doblada) |

En papel, los hex principales: fondo `#ffffff`, texto `#0b2a6b`, secundario
`#29457d`, terciario `#3f5a8d`, superficie elevada `#e9f6fe`, borde
`#bed4eb`, borde de campo `#5571a6`, foco `#0b2a6b`.
