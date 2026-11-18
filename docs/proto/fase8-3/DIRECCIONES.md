# Fase 8.3 · Tres direcciones para la ficha

Rama desechable `proto/fase8-3-direcciones` (no se fusiona). Decide Víctor viéndolas: `/es/proto/ficha`.

Parten de cero y de las referencias de §7.1 del plan: MUBI (la obra a pantalla completa), Apple Music/TV (el color sale de la portada), Cosmos (limpio, portadas con animación) y lo único que Víctor salva del diseño actual: portadas con profundidad y las letras fundidas dentro de la imagen. Ninguna usa JetBrains Mono, Newsreader ni la biblia «Archivo».

Lo que cambia de verdad entre las tres es **qué hace de suelo de la página**:

| | A · Sala | B · Objeto | C · Pliego |
|---|---|---|---|
| Suelo | La imagen | El color de la portada | Un papel neutro |
| La portada es | El espacio (llena la pantalla) | Una cosa con cuerpo | Una ventana |
| Quién manda | El título dentro de la imagen | La portada-objeto y su color | La letra y el orden |
| Color de la portada | Una franja entera + velo de la sala | Toda la página | Un acento pequeño |
| Movimiento | Profundidad por capas | El objeto gira y brilla | La imagen respira dentro del marco |
| Referencia | MUBI + capas de la landing | Apple Music / TV | Cosmos |

---

## A · Sala — elegida (con matices de Víctor)

> Capa 3D de la sala (`?3d=capas`, `?3d=fondo`, `?fps=1`): ver [`3d-ficha-borrador.md`](3d-ficha-borrador.md).

**Idea.** Entrar en la ficha es entrar en la sala: una imagen de la obra **sin rótulo** ocupa la pantalla a sangre, como en MUBI, y el título —que ponemos nosotros— vive dentro de ella, con partes de la imagen pasando por delante de las letras. Al bajar, una franja con el color de la imagen (título original, datos, acciones) y la ficha sobre un fondo teñido.

**Dos modos, según lo que dé el proveedor.**

| Formato | Imagen de la sala | De dónde sale | Modo |
|---|---|---|---|
| Película, serie | Imagen de fondo de TMDB sin texto | `/movie/{id}/images` o `/tv/{id}/images` con `include_image_language=null` (las de `iso_639_1: null` y al menos 1280 × 720, la más votada); si no hay, el `backdrop` de la ficha. `image.tmdb.org`, directa: `w780`, `w1280` y `original` en el `srcset` | Sala (apaisada a sangre, título fundido) |
| Videojuego | Arte de RAWG | `background_image` (ya era la «portada» del juego). `media.rawg.io`, directa: `resize/640`, `resize/1280` y el original | Sala |
| Anime | La portada | `/cover/large/` de AniList. El banner (`bannerImage`, 1900 × 400) ya no se pide: a pantalla completa había que ampliarlo ×2 | Pieza |
| Libro, manga, cómic | La portada (siempre trae su rótulo) | La de siempre, en su versión mayor: `-L` de Open Library; el original de MangaDex por el optimizador (no la miniatura de 512 px) | Pieza |

- **Sala:** la imagen llena la sala (escritorio: toda la pantalla; móvil: todo el ancho, recortada a 4:5 por el centro) y el título va dentro, fundido. El color de la página sale de esa imagen.
- **Pieza:** la portada entera, sin recortar, centrada sobre un campo plano de su color (el mismo de la franja: sala y franja son un solo bloque) y nuestro título debajo, a todo el ancho, **sin fundir** y sin velo (tinta del campo, ≥ 4.5:1). No hay copia borrosa de la portada. Mismas fuentes, esquinas rectas y franja que en Sala.
- **[P]** La petición nueva (TMDB `/images`) solo existe en `_base/art.ts`. Si A sigue adelante pasa al cargador real y por la revisión legal. La de `bannerImage` de AniList se ha quitado (ver la regla de calidad).

**Regla de calidad de imagen (Víctor, 18-11-2026; vale para 2D y 3D).** Las imágenes de la sala y las portadas van siempre nítidas.
- Se pide la resolución que la pantalla necesita (tamaño en pantalla × DPR): el `srcset` de la sala llega hasta el original del proveedor y `sizes` dice el ancho real (en móvil la imagen apaisada se ve más ancha que la pantalla: recorte 4:5).
- **Nunca se amplía una imagen más de 1,25× su tamaño natural** (medido en px CSS). Para ser sala, una imagen apaisada tiene que medir al menos 1280 × 720; si no llega, la obra va en **Pieza**. Además, la sala no crece más de 1,25× el tamaño natural de su imagen (`--a-max-w`, `--a-max-h`): en una pantalla mayor queda centrada sobre su copia borrosa.
- En Pieza la portada se pinta **a su tamaño natural como mucho** (`width: auto`, sin `srcset`: solo topes), nunca ampliada.
- En 3D las texturas salen del mismo archivo que el `<img>`, a su tamaño real; solo se reducen si pasan de lo que el lienzo enseña (tope 4096 px de lado).
- Medido en las cinco obras (tabla en `3d-ficha-borrador.md`): ninguna se amplía en px CSS. **[P]** En px de pantalla, con DPR 2–3 las portadas pequeñas siguen por debajo de la pantalla porque el proveedor no da más (Open Library `-L`: 331 × 500; AniList `large`: 460 × 656). Cumplir 1,25× también en px de pantalla obligaría a pintarlas a ~200 px CSS de ancho en un móvil. Queda a decisión de Víctor.

**Títulos.** El `h1` va en el idioma de la página y el original, debajo, en su escritura y con su `lang` (Parásitos / 기생충, El viaje de Chihiro / 千と千尋の神隠し, Gente normal / Normal People, Berserk / ベルセルク). **Hueco de datos para la fase 8.5:** solo TMDB da el título localizado. AniList da romaji, inglés y nativo (nunca español); Open Library da el título de la obra sin idioma; MangaDex da `en` (a menudo una romanización) y alternativos por idioma, incompletos; RAWG, solo el nombre en inglés. En el prototipo las cinco obras fijas llevan el título por idioma escrito a mano en `_base/works.ts` (apaño, marcado como tal); cualquier otra obra sale con el título del proveedor.

**Paleta.** En modo Sala, la sala es la imagen; el tema no la cambia. Lleva solo el velo mínimo para que el título se lea, calculado con la propia imagen: tinta clara sobre velo oscuro (se lee como sombra) y, si la portada es clara, tinta oscura sobre velo claro. Debajo:
- Franja: `--kp-field`, el color más vivo de la portada como bloque entero, con su tinta (≥ 4.5:1). En claro, más luminoso (L 0.52–0.80); en oscuro, más hondo (L 0.30–0.50).
- Fondo de la ficha: `--kp-bg`, teñido con el tono dominante. Claro L 0.905 (un gris de color, no blanco); oscuro L 0.165.
- Panel lateral: `--kp-surface` (un paso de tono, sin líneas ni sombras). Enlaces: `--kp-accent`.

**Tipografía.**
- Rótulo: **Anybody** (variable en peso y en anchura, 50–150). La anchura se elige por la longitud del título: uno corto se ensancha, uno largo se estrecha, y el tamaño se ajusta hasta llenar el ancho en 1–2 líneas (3 en móvil). SIL OFL 1.1 — https://github.com/Etcetera-Type-Co/Anybody (licencia: https://github.com/google/fonts/blob/main/ofl/anybody/OFL.txt).
- Texto: **Instrument Sans**. SIL OFL 1.1 — https://github.com/Instrument/instrument-sans (licencia: https://github.com/google/fonts/blob/main/ofl/instrumentsans/OFL.txt).
- Las dos cubren latín ampliado (`latin-ext`). Hangul y japonés: **Noto Sans KR / JP** (SIL OFL 1.1 — https://github.com/notofonts/noto-cjk) y, detrás, la pila del sistema.

**Capas (modo Sala).** De atrás adelante: imagen · velo · título · **letras fundidas** (las zonas de la imagen que se apartan del color de fondo dominante se pintan otra vez por delante de las letras, como mucho en el 22 % de los **píxeles de letra**, en el título entero y en cada una de sus líneas; se busca el 20 % y se recalcula a cada ancho; si una imagen no da para fundir sin pasarse, esa obra va sin fundido). En móvil, la parte del título que cae por debajo de la imagen va sobre una copia borrosa de ese mismo arte. Todo sale de la imagen ya cargada en el navegador: sin mapas de profundidad y sin copias.

**Movimiento (2D, CSS).** Una entrada (la portada se asienta, el título sube). Con ratón, el plano y el fondo se mueven en sentidos contrarios. Al bajar, la sala se queda atrás (animación ligada al scroll donde el navegador la admite). Con movimiento reducido: todo quieto y nada oculto.

**Composición.** Móvil: imagen · título a caballo del borde inferior (en Pieza: portada · título debajo) · franja (título original, datos, acción principal a todo el ancho) · sinopsis · panel · dónde ver · tráiler. Escritorio: sala a pantalla completa; franja en dos columnas; ficha en 12 columnas (sinopsis 7, panel 4); el tráiler, a lo ancho, al final.

**Tráiler.** Aparte de la sala (decisión de Víctor): la sala queda solo con portada y título fundido. El tráiler tiene su sección «Tráiler» al final de la ficha: un marco 16:9 y la orden «Ver el tráiler». **La imagen del marco nunca es la de la sala** (regla de Víctor, 18-11-2026): es otra imagen oficial sin rótulo (la segunda más votada de TMDB `/images` con `iso_639_1: null`); si la obra no tiene una segunda imagen, el marco va sin imagen: un campo plano del color de la obra (`--kp-field`) con el botón. Nunca una miniatura de YouTube (`i.ytimg.com`): sería una petición a Google antes de pulsar. Al pulsarlo (clic, toque, Intro) el mismo marco pasa a ser el reproductor de `youtube-nocookie`, en silencio, con sus controles y su marca y sin nada encima. Debajo, «Cerrar el tráiler»; Escape también cierra y el foco vuelve al botón. Antes de pulsar no sale ninguna petición a YouTube. Capturas: `capturas/a/*-trailer*.png`.

**Qué la distingue.** Es la única donde la imagen es el suelo y el título es parte de la imagen. La más cinematográfica y la que mejor prepara el 3D (las capas ya existen).

---

## B · Objeto — por construir

**Idea.** La portada es una cosa que se puede coger: un libro con lomo, una caja de juego, un cartel, un tomo. Está sola en el centro sobre un ambiente del color que ella misma da, y toda la página (botones, paneles, texto) se tiñe de ese color.

**Paleta.** El color lo es todo aquí. Fondo = `--kp-field` a página completa en la primera pantalla (en claro, el color luminoso de la portada; en oscuro, su versión honda), con un halo suave hecho con `--cv-c1…c3` detrás del objeto. El resto de la página baja a `--kp-bg` / `--kp-surface`. Acción principal en `--kp-field-ink` sobre el campo. Nunca blanco: el claro es el color de la portada aclarado.

**Tipografía.**
- Títulos: **Gabarito** (geométrica con carácter, 400–900). SIL OFL 1.1 — https://github.com/naipefoundry/gabarito (licencia: https://github.com/google/fonts/blob/main/ofl/gabarito/OFL.txt).
- Texto: **DM Sans**. SIL OFL 1.1 — https://github.com/googlefonts/dm-fonts (licencia: https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt).
- Respaldo CJK: Noto Sans KR / JP (base) y pila del sistema.
- Título centrado, tamaño medio (la portada manda, no el rótulo).

**Portada.** Tamaño contenido (≈ 55 % del alto en móvil, ≈ 420 px de ancho en escritorio), nunca recortada, con **cuerpo según el formato**: libro y manga con lomo y canto de páginas; juego con caja; película y anime como cartel con borde; cómic grapado. Eso además distingue el formato sin depender del color. Una sombra de contacto (es lo único que flota). Esquinas redondeadas pequeñas.

**Movimiento.** El objeto se inclina unos grados hacia el puntero (o con el scroll en móvil) y un brillo cruza la cubierta; al entrar, se posa. CSS 3D (`perspective`, `rotate`), sin three.js.

**Composición.** Móvil: objeto centrado · título y título original centrados · una fila de acciones redondeadas · datos en fichas del color · sinopsis. Escritorio: objeto a la izquierda, fijo mientras se baja (`sticky`); a la derecha, título, acciones y la ficha en una columna de lectura.

**Hueco del tráiler.** Al pasar por encima, el objeto «se abre» y el tráiler se ve en su cara. Pendiente de legal.

**Qué la distingue.** Es la única centrada, redondeada y con el color como protagonista absoluto. La portada no es un espacio ni una ventana: es un objeto.

---

## C · Pliego — por construir

**Idea.** Una página serena, como un pliego bien compuesto: mucha letra, mucho aire y la portada en una ventana donde la imagen se mueve despacio. El color de la portada aparece poco y por eso se nota.

**Paleta.** Suelo neutro que NO es blanco: en claro, un gris piedra (`--kp-bg` con el croma al mínimo; propuesta L 0.88) y en oscuro, grafito. El color de la portada solo en: la acción principal (`--kp-accent`), el subrayado de los enlaces y una pastilla de color junto al formato. Sin campos de color grandes.

**Tipografía.**
- Títulos: **Fraunces** (serif variable con eje óptico; se usa fina y grande). SIL OFL 1.1 — https://github.com/undercasetype/Fraunces (licencia: https://github.com/google/fonts/blob/main/ofl/fraunces/OFL.txt).
- Texto y datos: **Geist**. SIL OFL 1.1 — https://github.com/vercel/geist-font (licencia: https://github.com/google/fonts/blob/main/ofl/geist/OFL.txt).
- Respaldo CJK: Noto Sans KR / JP (base) y pila del sistema.
- **[P]** Es la única con serif. Fraunces no se parece a Newsreader (es de rótulo, blanda y con contraste), pero si el «no» de Víctor es a las serif en general, la alternativa es Schibsted Grotesk (SIL OFL 1.1 — https://github.com/schibsted/schibsted-grotesk).

**Portada.** Tamaño medio, dentro de un marco fijo (4:5) que hace de ventana: la portada es algo mayor que el marco y se desplaza muy despacio dentro de él (y se recoloca al pasar el puntero). Esquinas rectas, sin sombra.

**Movimiento.** Solo la ventana: deriva lenta de la imagen, con pausa (WCAG 2.2.2) y parada con movimiento reducido. Las secciones no entran animadas.

**Composición.** Rejilla asimétrica. Móvil: título grande arriba · ventana de portada a 2/3 del ancho, pegada a la derecha · datos en lista · acciones · sinopsis. Escritorio: título a todo el ancho arriba; debajo, tres columnas (datos estrechos · sinopsis · ventana de portada), todo alineado a dos o tres ejes.

**Hueco del tráiler.** La ventana de la portada es el reproductor: al pasar por encima, el tráiler sustituye a la imagen dentro del mismo marco. Pendiente de legal.

**Qué la distingue.** Es la única que no usa el color de la portada como suelo ni la portada como espacio. La más tranquila y la que mejor aguanta textos largos.

---

## Decisiones para Víctor

- **[P] Letras fundidas (A).** Parte de las letras queda tapada por la imagen: es el efecto que pide §7.1, pero resta legibilidad al `h1`. Dos garantías, medidas con Playwright en las cinco obras, claro y oscuro, a 375, 640 y 1440: (1) el velo se calcula con lo que el título tiene detrás de verdad a ese ancho (la portada y la copia borrosa del fondo) y deja el 100 % de la letra a ≥ 3:1 (se busca 3.6:1; AA para texto grande pide 3:1); (2) lo tapado no pasa del 22 % de los píxeles de letra, ni en el título entero ni en una línea (se busca el 20 %). Lo tapado no se puede medir como contraste. Hay un interruptor «Letras fundidas» en la sala para verlo con y sin; se apaga solo con `prefers-contrast: more`. Cuadra con la salida 1 de §7.1: el texto real está en el HTML y la capa de delante es adorno (`aria-hidden`). Queda por decidir si el 22 % es el tope bueno.
- **[P] Idioma del título.** Las cinco obras fijas llevan el título en el idioma de la página (apaño en `_base/works.ts`, ver «Títulos» en A). Para cualquier otra obra, el `h1` lleva `lang` solo cuando los datos lo dicen: por la escritura (hangul, kana…), en TMDB cuando devuelve el título original (con su `original_language`) y en AniList cuando el título es su campo `english`. Open Library, Google Books, MangaDex, RAWG y ComicVine no dicen en qué idioma está el título: se queda sin `lang`, no se adivina.
- **[P] La sala no cambia con el tema (A).** En claro, una imagen oscura sigue siendo una sala oscura (en modo Pieza el campo sí sigue al tema); cambia todo lo de debajo. La alternativa (aclarar la portada con un velo claro) se probó y la deja lechosa.
- **[P] Portada de Google Books.** Su servidor no manda CORS: para leer el color se pide una miniatura de 256 px al optimizador de Vercel. Es la misma copia temporal que ya se hace con MangaDex, ComicVine y Steam, pero para un host que hoy va directo. Si no se quiere, esos libros se quedan con la paleta neutra.
- **[P] Portadas de AniList.** La API da la mediana (≈ 230 px), que a pantalla completa se ve borrosa; el prototipo pide la grande del mismo CDN (`/cover/large/`).
- **[P] Serif en C** (arriba).

---

## Contrato para B y C

Cada dirección se construye **solo dentro de su carpeta**. La base ya monta la ruta, los datos, el tema, el movimiento y el color.

### Qué crear (y solo ahí)

```
src/app/[locale]/proto/ficha/_dirs/b/   (o c/)
  Ficha.tsx    Server Component, `export default function Ficha({ data }: DirectionProps)`. Sustituye al marcador.
  fonts.ts     `export const fontClassName` (variables de next/font). Sustituye al marcador.
  b.css        Todo bajo `.kp-b` (o `.kp-c`). Lo importa Ficha.tsx.
  *.tsx        Componentes cliente propios, si hacen falta.
docs/proto/fase8-3/capturas/b/  (o c/)   `b-<obra>-<tema>-<ancho>.png`
```

### Qué NO tocar

`_base/**`, `_dirs/registry.ts`, `_dirs/a/**`, la carpeta de la otra dirección, `page.tsx`, `layout.tsx`, `[dir]/[type]/[id]/page.tsx`, `src/middleware.ts`, `.env*`, y nada fuera de `proto/`. Si falta algo en la base, se anota y se pide: no se cambia por libre (dos agentes trabajan a la vez).

### Qué recibe una dirección

`DirectionProps = { data: FichaData }` (`_base/types.ts`). `FichaData` trae ya resuelto, con el mismo cargador que la ficha real (`loadMediaDetail`):

- `title`, `originalTitle` (solo si es distinto; en anime, el título en japonés), `originalTitleLang` (`ko`, `ja`… para el atributo `lang`), `year`, `type`, `typeLabel`.
- `facts` (año, formato, duración/episodios/páginas) y `credits` (dirección, reparto, autoría, plataformas…): `{ key, label, value }[]`.
- `genres`, `ratings` (`{ label, value }`, la escala va en el texto), `synopsis`, `synopsisLang`.
- `cover: CoverSource | null` — `src`, `srcSet`, `small` (miniatura para capas borrosas), `canvasSafe`, `sample`, `shape` (`portrait` | `landscape`: los juegos llegan apaisados).
- `trailerKey`, `providers`, `watchLink`, `steam`, `source`, `labels` (textos en es/en) e `item` (el `MediaItem` crudo).

### Reglas de la portada

- El `<img>` principal lleva `data-kp-cover=""`, `alt=""` y `crossOrigin={data.cover.canvasSafe ? "anonymous" : undefined}`. La base lo busca para sacar el color. Uno por página.
- **Cualquier otra `<img>` de la misma portada** (copia borrosa, reflejo…) lleva el mismo `crossOrigin`. Si una va sin él, el navegador guarda en caché la respuesta sin CORS y el canvas ya no puede leer la portada (pasó con AniList).
- Usar `cover.src` / `cover.srcSet` tal cual (ya aplican el criterio de la app: MangaDex, ComicVine y Steam por `/_next/image`; el resto, directo).
- Puede no haber portada (`cover === null`): la ficha tiene que seguir bien.
- Nada de guardar imágenes ni colores en servidor, ni mapas de profundidad, ni three.js (el 3D lo hace otro agente sobre la dirección que gane).

### Utilidades compartidas (`_base/`)

- **Tokens de color** (`proto.css`), ya con contraste garantizado en claro y en oscuro para cualquier portada (`tests/unit/proto/cover-palette.test.ts`):

  | Token | Uso | Garantía |
  |---|---|---|
  | `--kp-bg`, `--kp-surface` | Fondo y panel | — |
  | `--kp-ink` | Texto | ≥ 7:1 sobre bg y surface |
  | `--kp-ink-2` | Texto secundario | ≥ 4.5:1 sobre bg y surface |
  | `--kp-accent` / `--kp-accent-ink` | Enlaces y relleno de acción / su texto | ≥ 4.5:1 sobre bg y surface / sobre accent |
  | `--kp-edge` | Bordes de controles | ≥ 3:1 sobre bg y surface |
  | `--kp-field` / `--kp-field-ink` | Bloque grande del color de la portada / su texto | ≥ 4.5:1 entre sí |
  | `--cv-c1…c6` | Colores crudos de la portada | Ninguna: solo adorno |

  Antes de leer la portada (y si no da color) valen los neutros. Cualquier otra pareja de colores (p. ej. `--kp-accent` sobre `--kp-field`) **no** está garantizada: se comprueba o no se usa.
- **Tema**: `.kp[data-theme="light" | "dark"]`; sin atributo manda `prefers-color-scheme`. Usando solo tokens `--kp-*` no hay que escribir nada por tema.
- **Movimiento**: la base anula animaciones y transiciones con el interruptor o con `prefers-reduced-motion`. Regla: el estilo en reposo es el estado **final** y las animaciones de entrada solo llevan `from`; así nada queda oculto sin movimiento. En JS: `const { theme, reducedMotion } = useProto()` (`_base/ProtoShell`).
- **Color en JS**: evento `kp:cover` en `.kp` con la `CoverPalette`; `readPixels(img, tamaño)` (`_base/CoverColor`); `extractSwatches`, `derivePalette` (`_base/cover-palette`); `contrast`, `rgbToLch`, `lchToRgb`, `ensureContrast` (`_base/color`).
- **Bloques sin estilo** (`_base/content/`): `Actions` (botones de maqueta), `FactList`, `Synopsis`, `Genres`, `Ratings`, `WhereToWatch`, `SteamBlock`, `TrailerSlot`, `SourceLine`. Clases `kp-*`; cada dirección las viste bajo su prefijo. Se pueden no usar y pintar `FichaData` a mano.
- **CJK**: terminar siempre el `font-family` con `var(--kp-cjk)`.
- `--kp-bar-h`: alto de la barra del prototipo (pegada arriba).

### Fuentes

En `_dirs/<x>/fonts.ts`, con `next/font/google`, `subsets: ["latin", "latin-ext"]` y variables `--font-b-*` / `--font-c-*`; exportar `fontClassName` con las `.variable`. La base pone esas clases en `.kp`. Solo fuentes OFL o Apache, con la URL de la licencia en un comentario. Sin dependencias npm nuevas (la base no ha añadido ninguna). Si se añadiera un archivo de fuente al repo, lleva su fila en `assets/LICENSES.csv`; con `next/font/google` no se añade ninguno.

### Obligatorio en cada dirección

- Claro y oscuro, 375 y 1440, las cinco obras de `_base/works.ts` (película con hangul, libro, juego apaisado con Steam, manga por el optimizador, anime con título japonés).
- Todo el texto en el HTML del servidor; lo decorativo, `aria-hidden`. Un solo `h1`. `<main id="main-content">`.
- Contraste AA; el formato nunca solo por color; foco visible; sin desborde horizontal; zonas táctiles ≥ 44 px en las acciones.
- El tráiler no se construye: se deja el hueco (`TrailerSlot` o uno propio con `data-kp-slot="trailer"`).
- `npx tsc --noEmit` limpio. Capturas con Playwright (ya está en `node_modules`): tema por `localStorage.setItem("kp-theme", "dark" | "light")`.
