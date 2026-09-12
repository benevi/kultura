# KULTURA — Sistema de diseño (fuente de verdad)

Este documento es el ÚNICO criterio de diseño válido para Kultura. Sustituye
cualquier paleta, componente o layout usado antes en el código o en mockups
anteriores. Nace del canvas real **"Kultura Editorial" (F0 v2)** — Home,
Discover y MediaDetail fueron diseñados a mano ahí; el resto de pantallas
(publicado en el canvas **"Kultura — Diseño completo"**,
`https://claude.ai/code/artifact/197b00e1-54dc-4bc7-8106-72c923d455bb`) se
derivó extendiendo literalmente ese mismo vocabulario, no inventando uno
nuevo.

**Regla de oro:** ante cualquier duda de diseño (color, tipografía, forma de
un componente, cómo tratar una pantalla nueva), la respuesta correcta es
"¿qué haría exactamente F0 aquí, con estos mismos tokens?" — nunca una
alternativa "parecida" o "mejorada". Si hace falta un patrón que F0 no
cubre, se construye combinando los primitivos de abajo (mismos radios,
mismos gradientes, mismos pesos), no con valores nuevos.

## Tokens (OKLCH — literales, no aproximar a hex)

```css
--bg: oklch(16% 0.015 280);
--surface: oklch(21% 0.02 280);
--surface-2: oklch(26% 0.025 280);
--stroke: oklch(32% 0.025 280);
--text: oklch(97% 0.004 280);
--muted: oklch(68% 0.02 280);
--pink: oklch(68% 0.24 350);
--lime: oklch(83% 0.24 130);
--orange: oklch(72% 0.19 55);
--purple: oklch(62% 0.19 300);
--blue: oklch(68% 0.16 250);
--yellow: oklch(85% 0.17 95);
```

Colores "on-color" (texto sobre fondo sólido vivo, no blanco/negro puro):
`oklch(15% 0.02 350)` sobre pink, `oklch(18% 0.02 130)` sobre lime,
`oklch(15% 0.02 300)` sobre purple.

## Tipografía

- Display / títulos: **Bricolage Grotesque** (pesos 500–800).
- Cuerpo / UI: **Figtree** (pesos 400–800).
- Google Fonts: `family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700;800`.

## Componentes base (no reinventar)

- **Logo**: badge cuadrado `38×38` `border-radius:13px` fondo `--surface-2`,
  con 3 rectángulos `19×13` `border-radius:6px` rotados (pink `-10deg`,
  lime `6deg`, purple `-4deg`) posicionados en cascada dentro del badge.
  Wordmark "kultura" en display 800, con un cuadrado pink `7×7`
  `rotate(14deg)` colgando al final.
- **Header** (todas las pantallas autenticadas): logo a la izquierda
  (+ chip opcional, p. ej. racha), y a la derecha SOLO icono de búsqueda
  (caja `44×44` `border-radius:16px` fondo `--surface-2`) + avatar
  cuadrado `44×44` `border-radius:16px 16px 16px 4px` gradiente
  `135deg` pink→purple con iniciales. **No hay barra de enlaces de
  navegación en el header** — F0 no la tiene; no inventarla.
- **Chips**: `border-radius:999px`, `font-weight:700`, `padding` variable
  (8–20px según contexto). Activo = fondo de color vivo + texto "on-color"
  correspondiente. Inactivo = fondo `--surface-2` + texto `--text`. Chip
  "outline" = transparente + `border:2px solid var(--stroke)`.
- **Botones pill**: primario = fondo pink + texto on-pink, `font-weight:800`.
  Secundario = borde `2px solid var(--stroke)`, `font-weight:700`,
  transparente.
- **Posters / cards sin imagen real**: gradiente de dos paradas
  `linear-gradient(150–160deg, oklch(L1% C1 H), oklch(L2% C2 H))` con el
  mismo matiz (H) en ambas paradas y L2/C2 más bajos (más oscuro/apagado).
  Nunca gris plano ni foto placeholder — siempre bloques de color vivo.
- **Cards "feature" grandes**: además del gradiente lineal, un
  `radial-gradient` de acento en la esquina superior-izquierda
  (`120% 100% at 20% 10%`, color al 55-60% de opacidad, difuminando a
  transparente a 55%).
- **Badge de match**: pill `--lime` + texto on-lime, `font-weight:800`.
  Versión "colgante" (esquina de poster, MediaDetail): offset
  `top:-14px; left:-14px`, `rotate(-8deg)`,
  `box-shadow:4px 4px 0 rgba(0,0,0,.4)` — sombra dura tipo pegatina, no
  blur.
- **Rotación de cards**: en grids tipo bento, las cards destacadas llevan
  una rotación sutil (`-1.2deg` / `1deg`) — no todo el grid, solo las
  piezas grandes, y alternando signo.
- **Avatares circulares con actividad** (stories): anillo `conic-gradient`
  de 2-3 colores de la paleta, padding `3px`, círculo interior fondo
  `--bg` con iniciales.
- **Avatares apilados** (amigos que vieron algo): círculo con
  `linear-gradient(135deg, colorA, colorB)`, borde `2px solid var(--bg)`,
  solapados con `margin-left` negativo (~`-12px`).
- **Burbujas de chat**: entrante = `--surface-2`,
  `border-radius:20px 20px 20px 4px`. Saliente = `--pink` + texto
  on-pink, `border-radius:20px 20px 4px 20px`.

## Principio de extensión a pantallas nuevas

Cuando una pantalla no tiene equivalente literal en F0 (todo excepto
Home/Discover/MediaDetail), se construye combinando ÚNICAMENTE los
primitivos de arriba: mismo header, mismos chips, mismos pills, misma
fórmula de gradiente para posters, mismos radios (~14-32px según jerarquía
del elemento), mismo espaciado (`padding:28px 56px` en headers/secciones
de página, `gap:20px` entre cards de una fila). No se añade una paleta,
tipografía, sombra o forma de card que no exista ya en F0. Si algo no
está claro, replicar el patrón más parecido que sí exista antes de
inventar uno.

## Fuentes de este sistema

- Canvas original (mano, no tocar): **"Kultura Editorial"** — Home,
  Discover, MediaDetail. Es la referencia literal; ante cualquier
  discrepancia con este documento, el canvas manda.
- Canvas derivado (las 17 pantallas, generado siguiendo este criterio):
  **"Kultura — Diseño completo"** —
  `https://claude.ai/code/artifact/197b00e1-54dc-4bc7-8106-72c923d455bb`.
- Generador usado para producir las 14 pantallas derivadas (vocabulario
  compartido en `shared.mjs`, una función por pantalla en `build.mjs`):
  vive fuera del repo, en el scratchpad de la sesión que lo creó. Si se
  necesita regenerar o ampliar el set de pantallas, reconstruir el
  generador a partir de este documento y de los tres `.dc.html` de F0
  (extraerlos del canvas "Kultura Editorial" con el helper del skill de
  diseño), no desde memoria.

## Cuando esto pase a código (Tailwind / componentes React)

- Los tokens OKLCH de este documento deben mapearse 1:1 a las custom
  properties CSS reales de la app (`globals.css` / `tailwind.config.ts`),
  sustituyendo cualquier paleta hex previa. No mezclar ambos sistemas.
- Los componentes reales (`MediaCard`, header/nav, chips, botones) deben
  actualizarse para producir exactamente la marca visual descrita arriba
  — no una aproximación. Si un componente existente no puede lograrlo sin
  reescritura, se reescribe.
- Esto es trabajo de implementación pendiente, no incluido en este
  documento: este archivo fija el CRITERIO, no ejecuta la migración de
  código. Confirmar con el usuario antes de tocar componentes reales.
