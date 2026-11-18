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

## A · Sala — construida

**Idea.** Entrar en la ficha es entrar en la sala: la portada ocupa la pantalla y el título vive dentro de ella, con partes de la imagen pasando por delante de las letras. Al bajar, una franja con el color de la portada (título original, datos, acciones) y la ficha sobre un fondo teñido.

**Paleta.** La sala es la portada; el tema no la cambia. Lleva solo el velo mínimo para que el título se lea, calculado con la propia portada: tinta clara sobre velo oscuro (se lee como sombra) y, si la portada es clara, tinta oscura sobre velo claro. Debajo:
- Franja: `--kp-field`, el color más vivo de la portada como bloque entero, con su tinta (≥ 4.5:1). En claro, más luminoso (L 0.52–0.80); en oscuro, más hondo (L 0.30–0.50).
- Fondo de la ficha: `--kp-bg`, teñido con el tono dominante. Claro L 0.905 (un gris de color, no blanco); oscuro L 0.165.
- Panel lateral: `--kp-surface` (un paso de tono, sin líneas ni sombras). Enlaces: `--kp-accent`.

**Tipografía.**
- Rótulo: **Anybody** (variable en peso y en anchura, 50–150). La anchura se elige por la longitud del título: uno corto se ensancha, uno largo se estrecha, y el tamaño se ajusta hasta llenar el ancho en 1–2 líneas (3 en móvil). SIL OFL 1.1 — https://github.com/Etcetera-Type-Co/Anybody (licencia: https://github.com/google/fonts/blob/main/ofl/anybody/OFL.txt).
- Texto: **Instrument Sans**. SIL OFL 1.1 — https://github.com/Instrument/instrument-sans (licencia: https://github.com/google/fonts/blob/main/ofl/instrumentsans/OFL.txt).
- Las dos cubren latín ampliado (`latin-ext`). Hangul y japonés: **Noto Sans KR / JP** (SIL OFL 1.1 — https://github.com/notofonts/noto-cjk) y, detrás, la pila del sistema.

**Portada.** Entera, sin recortar, a toda la altura (escritorio: a la derecha, sobre su propia copia borrosa que llena la sala; móvil: a todo el ancho, arriba). Las imágenes apaisadas (juegos de RAWG) llenan la sala en escritorio y se recortan a 4:5 en móvil. Capas, de atrás adelante: copia borrosa · portada · velo · título · **letras fundidas** (las zonas de la portada que se apartan del color de fondo dominante se pintan otra vez por delante de las letras, como mucho en el 22 % de la zona del título). Todo sale de la portada ya cargada en el navegador: sin mapas de profundidad y sin copias.

**Movimiento (2D, CSS).** Una entrada (la portada se asienta, el título sube). Con ratón, el plano y el fondo se mueven en sentidos contrarios. Al bajar, la sala se queda atrás (animación ligada al scroll donde el navegador la admite). Con movimiento reducido: todo quieto y nada oculto.

**Composición.** Móvil: portada · título a caballo del borde inferior · franja (título original, datos, acción principal a todo el ancho) · sinopsis · panel · dónde ver · tráiler. Escritorio: sala a pantalla completa; franja en dos columnas; ficha en 12 columnas (sinopsis 7, panel 4).

**Tráiler.** Botón «Tráiler» en la sala, junto al título (con cursor aparece al pasar por la sala o al llegar con el teclado; en táctil se ve siempre). Al pulsarlo (clic, toque, Intro) la sala entera pasa a ser el reproductor de `youtube-nocookie` a lo ancho (16:9), en silencio, con sus controles y su marca y sin nada encima: se retiran portada, velos y letras fundidas. Debajo del marco, el título y «Cerrar el tráiler»; Escape también cierra y el foco vuelve al botón. Antes de pulsar no sale ninguna petición a YouTube. Capturas: `capturas/a/*-trailer.png`.

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

- **[P] Letras fundidas (A).** Parte de las letras queda tapada por la imagen: es el efecto que pide §7.1, pero resta legibilidad al `h1`. El velo garantiza 3.6:1 del título contra lo que tiene detrás (AA para texto grande pide 3:1); lo tapado no se puede medir como contraste. Límite actual: 22 % de la zona del título. Hay un interruptor «Letras fundidas» en la sala para verlo con y sin; se apaga solo con `prefers-contrast: more`. Cuadra con la salida 1 de §7.1: el texto real está en el HTML y la capa de delante es adorno (`aria-hidden`).
- **[P] La sala no cambia con el tema (A).** En claro, una portada oscura sigue siendo una sala oscura; cambia todo lo de debajo. La alternativa (aclarar la portada con un velo claro) se probó y la deja lechosa.
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
