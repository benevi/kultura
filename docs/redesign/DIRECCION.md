# Dirección del rediseño (Paso 0, v2)

Este documento registra lo que decidieron las cuatro skills de diseño. En la PR 1 se convierte en `DISENO.md` v3.

Cada decisión indica de dónde sale: **[UUPM]** UI UX Pro Max · **[TASTE]** Taste Skill · **[ACD]** Awesome Claude Design · **[DMP]** Design Motion Principles.

**Requisito del usuario (2026-11-04):** tema oscuro, pocas palabras y todo mucho más visual.

## Historial

1. **v1:** `sentence-as-layout` con la paleta «Cobalto sobre arena». Descartada: era clara y se apoyaba en el texto.
2. **Paleta repartida de nuevo** (`--redraw palette`), con el motivo de que la marca tiene que ser oscura. Salió `plum-black-pink`.
3. **Dirección repartida de nuevo** (`--options 3`, evitando `sentence-as-layout` y `type-only-statement`), con el motivo de que todo tiene que ser más visual que textual. Salieron `contact-sheet`, `editorial-report` y `dense-tiles`; elegí **`contact-sheet`**.

## 1. La idea [TASTE `contact-sheet`, semilla 1503157140]

> En Kultura, **la estantería de portadas reales de los 7 formatos** se convierte en **la hoja de contactos**: filas de portadas a altura fija y ancho natural. El volumen es el mensaje.

- **Por qué esta dirección.** La biblioteca de un usuario de Kultura ya es un muro de portadas, así que el diseño es el propio producto. Las otras dos opciones dependían de texto (`editorial-report`) o de tarjetas (`dense-tiles`).
- **Héroe «Lit strip, four corners».**
  - Fondo casi negro y cuatro textos de 14–16 px en las esquinas: la marca, Entrar, una frase y el botón.
  - Una franja de portadas cruza el centro de borde a borde con scroll horizontal y snap.
  - La portada del centro está encendida; las demás quedan al 45 % de brillo.
- **Lo que se puede hacer en la página:** arrastrar la franja. Además, el titular busca en el catálogo real.

## 2. Tipografía [TASTE]

- Una sola familia: **Work Sans** (OFL). Display a 300, tracking −0,035em. Texto a 400/500 e interlineado 1,55.
- Tres tamaños visibles: el nombre o titular grande, el texto (16–19 px) y lo pequeño (13–14 px).
- Sin monoespaciada y sin mayúsculas con tracking.

## 3. Color [TASTE `plum-black-pink`] + [ACD Spotify: la portada pone el color]

| Token | Valor | Uso |
|---|---|---|
| `bg` | #0d060b | Suelo de toda la web |
| `surface` | #1b0e17 | Paneles |
| `field` | #470c35 | Campo de color del pie |
| `ink` | #ffffff | Texto |
| `muted` / `meta` | #b4b4b4 / #949494 | Secundario / meta (≥ 4,5:1 sobre el panel anidado) |
| `accent` | #ff488b | **Solo** la acción principal y las marcas de datos (barras de progreso) |
| `accent-ink` | #0d060b | Texto sobre el rosa |

- El rosa conecta con el pink de la Kultura actual.
- Solo hay tema oscuro: se descarta el claro.
- En la PR 1 se pasan a OKLCH con los tests de contraste.

## 4. App [TASTE `true-black-flat`, oscuro]

- **Profundidad solo por luminosidad**: #000 para el suelo, #111 para la tarjeta y #2a2a2a para el panel anidado. Sin bordes ni sombras.
- **Acción principal invertida**: pastilla blanca de 36 px con texto negro.
- **El rosa nunca va en botones, pestañas ni navegación.** Solo en los datos, y como mucho en el 3 % de la pantalla.
- **Armazón «sin barra lateral»**: barra superior de 48 px y columna centrada de 1088–1208 px. En móvil, logo, búsqueda y menú.
- **Su cara**: la portada es el protagonista de cada pantalla. La biblioteca es un muro de portadas con su barra de progreso.

## 5. Landing en orden [TASTE]

| Sección | Plano | Contenido |
|---|---|---|
| Héroe | Lit strip, four corners | Portadas reales de `getLandingMedia()`. |
| showcase | Frame run, one lifted | El año en portadas, con una destacada al doble de tamaño. |
| features | Small proof beside text | Fragmentos reales de la app. |
| how-it-works | Drag row of moments | Importar, puntuar, organizar y compartir. |
| list | Two-ended rows | El ranking real de `/best`. |
| proof | Recognition as a table | Los catálogos reales de los que lee Kultura. |
| faq | Answers as reading text | Las FAQ actuales. |
| cta | Three photographs, then a field | El registro. |
| footer | A footer of tiles | Portadas más un panel de color con el botón. |

## 6. 3D [UUPM Immersive + 3D]

- La portada encendida de la franja gana relieve con su mapa de profundidad del pipeline semanal y sigue al cursor.
- Las demás son planas.
- Sin WebGL o con movimiento reducido: la misma franja en plano.

## 7. Movimiento [DMP + TASTE «Drag row»]

- **Movimiento firma: arrastrar la franja.** Scroll horizontal nativo con snap, sin librería de carrusel, sin flechas ni puntos.
- **Entradas**: las portadas suben 24 px con opacidad, 60 ms entre una y otra, una sola vez.
- **El encendido** sigue al cuadro que pasa por el centro (transición de brillo de 0,5 s).
- **Frecuencia [DMP]**: lo diario no se anima; modales y avisos a 180–240 ms con expo-out.
- **Movimiento reducido**: obligatorio.

## 8. Logo

Rectángulo redondeado rosa con la K en negativo, seguido del wordmark «Kultura» en Work Sans 500.
