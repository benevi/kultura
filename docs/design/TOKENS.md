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

En `src/components/sala/`, cada uno con sus historias (Storybook, **Sala/Botón**, **Sala/Enlace**, **Sala/Campo de texto**, **Sala/Selección** y **Sala/Formulario**) y sus tests (`tests/unit/components/sala/`). Conviven con los de `src/components/ui/`, que siguen siendo los de las pantallas de hoy.

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

Una palabra más larga que su caja (una URL como texto) se parte en los dos (`overflow-wrap: anywhere`): ni el botón ni el enlace dan scroll horizontal.

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
| El formato y los estados no se dicen solo con color | Variantes del botón; tinta al pasar el puntero; pulsado que encoge un punto el contenido; deshabilitado con borde discontinuo; la espera de tres cuadrados bajo el texto, que se para a los 4,4 s; enlace siempre subrayado y sin estilo de «visitado»; en los campos: borde gris en reposo y tinta con puntero o foco, «obligatorio» y «opcional» con palabra, solo lectura como raya, sin estado de «correcto», radio redondo, interruptor de pieza cuadrada |
