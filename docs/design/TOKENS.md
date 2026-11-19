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

En `src/components/sala/`, cada uno con sus historias (Storybook, **Sala/Botón** y **Sala/Enlace**) y sus tests (`tests/unit/components/sala/`). Conviven con los de `src/components/ui/`, que siguen siendo los de las pantallas de hoy.

| Componente | Para qué |
|---|---|
| `SalaButton` | Acción. `primary`, `secondary`, `quiet` y `danger`; con icono, solo icono (`label` obligatorio, sin `title`), como enlace (`asChild`) y cargando (`loading` + `loadingLabel`) |
| `SalaLink` | Navegación. `inline` (dentro de un texto) y `standalone` (suelto, 48 px). Elige solo entre el enlace con idioma y un `<a>` externo, que avisa de que abre otra pestaña; el aviso va en el idioma de la interfaz aunque el enlace lleve otro `lang` |

Una palabra más larga que su caja (una URL como texto) se parte en los dos (`overflow-wrap: anywhere`): ni el botón ni el enlace dan scroll horizontal.

### La espera del botón (`loading`)

- **Qué se ve.** El texto sigue en su sitio, entero y sin atenuar, y debajo se encienden por turnos tres cuadrados de 4 px. Ni el ancho ni el alto cambian. Siempre hay un cuadrado encendido del todo, así que la espera no baja de 3:1 en ningún momento (WCAG 1.4.11).
- **Se para sola.** Tres vueltas (4,4 s) y los tres cuadrados se quedan encendidos y quietos: nada se mueve solo más de 5 s (biblia §6, WCAG 2.2.2). Quien usa `loading` no tiene que hacer nada. Con movimiento reducido están así desde el principio, y con colores forzados se pintan con el color de texto del sistema.
- **Qué se oye.** `loadingLabel`, en una región `status` que existe desde antes (por eso `loading` se pasa siempre, también en `false`).
- **El final lo anuncia quien usa el botón.** Al acabar, la región se vacía. El botón no sabe si salió bien o mal: un «hecho» fijo mentiría en el error y repetiría el aviso de quien sí lo sabe. La pantalla anuncia el resultado con su aviso (`role="status"`, o `alert` si falló), el error junto al campo o el cambio de página.

Las piezas comunes de las historias (el suelo neutro o de una obra, las obras de ejemplo) están en `.storybook/sala.tsx`, fuera de `src`: sus clases y sus textos no entran en la app.

## Qué fija la biblia y qué es propuesta

| Fijado por la biblia | Propuesta (del prototipo firmado; pendiente del «sí» de Víctor) |
|---|---|
| Papeles de color y sus neutros; AA | Colores de error, hecho y aviso; foco con la tinta; gris de lo deshabilitado |
| Familias y orden de las fuentes CJK | Tamaños, pesos e interlineados de cada papel |
| Esquinas rectas, sin sombras, acción de 48 px | Margen de página, grosor del foco, tiempos y curva |
| El formato y los estados no se dicen solo con color | Variantes del botón; tinta al pasar el puntero; pulsado que encoge un punto el contenido; deshabilitado con borde discontinuo; la espera de tres cuadrados bajo el texto, que se para a los 4,4 s; enlace siempre subrayado y sin estilo de «visitado» |
