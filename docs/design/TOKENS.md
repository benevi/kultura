# Tokens de «Sala»

Cómo se usan los tokens de la dirección «Sala». Qué es «Sala» y por qué está en [`BIBLIA.md`](BIBLIA.md); aquí solo va lo práctico. Para verlos: Storybook, **Sala/Fundamentos** (`npm run storybook`).

**Fuente de verdad:** [`src/lib/design/sala-tokens.ts`](../../src/lib/design/sala-tokens.ts). Ningún valor se escribe en otro sitio: el CSS se genera y Tailwind y Storybook lo leen de ahí.

## Dónde están

| Qué | Dónde | Cómo se cambia |
|---|---|---|
| Valores | `src/lib/design/sala-tokens.ts` | A mano. Después, `npm run tokens:sala` |
| Variables CSS `--sala-*` | `src/styles/sala/tokens.css` (generado) | No se edita. `tests/unit/design/sala-tokens-css.test.ts` falla si no coincide |
| Clases | `tailwind.config.ts` (lee el `.ts`) | Solas |
| `@font-face` | `src/styles/sala/fonts.css`, `fonts-jp.css`, `fonts-kr.css` (generados) | `npm run fonts:sala -- <dir>`; ver la cabecera de `scripts/gen-sala-fonts.mjs`. Se para si los paquetes no son de la versión fijada o un `.woff2` no coincide |
| Paleta de una obra → variables | `src/lib/design/sala-palette.ts` | — |

**Conviven con los tokens de hoy.** Todo lleva el prefijo `sala` (`--sala-ink`, `bg-sala-panel`, `sala-type-heading`) y vive en hojas que la app todavía no importa: solo las carga Storybook. Los `--surface-*`, `--text-*`, las clases y las fuentes de las pantallas actuales no cambian. Una pantalla de la 8.5 empieza a usar «Sala» importando `tokens.css` y `fonts.css`.

## Tema

`data-theme="light"` o `"dark"` en `<html>` (o en cualquier contenedor, también dentro de una obra: cambia de tema y conserva su paleta). Sin atributo vale el oscuro, que es la app de hoy.

Para la 8.5 («por defecto, el del sistema»): `salaTokensCss({ followSystem: true })` añade el bloque `prefers-color-scheme` para cuando `<html>` no lleva atributo. Hoy está apagado. Un componente nunca pregunta por el tema: usa el token.

## Color

| Clase (`bg-`, `text-`, `border-`…) | Para qué | Mínimo |
|---|---|---|
| `sala-background`, `sala-panel` | Fondo y panel (un paso de tono, sin líneas ni sombras) | — |
| `sala-ink`, `sala-ink-secondary` | Texto sobre fondo y panel | 7:1 y 4,5:1 |
| `sala-accent` + `sala-accent-ink` | Enlaces; relleno de la acción principal con su texto | 4,5:1 |
| `sala-band` + `sala-band-ink` | Franja y su texto | 4,5:1 |
| `sala-border` | Borde de un control | 3:1 |
| `sala-danger`, `sala-success`, `sala-warning` + su `-ink` | Estados: valen de texto sobre fondo y panel, y de relleno con su `-ink` encima | 4,5:1 |
| `sala-focus` | Anillo de foco (es la tinta). Sobre la franja, `sala-band-ink` | 3:1 |
| `sala-ink-disabled` | Texto de un control deshabilitado (es el gris del borde) | 3:1 |

Los valores, en claro y en oscuro, están en la tabla de Storybook y en `tokens.css`. `tests/unit/design/sala-tokens.test.ts` mide cada par en los dos temas.

Un estado nunca se dice solo con color: lleva texto o icono.

Opacidad: `bg-sala-panel/80` funciona. Las clases mezclan el token con `transparent` en sRGB (`color-mix(in srgb, …)`), no en OKLCH como las de la app de hoy: el color pintado es el mismo, pero con OKLCH Chromium devuelve `oklch(L C none)` para los tokens casi grises y axe no lo sabe leer. Por lo mismo, un color de «Sala» escrito a mano en un `style` va como `var(--sala-…)`, sin `color-mix(in oklch, …)`.

### El contraste en las historias

`npm run test:storybook` pasa axe a cada historia. Falla por una violación y también por un contraste **sin medir** (`.storybook/contraste.ts`, una sola pieza para todas las historias):

- Si axe no pudo leer un color o la regla dio error, falla siempre. Se arregla el color; no hay excepción.
- Si axe leyó los colores pero no puede dar una cifra (texto sobre imagen o degradado, pseudoelementos, elementos solapados), falla hasta que la historia declare que se ha medido a mano y cómo:

  ```ts
  parameters: { contraste: { revisado: { bgImage: "Título sobre la portada con velo: 7,3:1 en el píxel más claro" } } }
  ```

  Los motivos que se pueden declarar están en `MOTIVOS_REVISABLES`. Uno declarado que ya no aparece también falla.

### El color de una obra

```tsx
import { paletteFromPixels } from "@/lib/design/image-palette";
import { workPaletteVars } from "@/lib/design/sala-palette";

<article className="sala-work" style={workPaletteVars(palette)}>…</article>
```

Dentro de `sala-work` las mismas clases pintan con la paleta de la obra, en el tema que toque; el CSS elige, sin JavaScript. Sin `style` (la imagen no ha llegado) el contenedor se queda en los neutros. Los estados no cambian con la obra y cumplen sobre cualquier fondo de obra (lo barre el test).

## Tipografía

| Clase | Fuente | Uso |
|---|---|---|
| `sala-type-title` | Anybody 800 | Rótulo. El tamaño y la anchura (`font-stretch`, 50–150 %) los pone el componente según la longitud del título |
| `sala-type-heading` | Anybody 800, anchura 88 % | Título de sección |
| `sala-type-data` | Anybody 700 | Dato destacado |
| `sala-type-lead` | Instrument Sans 400 | Sinopsis y lectura |
| `sala-type-text` | Instrument Sans 400, 17 px | Texto de interfaz |
| `sala-type-label` | Instrument Sans 600, 15 px | Botones, pestañas, campos |
| `sala-type-small` | Instrument Sans 500, 14 px | Notas. No hay texto más pequeño |

Sueltas: `font-sala-display` y `font-sala-text`.

**Coreano y japonés.** Las dos pilas terminan en Noto Sans JP y KR. Por defecto va primero la japonesa; dentro de `lang="ko"`, la coreana, y otro idioma marcado ahí dentro (`<p lang="ja">`) vuelve al orden por defecto. El título original se marca siempre con su idioma (biblia, §3), y con eso basta. Las hojas `fonts-jp.css` y `fonts-kr.css` declaran un `@font-face` por trozo con su `unicode-range`: el navegador solo baja los trozos de los caracteres que hay en pantalla. Pesan 99 KB y 50 KB sin comprimir, así que no van en el CSS de todas las páginas: las carga quien pinta un título en esa escritura.

Chino: sin fuente propia; cae en la japonesa o en la del sistema.

## Medidas y movimiento

- Esquinas rectas (`rounded-none`, que es lo que hay si no se pone nada), sin sombras.
- Acción: `min-h-sala-target` (48 px).
- Foco: `focus-visible:sala-focus` (anillo de 3 px separado 3 px).
- Margen de página: `px-sala-margin`.
- Espacio: la escala de Tailwind (múltiplos de 4 px). No hay tokens de espacio propios.
- Movimiento: `duration-sala-fast` (150 ms), `duration-sala-slow` (500 ms), `ease-sala`. Con movimiento reducido ya los anula `globals.css`.
- Entradas de lo que se superpone: `animate-sala-fade-in` (el velo), `animate-sala-rise-in` (diálogo y aviso efímero: suben 12 px en 150 ms), `animate-sala-sheet-in` (la hoja, 300 ms) y `animate-sala-fade-out` (el aviso efímero al irse). El diálogo se va sin animación. Quien las usa añade `motion-reduce:animate-none`.

## Estados de un control

Un componente de «Sala» escribe sus estados con tres variantes propias, no con `hover:`, `active:` y `focus-visible:`:

| Variante | Cuándo vale |
|---|---|
| `sala-hover:` | `:hover`, solo donde hay puntero que se posa (`@media (hover: hover)`): en táctil no se queda pegado después de tocar |
| `sala-pressed:` | `:active` |
| `sala-focused:` | `:focus-visible`. El anillo: `sala-focused:sala-focus` |

En Storybook valen además con `data-sala-force="hover"` (o `pressed`, `focus`; admite varios separados por espacio): así una historia enseña el estado quieto, con las mismas reglas que el de verdad, y axe mide su contraste. Ese selector no llega al CSS de la app.

Regla común de botones y enlaces: al pasar el puntero, tinta (`bg-sala-ink` con `text-sala-background`). Deshabilitado: `text-sala-ink-disabled` y borde discontinuo, nunca solo el gris.

**Pulsado.** Nunca cambia la medida de la caja que se pulsa: si encoge, quien pulsó a 1 px del borde suelta fuera y el clic se pierde. El botón se vuelve tinta y encoge su contenido (`scale` en el envoltorio de dentro); el enlace marca el texto con `bg-sala-ink-secondary`. El botón no usa ese gris: en los neutros es casi el acento, y en táctil, sin hover, el principal no cambiaría.

**Foco y puntero a la vez.** En el enlace en línea el anillo va pegado al texto; con el puntero encima se separa 2 px para no fundirse con el bloque de tinta.

## Componentes

En `src/components/sala/`, cada uno con sus historias (Storybook, **Sala/Botón**, **Sala/Enlace**, **Sala/Campo de texto**, **Sala/Selección**, **Sala/Formulario**, **Sala/Póster**, **Sala/Tarjeta de obra**, **Sala/Diálogo**, **Sala/Aviso**, **Sala/Aviso efímero** y **Sala/Estado de bloque**) y sus tests (`tests/unit/components/sala/`). Conviven con los de `src/components/ui/`, que siguen siendo los de las pantallas de hoy.

| Componente | Para qué |
|---|---|
| `SalaButton` | Acción. `primary`, `secondary`, `quiet` y `danger`; con icono, solo icono (`label` obligatorio, sin `title`), como enlace (`asChild`) y cargando (`loading` + `loadingLabel`) |
| `SalaLink` | Navegación. `inline` (dentro de un texto) y `standalone` (suelto, 48 px). Elige solo entre el enlace con idioma y un `<a>` externo, que avisa de que abre otra pestaña; el aviso va en el idioma de la interfaz aunque el enlace lleve otro `lang` |
| `SalaInput` | Campo de una línea: `text`, `email`, `password` (con `revealLabel`, botón para verla, que se oculta sola al enviar), `search`, `number`, `tel`, `url`, `date`. Contador con `maxLength` + `counter`; `leading` (icono de adorno) y `trailing` (un control dentro) |
| `SalaTextarea` | Texto de varias líneas, con el mismo contador |
| `SalaSelect` | Desplegable nativo; las opciones son sus `<option>`, de texto corto |
| `SalaCheckbox` | Casilla: se marca y cuenta al guardar |
| `SalaRadioGroup` + `SalaRadio` | Una entre pocas opciones a la vista (`fieldset` + `legend`) |
| `SalaSwitch` | Ajuste que vale en el momento de tocarlo |
| `SalaForm` | El `<form>` de un formulario con campos de «Sala»: al enviar con errores lleva el foco al primero y anuncia una vez cuántos hay que corregir (`errorSummary`) |
| `SalaField` | La pieza común: etiqueta, ayuda, error y contador alrededor de un control propio (`{(control) => <input {...control} />}`) |
| `SalaPoster` | La imagen de una obra: reserva su sitio y nunca queda rota. Con `capUpscale`, tampoco pixela (el tope de la sala de la ficha) |
| `SalaWorkCard` + `SalaWorkCardSkeleton` | Una obra en una rejilla o una lista: póster, título y datos, toda ella un enlace. `grid`, `row` y `compact`; con acción secundaria (`action`) |
| `SalaWorkList` | La lista alrededor de las tarjetas: `ul`/`li`, el aviso de carga (una vez, al empezar y al acabar) y los esqueletos. Rejilla o lista |
| `SalaDialog` | Diálogo modal: título, descripción, cuerpo con scroll propio y pie de acciones. `dialog` (centrado) y `sheet` (hoja inferior en móvil) |
| `SalaConfirmDialog` | Confirmación antes de algo sin vuelta atrás: `alertdialog`, foco en cancelar, `danger` |
| `SalaNotice` | Aviso en línea, dentro de la página: `info`, `success`, `warning` y `error`; con acción y con cierre |
| `SalaToastProvider` + `useSalaToast` | Aviso efímero: el resultado de una acción, que flota y se va. La misma API que `ToastProvider` |
| `SalaBlockState` | Lo que va donde iba el contenido: el error con reintento de los `error.tsx` y el estado vacío |
| `SalaStatusIcon` | Los cuatro dibujos de tono (cada uno con su forma) y el aspa de cerrar |

Una palabra más larga que su caja (una URL como texto) se parte en los dos (`overflow-wrap: anywhere`): ni el botón ni el enlace dan scroll horizontal.

### Póster y tarjeta de obra

Los dos conviven con `PosterFrame`, `PosterImage`, `BestPoster` y `MediaCard`, que siguen en las pantallas de hoy; la sustitución es de la 8.5.

**`SalaPoster`**

- **Proporción.** Sale del formato (`format`) o se fija con `ratio`. Todos los proveedores dan una portada vertical cercana a 2:3 salvo el de videojuegos (RAWG), que da arte de 16:9: `SALA_POSTER_RATIO`. Una rejilla que mezcla formatos pone `ratio="2/3"` a todas para que las filas cuadren.
- **Sin salto de maquetación.** La caja tiene su proporción antes de que llegue nada (medido en las historias: con imagen, sin ella y con la imagen rota mide lo mismo). `sizes` es obligatorio; `priority` solo para lo que se ve sin hacer scroll.
- **Cargando, sin imagen o con error:** el campo de color con el título como rótulo (biblia §2). El campo es la franja (`bg-sala-band` con su tinta): con `palette`, la de la obra; sin ella, la del contenedor. El rótulo es adorno y su tamaño sigue al ancho de la caja, sin bajar de 14 px. En una miniatura no cabe: `fallback="plain"` deja solo el campo.
- **`alt`, siempre.** Vacío cuando el título va escrito al lado (toda tarjeta): la imagen es adorno. Con texto cuando el póster va solo; si entonces no hay imagen, ese texto nombra la caja (`role="img"`).
- **La portada llena la caja, como hasta ahora** (biblia §2: en tarjetas y listas, «la portada real, como hasta ahora»). El tope de ampliación se firmó para la sala de la ficha y aquí va **apagado por defecto**.
- **Tope de ampliación** (`capUpscale`; biblia §2, `posterFit` en `src/lib/design/image-fit.ts`). Una imagen que para llenar la caja tendría que ampliarse más de 1,25 veces el tamaño de **su archivo**, en píxeles físicos, no la llena: va entera, a 1,25 veces como mucho, centrada sobre el campo de color.
  - **Se mide el archivo, no el `<img>`.** Con `srcset` y `sizes` (lo que genera `next/image`) el `naturalWidth` de la imagen viene dividido por la densidad del candidato elegido (ancho del archivo × `sizes` ÷ descriptor): una portada de 780 px en una caja de 171 px a densidad 3 dice medir 182. Con ese número casi todo salía pieza a densidad 2 y 3. El tamaño llega por `naturalSize` (el del mayor archivo que se puede pedir para ese `src`; así se decide al montar, sin esperar a la imagen) o, si no se sabe, se lee el archivo ya cargado (`measureImageFile`, `src/lib/images/file-size.ts`: el mismo `currentSrc`, de la caché).
  - **Sin salto ni parpadeo.** La imagen no se pinta hasta saber si llena o es pieza (mientras, el campo de color con el título), y la pieza se encoge con `transform`: la caja del marco no cambia y no suma CLS (medido: 0,000 frente a 0,010 por póster y 0,056–0,067 en una rejilla de 100).
  - **Se vuelve a decidir** si cambia la caja o la densidad de la pantalla sin cambiar la caja (zoom, otra pantalla): un solo `ResizeObserver` y una sola escucha de densidad para todos los pósteres (`watchBox`, `src/lib/design/box-watch.ts`).
  - **Necesita JavaScript**: sin él, con `capUpscale` se queda el campo de color con el título. Sin `capUpscale` no hace falta para ver la imagen.
- **Qué es de cliente.** La caja, el campo de color y el rótulo salen del servidor (`SalaPoster` no lleva `"use client"`). De cliente solo es la imagen (`SalaPosterImage`): tiene que enterarse de si falla para quitarse (si no, quedaría el icono de imagen rota) y marca cuándo ha cargado en `data-sala-poster-image`; con eso el rótulo se esconde por CSS (`:has()`). Sin tope no mide nada, no observa la caja y al cargar no vuelve a pintar nada. `onLoadError` solo se puede pasar desde un componente de cliente.
- **Colores forzados.** El campo de color desaparece (el sistema quita los fondos): la caja lleva un contorno de 1 px del color del texto. Va en una sola clase (`forced-colors:[outline:1px_solid_CanvasText]`): escrita por partes, `cn` las tomaba por repetidas y se quedaba con una.
- **Rótulo.** Una palabra que no cabe se parte con guion donde el navegador sabe ponerlo para el idioma (`hyphens: auto` con el `lang` del título o de la página); si no, por donde toque. En japonés y coreano no cambia nada.
- La imagen se pide con `posterLoader`, como hoy: no hay dominios nuevos.

**`SalaWorkCard`**

- **Un solo enlace, y es el título.** Cubre la tarjeta entera con `::after`, así que toda ella se pulsa, pero su nombre accesible es solo el título: la lista de enlaces de una rejilla de 50 son 50 títulos. El título original, el formato, el año y `detail` van fuera del enlace y se leen al recorrer la tarjeta.
- **Acción secundaria** (`action`): un `SalaButton` de solo icono, fuera del enlace y encima de él. Nunca un botón dentro del enlace. En el teclado va después de la obra. Su `label` nombra la obra («Guardar Parásitos en la biblioteca»): en una rejilla, veinte botones «Guardar» no dicen nada.
- **El formato va con palabras** (`formatLabel`, ya traducido), en cada tarjeta.
- **Idiomas.** `titleLang` si el título no está en el idioma de la página; `originalTitle` lleva el suyo. Con eso cada escritura sale con su fuente.
- **Título cortado.** Tres líneas en `grid` y dos en `row` y `compact` (`clamp`; `"none"` no corta). El corte es solo a la vista: el nombre del enlace lleva el título entero. **No lleva `title`**: el enlace cubre la tarjeta entera, así que el cartelito saldría en cualquier punto de ella.
- **Estados.** Con el puntero, el título se marca en tinta; pulsada, con el gris de los enlaces; con el foco, el anillo rodea la tarjeta entera, por fuera. La caja no cambia de medida en ninguno. Con colores forzados la tinta no se ve (el sistema quita los fondos) y el título se subraya. Una rejilla o un carrusel deja 6 px de aire alrededor para el anillo (un contenedor con `overflow` lo recortaría).
- **Póster.** Sin tope de ampliación (`capUpscale` existe y va apagado): la portada llena la caja. En `row` y `compact` la caja mide en `rem` (4 → 5 rem la vertical y 7 → 9 la apaisada en fila; 2,5 y 4 rem en compacta) y su `sizes` por defecto también: con el texto al 200 % la caja mide el doble y se pide una imagen del doble. En `grid` el ancho depende de la rejilla: `sizes` lo pone quien la monta.
- **Rejilla a 320 px: dos columnas.** Con tres, la tarjeta se queda en 85 px y casi todo título se corta. La tercera columna entra a partir de 360 px.
- **Texto que no cabe.** Con el espaciado de WCAG 1.4.12 «Videojuego» no cabe en una tarjeta de 85 px: la línea de formato y año se parte (`overflow-wrap: anywhere`), como el título, y nada se sale de la tarjeta.
- **Dónde va cada cosa.** `ref` y las props nativas, al enlace; `className`, a la caja de la tarjeta. Es un componente de servidor.
- **En una lista.** Cada tarjeta, en un `<li>` de una lista con nombre: lo pone `SalaWorkList`. `headingLevel` es el nivel que toca bajo el encabezado de la lista (`3` por defecto); `"none"` deja el título en un párrafo, para una lista de sugerencias que no es un índice.
- **Esqueleto** (`SalaWorkCardSkeleton`): la misma forma, late tres veces (3,6 s) y se queda quieto; con movimiento reducido no late. Es adorno: la carga la anuncia la lista, una vez.

**`SalaWorkList`**

- **Pone la lista.** Un `<ul role="list">` (`<ol>` con `ordered`) y un `<li>` por hijo; la forma (columnas, huecos) va en `className`. Vale para rejilla, filas y compacta (`variant` y `ratio` dan forma a los esqueletos). Necesita nombre: `aria-label` o `aria-labelledby`.
- **Anuncia la carga una vez, al empezar y al acabar.** Mientras `loading`, la lista lleva `aria-busy` y una región `status` dice `loadingLabel`; al acabar dice `loadedLabel` («12 obras»). La región está montada siempre y nace vacía: una región que nace con texto no se anuncia de forma fiable, porque el lector de pantalla avisa de los cambios. Una lista que llega ya cargada no dice nada.
- **El componente tiene que seguir montado** antes y después de la carga. Si la pantalla cambia un componente de «cargando» por otro con los datos (un `fallback` de `Suspense`), la región es otra y el aviso del final se pierde.
- **Los esqueletos no cuentan.** `skeletons` dice cuántos; van al final, solo mientras `loading`, cada uno en un `<li>` oculto a los lectores de pantalla: la lista no anuncia elementos vacíos.
- **Sin lógica de datos.** Ni pide ni pagina: recibe las tarjetas como hijos y un `loading`. Los textos llegan traducidos. Es un componente de servidor; de cliente solo es la región viva.

### Diálogo, avisos y estado de bloque

Conviven con `Modal`, `ConfirmModal`, `Toast`/`ToastProvider` y `ErrorState`, que siguen en las pantallas de hoy; la sustitución es de la 8.5. Ningún texto sale de ellos: los nombres de los botones de cerrar y de la zona de avisos llegan por props.

**`SalaDialog`**

- **Sobre Radix (`@radix-ui/react-dialog`), como `Modal`; no es un `<dialog>` nativo.** `showModal()` deja inerte todo lo que no cuelga del diálogo y lo pinta en la capa superior: un aviso efímero no se vería encima ni se oiría. Tampoco bloquea el scroll de la página, ni cierra al pulsar fuera, ni devuelve el foco si el botón que lo abrió ha cambiado. Radix ya lo hace, ya está en la app (sin dependencias nuevas) y el job de accesibilidad ya lo prueba.
- **Qué se ve.** Panel `sala-panel` con borde de tinta de 2 px, sobre un velo que es el color de fondo al 90 %: color plano, sin sombra ni desenfoque. Lo de detrás se adivina y no se lee. Con colores forzados el velo no se pinta y el panel se distingue por su borde.
- **Foco al abrir**, en este orden: `initialFocusRef`, el control con `data-autofocus`, el primer control del cuerpo, el primero del pie, el botón de cerrar. Un cuerpo de solo texto que no cabe recibe él el foco (`tabindex="0"`): las flechas lo desplazan. Al cerrar, vuelve a quien lo abrió o a `finalFocusRef`.
- **Fondo.** El resto de la página sale del árbol de accesibilidad (`aria-hidden`) y no recibe clics; el scroll se bloquea y se compensa el ancho de la barra. **Lo que lleva `aria-live` escrito no se esconde**: por eso las regiones del aviso efímero lo llevan aunque `role="status"` ya lo implique.
- **Cierre.** Escape, el botón (`closeLabel`) y pulsar el velo (`closeOnOutside={false}` lo quita). Solo cierra el clic que empieza y acaba en el velo. `dismissible={false}` mientras se guarda.
- **Lo que no cabe.** El cuerpo tiene su scroll, con una raya arriba y abajo (`sala-border`, 3:1) que solo sale cuando hace falta; cabecera y pie se quedan. Si entre los dos no le dejan 120 px al cuerpo (texto al 200 % a 320 px, móvil apaisado), se desplaza el diálogo entero. **El botón de cerrar no va dentro de lo que se desplaza:** está siempre en su esquina, con fondo.
- **Móvil** (`variant="sheet"`): hoja pegada abajo, a todo el ancho y del 85 % del alto como mucho, por debajo de `md`. Sin asa de arrastre: se cierra con el botón, con Escape o pulsando fuera. Zonas seguras con `env()`; con el teclado en pantalla el velo recibe en `--sala-kb` lo que tapa (`visualViewport`) y la hoja sube.
- **`error`**: el fallo de la acción se ve (un `SalaNotice`) y se anuncia dentro, en una región `alert` montada desde que se abre. No va en un aviso efímero: el foco está atrapado en el diálogo.
- **`palette`**: el diálogo cuelga de `<body>`, fuera de la obra; con `palette` lleva su color.
- **Movimiento.** Entra en 150 ms (la hoja, en 300 ms) y se va sin animación: cerrar no espera a nada.

**`SalaConfirmDialog`**: `alertdialog`. El foco empieza en cancelar; no lleva aspa; pulsar fuera no lo cierra (Escape sí, y cancela). `danger` pinta la confirmación de peligro, y su texto nombra lo que se pierde. `loading` + `loadingLabel`: el botón espera y nada cierra.

**`SalaNotice`**

- **El tono no es solo color:** borde de 2 px y un dibujo con forma propia (una «i» en un cuadrado, una marca, un triángulo, un aspa en un cuadrado). El texto es siempre tinta sobre panel. No hay token de «info»: usa el gris del borde y la tinta.
- **Quién lo anuncia** (`live`): por defecto `error` es `role="alert"` y los demás `role="status"`. El papel lo lleva solo el texto (los botones quedan fuera) y nunca se suma `aria-live`. `live="off"` para un aviso que ya estaba en la página o que ya anuncia otro.
- **Un aviso que aparece después** nace dentro de una región que ya existía (`<div role="alert">` siempre montado, y el aviso dentro con `live="off"`): un lector avisa de lo que cambia, no de lo que nace con texto.
- `action` (un `SalaButton` o un `SalaLink`) va debajo del texto; `onClose` + `closeLabel` ponen el aspa. Al cerrar, el foco lo recoloca quien lo cierra.

**`SalaToastProvider` y `useSalaToast()`**

- **La misma API que `ToastProvider`**: `show({ message, type, duration, action })`, `showError(message, { persistent, duration })` y `dismiss(id)`; `action` con `label`, `onAction`, `onExpire` y `autoFocus`. En la 8.5, `useToastContext()` pasa a `useSalaToast()`. El proveedor recibe `labels={{ region, dismiss }}`.
- **Regiones vivas montadas desde el principio**, vacías: `aria-live="assertive"` para errores y `role="status"` para lo demás.
- **Tiempo** (WCAG 2.2.1): 5 s; 8 s un error o un aviso con acción (nunca menos de 6 s un error); 60 ms más por carácter a partir de 80, hasta 15 s. El reloj de todos se para con el puntero encima, con el foco dentro y con la pestaña en segundo plano. `duration: Infinity` lo deja fijo.
- **Teclado.** No roba el foco. **F8** lo lleva al aviso más reciente (y para el reloj); Escape lo cierra y el foco vuelve a donde estaba. Si se cierra un aviso con el foco dentro, el foco pasa al siguiente o vuelve: no se pierde. El nombre de la zona conviene que diga la tecla («Avisos (F8)»).
- **No tapa el foco** (WCAG 2.4.11). Va abajo (a la derecha desde `md`), por encima de la zona segura y de la barra inferior: quien pinta la barra pone su alto en `--sala-toast-clear` (en `:root` o en `<body>`). Si la pila queda encima del control con el foco, se pasa arriba. Los huecos de la zona no reciben clics.
- **Qué se ve.** Un bloque de tinta con el color del fondo encima; el error, un bloque `sala-danger`. Cada tipo, su dibujo. Sin sombra. Siempre con los neutros: es de la app, no de una obra. Con colores forzados, un borde.
- **Cola:** tres; el cuarto desplaza al más viejo, que caduca (`onExpire`).
- En táctil se descarta también deslizando a un lado.

**`SalaBlockState`**

- **Error** (`tone="error"`): la pieza común de los 11 `error.tsx`, que hoy pintan todos `ErrorState`. Título, explicación, `action` («Reintentar») y `secondary` (la salida). Con `headingLevel={1}` y `focusTitle`, el título recibe el foco al aparecer y el lector dice qué ha pasado; no lleva `role="alert"` (se oiría dos veces). Enviar el error a Sentry y montar el enlace de salida siguen en quien lo usa.
- **Vacío** (por defecto): qué es este sitio y cuál es el primer paso.
- Alineado a la izquierda, en el borde del contenido al que sustituye. De servidor; de cliente solo es el encabezado.

### La espera del botón (`loading`)

- **Qué se ve.** El texto sigue en su sitio, entero y sin atenuar, y debajo se encienden por turnos tres cuadrados de 4 px. Ni el ancho ni el alto cambian. Siempre hay un cuadrado encendido del todo, así que la espera no baja de 3:1 en ningún momento (WCAG 1.4.11).
- **Se para sola.** Tres vueltas (4,4 s) y los tres cuadrados se quedan encendidos y quietos: nada se mueve solo más de 5 s (biblia §6, WCAG 2.2.2). Quien usa `loading` no tiene que hacer nada. Con movimiento reducido están así desde el principio, y con colores forzados se pintan con el color de texto del sistema.
- **Qué se oye.** `loadingLabel`, en una región `status` que existe desde antes (por eso `loading` se pasa siempre, también en `false`).
- **El final lo anuncia quien usa el botón.** Al acabar, la región se vacía. El botón no sabe si salió bien o mal: un «hecho» fijo mentiría en el error y repetiría el aviso de quien sí lo sabe. La pantalla anuncia el resultado con su aviso (`role="status"`, o `alert` si falló), el error junto al campo o el cambio de página.

### Los campos

Todos son el control nativo (`<input>`, `<textarea>`, `<select>`) con otra caja: `ref`, `className` y las props nativas llegan al control, y `fieldClassName` a la caja del campo entero. Ningún texto sale del componente: etiqueta, ayuda, error, «obligatorio», «Mostrar contraseña» y el contador llegan por props, ya traducidos.

| Prop común | Qué hace |
|---|---|
| `label` | Etiqueta, siempre a la vista. Un placeholder no la sustituye |
| `requirement` | La palabra «obligatorio» u «opcional» junto a la etiqueta. Nunca un asterisco ni un color. Con `required` es solo para la vista (el lector ya lo oye del control); sin él, entra en la descripción |
| `hint` | Ayuda, entre la etiqueta y el control |
| `error` | Qué falla y cómo arreglarlo. Pone `aria-invalid`, entra el primero en `aria-describedby` y se pinta con icono y texto |

- **Caja.** 48 px de alto, letra de 17 px (con menos de 16, iOS amplía la página), borde de 2 px `sala-border` (3:1 o más). Con el puntero o el foco, el borde pasa a tinta; el foco es el anillo de siempre.
- **Estados.** Error: borde `sala-danger` y, debajo, icono y texto. Solo lectura: una raya debajo y nada a los lados (se distingue por la forma). Deshabilitado: borde discontinuo y gris, como el botón. No hay estado de «correcto»: la biblia no lo pide y un campo que no se queja ya lo dice.
- **El error se anuncia una vez, y siempre** (WCAG 4.1.3). Quién lo dice depende de dónde está el foco cuando aparece:
  - *El foco está en otro sitio* (validar al salir del campo): lo dice una región viva del propio campo, con la etiqueta delante («Nombre: Ponle un nombre»), leída de su `<label>` o de la `<legend>` del grupo. Un error suelto no dice de qué campo es.
  - *El foco acaba de llegar al control* (la pantalla pone el error y lleva el foco a él en el mismo gesto): calla. El lector ya lo lee como descripción del control.
  - *El foco ya estaba en el control* (enviar con Enter desde el campo, validar mientras se escribe, un interruptor que no se ha podido guardar): se anuncia. Una descripción que cambia con el foco puesto no se lee sola.
  - *Al enviar un `SalaForm`:* habla el formulario y los campos callan (ver «El formulario»).
- **Cómo se distingue «acaba de llegar» de «ya estaba».** Por el orden de lo que pasa, no esperando: el foco entra en el control y, desde entonces, cualquier tecla, clic o cambio dentro de él quiere decir que ya estaba. No hay espera antes de anunciar. Queda un solo tope de tiempo, de 1 s, para un caso raro: el foco lleva un rato quieto en el control y el error llega solo (una respuesta del servidor); pasado el segundo, se anuncia. Si el tope falla, falla hacia el lado bueno: el error se oye dos veces, nunca ninguna.
- **Cuándo se retira el anuncio.** Cuando el foco entra en el control o sale de él: ahí el error ya se lee en su sitio y, si la región siguiera llena, se oiría dos veces al recorrer la página. Para quien no mueve el foco hay un plazo de 10 s, largo a propósito: un anuncio «polite» que desaparece antes de que el lector llegue a él se pierde (pasa en VoiceOver con plazos de uno o dos segundos).
- **No se usa `aria-errormessage`:** su soporte es desigual y, junto con la descripción, hay lectores que leen el error dos veces.
- **Contraseña.** El botón se llama siempre igual («Mostrar contraseña»); cambian `aria-pressed` y el dibujo. No lleva `aria-controls`. Si está a la vista, vuelve a ocultarse al enviar el formulario.
- **Casilla, radio e interruptor.** Lo que se pulsa es la fila (el `<label>`), de 48 px o más de alto; el dibujo mide 24. Marcado no es un color: un trazo en la casilla, un punto en el radio, la pieza de lado en el interruptor. El radio es redondo, la única curva del sistema: es lo que lo distingue de la casilla.
- **Hasta dónde llega la fila.** En la casilla y el radio, hasta donde llegan el dibujo y su texto (`w-fit`): un toque en el hueco vacío de la derecha no marca nada. En el móvil ese hueco es por donde pasa el pulgar, y una casilla de «acepto» marcada sin querer es peor que una fila más corta. En el interruptor la fila es entera: el texto va a un lado y la pieza al otro. Un enlace dentro de la etiqueta se puede pulsar sin marcar la casilla.
- **Grupo de radios.** El error lo lleva cada radio en su descripción, y solo ahí: al llegar el foco a un radio no todos los lectores leen la descripción del grupo (VoiceOver), y puesto en los dos sitios se oiría dos veces. El grupo lleva `aria-invalid` y la ayuda. «Obligatorio» lo dice el grupo (`aria-required`); el `required` de cada radio es para el formulario y el navegador no lo repite en cada radio (medido en el árbol de accesibilidad de Chromium).
- **Interruptor que no se ha podido guardar.** `error` lo dice debajo, entra en su descripción y se anuncia (el foco sigue en él). No lleva `aria-invalid`: lo que ha fallado es guardar, no el valor, y un `switch` no lo admite (ARIA 1.2). Tras el fallo, `checked` tiene que volver al valor que de verdad está guardado.
- **Qué tipo para qué dato.** `number` solo para cantidades que suben y bajan (un capítulo, unas páginas). Códigos, años y teléfonos: `type="text"` con `inputMode="numeric"` (o `tel`). Con `number` hay que validar también `validity.badInput`: teclear una «e» deja `value` vacío aunque en el campo se vea algo. `date` es para fechas cercanas; una lejana (la de nacimiento) se escribe mejor.
- **Ejemplos y formatos, en `hint`,** no en el placeholder: desaparece al escribir y hay quien lo toma por un valor ya puesto.
- **Opciones de `SalaSelect`, cortas.** El `<select>` nativo no parte en dos líneas el texto de la opción elegida: en un móvil de 320 px, una opción larga se corta. Si las opciones son frases, radios.
- **`lang`** llega solo al control. Si la etiqueta, la ayuda y el error están en otro idioma que la página, se envuelve el campo entero (`<div lang="ja">`).
- **Autorrelleno del navegador.** Tinta sobre panel, en los dos temas (el navegador pone si no su fondo y su letra).
- **Colores forzados.** Bordes, foco y flecha se ven con los colores del sistema; casilla, radio e interruptor vuelven a ser los del sistema y, deshabilitados, su texto pasa al gris del sistema (`GrayText`). Los iconos de trazo (`currentColor`) heredan el color que el sistema le pone a su botón: el de texto, el gris si está deshabilitado, el de enlace si es un enlace. No se les fuerza otro: con una clase que les ponía `ButtonText`, el icono de un botón deshabilitado parecía activo y el de un enlace salía del color del texto.
- **`autoComplete` e `inputMode`** los pone la pantalla, que es quien sabe qué dato es (WCAG 1.3.5). `email`, `password` y `url` van sin corrector ni mayúscula inicial.

### El formulario (`SalaForm`)

Un `<form>` nativo (`ref`, `className` y las props nativas llegan a él) para que las pantallas no copien la lógica de enviar con errores. La validación y los textos son de la pantalla: en `onSubmit` valida y pasa a cada campo su `error`. Después de pintar, el formulario:

1. **Lleva el foco al primer campo con error** (el primero con `aria-invalid`, en el orden de la página; en un grupo de radios, a la opción elegida o a la primera).
2. **Anuncia una vez cuántos campos hay que corregir**, en un `role="status"` propio, con el texto que da `errorSummary(n)`, ya traducido y con su plural. Si el foco ya estaba en ese primer campo (Enter dentro de él), el lector no lo vuelve a leer: el aviso añade la etiqueta y el error de ese campo. Enviar otra vez con los mismos errores lo vuelve a anunciar.
3. **Hace callar a los campos** en ese envío: no anuncian cada uno su error, todos a la vez.

| Prop | Qué hace |
|---|---|
| `errorSummary` | `(n) => string`: el aviso a partir de cuántos campos hay que corregir. Obligatoria |
| `handle` | `ref` a `{ reportErrors() }`: lo mismo que un envío, para errores que llegan después (los devuelve el servidor). Se llama en el mismo manejador que pone los errores. Sin esa llamada, cada campo anuncia el suyo con su etiqueta |
| `noValidate` | Va puesto: los globos del navegador salen en el idioma del navegador y no se pueden escribir. `noValidate={false}` los devuelve |

El aviso se retira cuando se cambia algo en el formulario o se vacía. El resultado de un envío que sale bien lo anuncia la pantalla, con su propio `role="status"`. Ver **Sala/Formulario**.

Las piezas comunes de las historias (el suelo neutro o de una obra, las obras de ejemplo) están en `.storybook/sala.tsx`, fuera de `src`: sus clases y sus textos no entran en la app.

## Qué fija la biblia y qué es propuesta

| Fijado por la biblia | Propuesta (del prototipo firmado; pendiente del «sí» de Víctor) |
|---|---|
| Papeles de color y sus neutros; AA | Colores de error, hecho y aviso; foco con la tinta; gris de lo deshabilitado |
| Familias y orden de las fuentes CJK | Tamaños, pesos e interlineados de cada papel |
| Esquinas rectas, sin sombras, acción de 48 px | Margen de página, grosor del foco, tiempos y curva |
| El formato y los estados no se dicen solo con color | Variantes del botón; tinta al pasar el puntero; pulsado que encoge un punto el contenido; deshabilitado con borde discontinuo; la espera de tres cuadrados bajo el texto, que se para a los 4,4 s; enlace siempre subrayado y sin estilo de «visitado»; en los campos: borde gris en reposo y tinta con puntero o foco, «obligatorio» y «opcional» con palabra, solo lectura como raya, sin estado de «correcto», radio redondo, interruptor de pieza cuadrada; en el póster y la tarjeta: 16:9 para videojuegos, el rótulo del sustituto y su anchura según la longitud del título, el tope de 1,25× también en las tarjetas, el título marcado en tinta al pasar el puntero, el corte del título a 3 y 2 líneas, el esqueleto que late tres veces; en el diálogo y los avisos: el velo del color de fondo al 90 %, el panel con borde de tinta, la hoja inferior en móvil sin asa de arrastre, que el diálogo se vaya sin animación, que una confirmación no se cierre al pulsar fuera, el aviso efímero como bloque de tinta, sus tiempos (5 s, 8 s, hasta 15 s), F8 para llegar a él, que la pila se pase arriba si tapa el foco, y el estado de bloque alineado a la izquierda y sin ilustración |
