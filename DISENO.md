# Kultura · Sistema de diseño

Este documento es el ÚNICO criterio de diseño válido para Kultura. Sustituye
cualquier paleta, componente o layout usado antes en el código o en mockups
anteriores. Nace de los mockups **"Kultura Editorial" (F0 v2)**: Home, Discover y
MediaDetail se diseñaron a mano; el resto de pantallas (mockups "Kultura,
diseño completo") se derivó extendiendo literalmente ese mismo vocabulario, no
inventando uno nuevo.

**Regla de oro:** ante cualquier duda de diseño (color, tipografía, forma de
un componente, cómo tratar una pantalla nueva), la respuesta correcta es
"¿qué haría exactamente F0 aquí, con estos mismos tokens?", nunca una
alternativa "parecida" o "mejorada". Si hace falta un patrón que F0 no
cubre, se construye combinando los primitivos de abajo (mismos radios,
mismos gradientes, mismos pesos), no con valores nuevos.

## Tokens (OKLCH, literales, no aproximar a hex)

Los tokens viven en `src/app/globals.css` (`:root`) con estos nombres. Son los
que hay que usar en código; en Tailwind cada uno es una clase
(`bg-surface-default`, `text-accent-pink`…).

```css
/* Superficies y texto */
--surface-base: oklch(16% 0.015 280);
--surface-default: oklch(21% 0.02 280);
--surface-elevated: oklch(26% 0.025 280);
--surface-border: oklch(32% 0.025 280);
--text-primary: oklch(97% 0.004 280);
--text-secondary: oklch(76% 0.02 280);
--text-tertiary: oklch(68% 0.02 280);

/* Acentos decorativos */
--accent-pink: oklch(68% 0.24 350);
--accent-lime: oklch(83% 0.24 130);
--accent-orange: oklch(72% 0.19 55);
--accent-purple: oklch(62% 0.19 300);
--accent-blue: oklch(68% 0.16 250);
--accent-yellow: oklch(85% 0.17 95);

/* Acentos con rol (reutilizan los matices de arriba) */
--accent-positive: oklch(83% 0.24 130);
--accent-highlight: oklch(85% 0.17 95);
--accent-info: oklch(68% 0.16 250);
--accent-danger: oklch(60% 0.21 25);

/* Rojo accesible, campos y foco (ver "Formularios y foco") */
--accent-danger-text: oklch(70% 0.17 25);
--accent-danger-solid: oklch(55% 0.21 25);
--field-border: oklch(55% 0.02 280);
--focus-ring: var(--accent-pink);

/* Texto sobre acentos ("on-color": oscuro del mismo matiz, no negro puro) */
--on-accent-pink: oklch(15% 0.02 350);
--on-accent-lime: oklch(18% 0.02 130);
--on-accent-orange: oklch(16% 0.03 55);
--on-accent-purple: oklch(15% 0.02 300);
--on-accent-blue: oklch(14% 0.03 250);
--on-accent-yellow: oklch(18% 0.03 95);
--on-accent-positive: oklch(18% 0.02 130);
--on-accent-danger: oklch(97% 0.01 25);

/* Alias con los nombres del canvas F0: existen para que copiar del canvas
   funcione, pero en código nuevo se usan los nombres de arriba. */
--bg: var(--surface-base);
--surface: var(--surface-default);
--surface-2: var(--surface-elevated);
--stroke: var(--surface-border);
--text: var(--text-primary);
--muted: var(--text-tertiary);
--pink: var(--accent-pink);
--lime: var(--accent-lime);
--orange: var(--accent-orange);
--purple: var(--accent-purple);
--blue: var(--accent-blue);
--yellow: var(--accent-yellow);
```

`tests/unit/design/diseno-doc.test.ts` comprueba que este bloque y la tabla
del final coinciden con `globals.css`, y que ningún `var(--x)` de `src`
apunta a un token inexistente (así se rompieron los avatares de la landing:
`var(--pink)` no existía).

### Opacidad

Los colores del tema admiten modificador de opacidad: `bg-surface-default/80`,
`border-accent-danger/30`, `ring-accent-pink/40`. Tailwind los genera con
`color-mix(in oklch, var(--token) 80%, transparent)`. Antes los colores eran
`var(--x)` a secas y esas clases **no generaban regla** (bordes gris claro,
anillos azules por defecto). `tests/unit/design/tailwind-alpha.test.ts` compila
Tailwind y falla si una clase `/<alfa>` usada en `src` no genera regla.

En estilos en línea se usa `src/lib/design/f0-tokens.ts` (`F0.pink`…), que
apunta a los mismos tokens.

## Tipografía

- Display / títulos: **Bricolage Grotesque** (pesos 500–800; es lo único que
  se carga, así que un título sin peso explícito se pinta a 500).
- Cuerpo / UI: **Figtree** (pesos 400–800).
- Carga con `next/font` en `src/app/[locale]/layout.tsx` (variables
  `--font-display` y `--font-body`).

## Formularios y foco (accesibilidad, WCAG 2.1 AA)

El canvas F0 no dibuja campos con error ni foco de teclado legible, así que
aquí se apartan de él a propósito. Valores comprobados en
`tests/unit/design/contrast.test.ts`:

- **Campo** (`KInput`, `Select`, `Input`): relleno `--surface-elevated` y
  **borde de 1 px `--field-border`** (3,65:1 contra la tarjeta, 3,20:1 contra
  el relleno). Sin borde el campo daba 1,14:1 y en alto contraste de Windows
  desaparecía.
- **Foco**: contorno (`outline`) de 2 px `--focus-ring` con 2 px de
  separación (5,45:1 sobre la tarjeta). No el halo `pink/25 %` del canvas
  (1,39:1). Contorno y no `box-shadow` porque la sombra se borra en
  `forced-colors`. Los botones (`KButton`) mantienen su anillo pink de 2 px.
- **Texto de campo**: 16 px en móvil (`text-base`) y 15 px desde `md`. Con
  menos de 16 px, Safari de iOS hace zoom al enfocar.
- **Texto rojo**: siempre `--accent-danger-text` (6,74 / 6,16 / 5,41:1 sobre
  fondo / tarjeta / campo). `text-accent-danger` y `text-danger` ya apuntan a
  él desde `tailwind.config.ts`; el rojo base `--accent-danger` (4,05:1 sobre
  la tarjeta) queda para fondos y bordes.
- **Botón destructivo**: `bg-accent-danger-solid text-on-accent-danger`
  (4,94:1).
- **Error de campo**: borde `--accent-danger`, mensaje con `role="alert"` y
  el campo con `aria-invalid` + `aria-describedby`.
- **Avatares de iniciales**: paleta en OKLCH en
  `src/lib/constants/avatarColors.ts`, cada color con su texto "on-color"
  (≥ 4,99:1). Nada de iniciales en blanco sobre colores claros.
- **Selección de texto**: `--accent-pink` al 30 %.

## Componentes base (no reinventar)

- **Logo** (`src/components/layout/Logo.tsx`, es el que manda): icono SVG de
  24×24 de diseño, escalado al `size` pedido: badge `--surface-elevated` con
  radio 7,5/24 y 3 rectángulos redondeados rotados en cascada (pink `-10deg`,
  lime `6deg`, purple `-4deg`). Wordmark "kultura" en display **700**
  (`font-bold`), `tracking-tight`, a `0,78 × size`, que no se parte nunca
  (`whitespace-nowrap`), con un cuadradito **lime** de `0,15 × size` rotado
  `14deg` al final. El canvas F0 tenía el wordmark a 800 y el cuadrado pink;
  la versión del código es la decidida (D-19) y solo cambia si Víctor lo pide.
- **Cabecera pública** (`Header.tsx`: landing, rankings, perfil público,
  legales): opaca `--surface-default` con borde inferior `--surface-border`,
  56 px de alto, logo de 24 px y los botones "Iniciar sesión" (secundario) +
  "Registrarse" (primario). En móvil los botones son compactos (36 px) y por
  debajo de 360 px "Iniciar sesión" se acorta a "Entra" para que quepa en
  320 px sin scroll horizontal.
- **Header** (todas las pantallas autenticadas, `AuthHeader.tsx`): mismo
  fondo opaco y 56 px. **Canvas F0**: logo a la izquierda (+ chip opcional,
  p. ej. racha), y a la derecha SOLO icono de búsqueda (caja `44×44`
  `border-radius:16px` fondo `--surface-2`) + avatar cuadrado `44×44`
  `border-radius:16px 16px 16px 4px` gradiente `135deg` pink→purple con
  iniciales, sin barra de enlaces. **Estado actual del código**: lleva 8
  enlaces de navegación (`NavLinks`), campana de 32 px y no tiene caja de
  búsqueda; es deuda conocida (frente de navegación), no un patrón a copiar.
- **Chips**: `border-radius:999px`, `font-weight:700`, `padding` variable
  (8–20px según contexto). Activo = fondo de color vivo + texto "on-color"
  correspondiente. Inactivo = fondo `--surface-2` + texto `--text`. Chip
  "outline" = transparente + `border:2px solid var(--stroke)`.
- **Botones pill**: primario = fondo pink + texto on-pink, `font-weight:800`.
  Secundario = borde `2px solid var(--stroke)`, `font-weight:700`,
  transparente. **El canvas lo confirma sin ambigüedad** (E-BOTON-PINK): los
  13 pills de ACCIÓN de las 17 pantallas son pink, sin excepción. Los pills
  lime que hay en el canvas NO son botones: son los badges de match, retirados
  de la UI (E-MATCH-SIN-BADGE). Contarlos como botones hacía parecer que el
  criterio estaba empatado 14-13 y no lo está.
- **Posters / cards sin imagen real**: gradiente de dos paradas
  `linear-gradient(150–160deg, oklch(L1% C1 H), oklch(L2% C2 H))` con el
  mismo matiz (H) en ambas paradas y L2/C2 más bajos (más oscuro/apagado).
  Nunca gris plano ni foto placeholder, siempre bloques de color vivo.
- **Cards "feature" grandes**: además del gradiente lineal, un
  `radial-gradient` de acento en la esquina superior-izquierda
  (`120% 100% at 20% 10%`, color al 55-60% de opacidad, difuminando a
  transparente a 55%).
- **Badge colgante (pegatina)**: pill `--lime` + texto on-lime,
  `font-weight:800`. Versión "colgante" (esquina de poster): offset
  `top:-14px; left:-14px`, `rotate(-8deg)`,
  `box-shadow:4px 4px 0 rgba(0,0,0,.4)`, sombra dura tipo pegatina, no
  blur. **E-MATCH-SIN-BADGE:** nació como "badge de match" y ya NO se usa
  para porcentajes de afinidad (retirados de toda la UI a petición del
  usuario). El primitivo sigue vivo para etiquetas de texto real
  ("Continuando" en el hero de Inicio, "7 formatos culturales" en la
  landing). No reintroducir un `%` aquí sin decisión expresa.
- **Rotación de cards**: en grids tipo bento, las cards destacadas llevan
  una rotación sutil (`-1.2deg` / `1deg`), no todo el grid, solo las
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

## Arbol de decisión: "¿Dudo de cómo diseñar/codificar algo?"

1. **¿Existe en F0 v2 (Home/Discover/MediaDetail)?** → Usa exactamente eso.
   Copia el HTML, los valores de CSS, los radios, los espacios. Zero
   variación.
2. **¿No existe en F0, pero existe un patrón análogo?** → Replica el patrón
   exacto (mismo radio, misma fórmula de gradiente, misma sombra, mismo
   peso). Cambiar solo lo que deba ser diferente semánticamente (p. ej.
   color de fondo si es un chip "inactivo" vs uno "activo", pero mismo
   radio 999px). Ejemplo: "Discover" tiene cards en bento rotadas;
   "Library" necesita grid de tarjetas → mismo radio de card, misma
   formula de rotación (±1deg), misma sombra, solo diferente fondo si el
   contexto lo exige.
3. **¿No existe patrón parecido en F0?** → NO inventar nada. Escalona hacia
   arriba: busca en las 17 pantallas del canvas derivado cómo se resolvió
   un problema similar. Si tampoco existe, pregunta, no es un caso que
   F0 contemple aún, y así lo anotamos para futuras iteraciones.

**Nunca, bajo ninguna circunstancia:**
- Usar un radio que no esté en el set. El set real (canvas + lo que ya usa el
  código, `tailwind.config.ts`) es {0, 4px, 6px, 8px, 12px (`rounded-card`),
  13px, 14px, 16px, 18px (`rounded-18`), 20px (`rounded-20`), 22px
  (`rounded-bento`), 24px (`rounded-24`), 28px (`rounded-bento-lg`), 32px
  (`rounded-bento-xl`)} y 999px para píldoras. Redondear a la que esté ya en
  uso; un radio nuevo se añade aquí antes que en el código.
- Crear una sombra nueva. Las válidas son: sin sombra, `10px 10px 0 var(--surface-2)`
  (hero cards), `4px 4px 0 rgba(0,0,0,.35/0.4)` (badges colgantes), soft blur como
  `0 2px 8px rgba(0,0,0,0.15)` (solo si F0 ya la usa).
- Mezclar hex con OKLCH. Si necesitas un color intermedio, calcula en OKLCH.
  No approximar valores OKLCH a hex "por conveniencia".
- Inventar un componente nuevo (p. ej. "card deslizable", "modal con backdrop
  custom"). Si se necesita, combina componentes existentes, card + backdrop
  estándar, etc.
- Cambiar la tipografía (Bricolage/Figtree) ni los pesos. Si necesitas enfasis,
  usa 700 en lugar de 500, o 800 en lugar de 700, mismo juego de fuentes.

## Paleta de espacios y medidas (literales de F0)

Usar SIEMPRE estos valores, no añadir nuevos:
- **Padding/margen principal** en secciones: `28px` (horizontal) × `28px–56px`
  (vertical, según altura de sección).
- **Gap entre cards en fila**: `20px`.
- **Tamaño de card "standar"** en scroll horizontal: `220px`.
- **Tamaño de avatar**: `44×44` (header), `36×36` (listas), `24×24` (inline).
- **Radio de card estándar**: `14px` o `16px` (héroes y grandes: `20px`).
- **Tamaño de icono en búsqueda**: caja `44×44` con radio `16px`.

No hagas cards de `180px`, `250px`, `300px`, etc., el set de tamaños es cerrado.

## Checklist de validación antes de implementar una pantalla

Antes de tocar código (React/Tailwind), revisar:

- [ ] ¿Existe un mockup en "Kultura Editorial" (F0 v2) o "Kultura, Diseño
      Completo" (canvas derivado)? Si sí, visualizarlo primero.
- [ ] Identificar cada componente usado: ¿header?, ¿cards?, ¿chips?, ¿pills
      de botón?, ¿avatar?, ¿gradiente poster?
- [ ] Para cada componente, confirmar: color (token OKLCH exacto), radio
      (del set cerrado), tamaño, sombra (del set cerrado o ninguna).
- [ ] ¿Hay algún elemento que no esté en este documento? Si sí, buscar en
      el canvas derivado. Si tampoco, documentarlo como "patrón nuevo por
      resolver" y no seguir adelante sin input del usuario.
- [ ] ¿Usas todo CSS puro + Tailwind (clases)? No meter JS especial de
      estilos inline si no es estrictamente necesario. Los radios, sombras,
      colores deben salir de `globals.css` + clases de Tailwind.

## Guía de migración de componentes (diseño → código)

### Fase 1: Inventario (no tocar código aún)
1. Abre el mockup de la pantalla en el canvas derivado.
2. Lista cada "elemento visual": header, hero, card, badge, chip, etc.
3. Para cada uno, anota: nombre del componente, tokens usados, medidas,
   propiedades especiales (rotación, sombra, gradiente).
4. Compara con el componente React existente en `/src/components`.
   - ¿Ya existe con el nombre correcto? (p. ej. `<MediaCard>`)
   - ¿Su prop API es compatible con lo que el mockup necesita?
   - ¿Está usando los tokens OKLCH correctos, o todavía usa hex viejo?

### Fase 2: Actualización progresiva
Si el componente existe pero usa tokens viejos:
1. Reemplaza el color hardcoded por `var(--nombre-token-oklch)`.
2. Ajusta radios si no están en el set válido.
3. Actualiza sombras si no son del set cerrado.
4. No refactorices lógica de negocio, solo estilos.
5. Corre tests unitarios del componente. ✓

Si el componente no existe:
1. Crea uno nuevo basado en el patrón más cercano que SÍ exista.
2. Ejemplo: necesitas `<StoryAvatar>` con anillo conic-gradient
   → consulta cómo `<Avatar>` hace gradiente y amplía con parámetros
   de colores adicionales para el anillo.
3. No inventes estructura HTML nueva si puedes reutilizar `<div>` +
   Tailwind.

### Fase 3: Integración en pantalla
1. Importa componentes ya migrads. Ejemplo: `import { MediaCard } from
   "@/components/MediaCard"`.
2. En la pantalla (p. ej. `Home.tsx`), construye el layout con esos
   componentes, usando espacios del set cerrado (`gap-5` para 20px,
   `p-7` para 28px en Tailwind, o ajustar config).
3. Compara visual: ¿matches el mockup?
4. Corre tests de la pantalla + `npx tsc --noEmit`.
5. Push cuando esté verde.

## Referencia: tokens OKLCH → hex sRGB

Los valores OKLCH son autoridad: en código se usa siempre el token. El hex es
la conversión **exacta** a sRGB (la misma que pinta Chrome, recortando al gamut
sRGB), para lo que no entiende OKLCH: `theme_color` del manifest, imágenes OG,
correos, herramientas de contraste. No es una aproximación: si cambia un token,
esta tabla se actualiza (`tests/unit/design/diseno-doc.test.ts` falla si no
coincide). La conversión está en `src/lib/design/color.ts`.

| Token | Alias F0 | OKLCH | Hex sRGB | Uso |
|-------|----------|-------|----------|-----|
slate #9aa5b8 ingamut True text 7.83 vs white 2.48
red #f66d67 ingamut True text 6.77 vs white 2.88
orange #fb7c00 ingamut False text 7.42 vs white 2.62
amber #f9ad26 ingamut True text 9.86 vs white 1.91
green #4fce74 ingamut True text 9.29 vs white 2.01
teal #35c9c2 ingamut True text 9.16 vs white 2.04
blue #3b9cf6 ingamut True text 6.93 vs white 2.87
purple #9964e5 ingamut True text 4.99 vs white 3.95
lime/on-lime 11.81
destructive 4.94
danger-text [6.74, 6.16, 5.41]
field [3.99, 3.65, 3.2]
pink [5.96, 5.45, 4.79]
sel #fb40ad
| `--surface-base` | `--bg` | `oklch(16% 0.015 280)` | `#0c0d14` | Fondo de página |
| `--surface-default` | `--surface` | `oklch(21% 0.02 280)` | `#161721` | Tarjetas, cabeceras |
| `--surface-elevated` | `--surface-2` | `oklch(26% 0.025 280)` | `#212330` | Chip inactivo, relleno de campo, caja de icono |
| `--surface-border` | `--stroke` | `oklch(32% 0.025 280)` | `#303240` | Borde decorativo, botón secundario |
| `--text-primary` | `--text` | `oklch(97% 0.004 280)` | `#f4f5f8` | Texto principal |
| `--text-secondary` | — | `oklch(76% 0.02 280)` | `#aeb0be` | Texto secundario |
| `--text-tertiary` | `--muted` | `oklch(68% 0.02 280)` | `#9597a5` | Texto terciario, etiquetas |
| `--accent-pink` | `--pink` | `oklch(68% 0.24 350)` | `#fb40ad` | Acento primario, botón primario, foco |
| `--accent-lime` | `--lime` | `oklch(83% 0.24 130)` | `#91e300` | Pegatinas, logotipo |
| `--accent-orange` | `--orange` | `oklch(72% 0.19 55)` | `#fb7c00` | Acento cálido |
| `--accent-purple` | `--purple` | `oklch(62% 0.19 300)` | `#9964e5` | Acento alternativo |
| `--accent-blue` | `--blue` | `oklch(68% 0.16 250)` | `#3b9cf6` | Acento frío |
| `--accent-yellow` | `--yellow` | `oklch(85% 0.17 95)` | `#f1cb1c` | Acento de alerta |
| `--accent-positive` | — | `oklch(83% 0.24 130)` | `#91e300` | Estado positivo (= lime) |
| `--accent-highlight` | — | `oklch(85% 0.17 95)` | `#f1cb1c` | Nota, destacado (= yellow) |
| `--accent-info` | — | `oklch(68% 0.16 250)` | `#3b9cf6` | Información, enlaces (= blue) |
| `--accent-danger` | — | `oklch(60% 0.21 25)` | `#e23439` | Rojo: fondos y bordes de error |
| `--accent-danger-text` | — | `oklch(70% 0.17 25)` | `#f66d67` | Rojo: TODO texto de error (`text-accent-danger`) |
| `--accent-danger-solid` | — | `oklch(55% 0.21 25)` | `#d01c29` | Rojo: botón destructivo |
| `--field-border` | — | `oklch(55% 0.02 280)` | `#6f717d` | Borde de campo de formulario |
| `--focus-ring` | — | `oklch(68% 0.24 350)` | `#fb40ad` | Contorno de foco (= pink) |
| `--on-accent-pink` | — | `oklch(15% 0.02 350)` | `#12080c` | Texto sobre pink |
| `--on-accent-lime` | — | `oklch(18% 0.02 130)` | `#0f130a` | Texto sobre lime |
| `--on-accent-purple` | — | `oklch(15% 0.02 300)` | `#0c0912` | Texto sobre purple |
| `--on-accent-orange` | — | `oklch(16% 0.03 55)` | `#170902` | Texto sobre orange |
| `--on-accent-blue` | — | `oklch(14% 0.03 250)` | `#020a15` | Texto sobre blue |
| `--on-accent-yellow` | — | `oklch(18% 0.03 95)` | `#161103` | Texto sobre yellow |
| `--on-accent-danger` | — | `oklch(97% 0.01 25)` | `#fcf3f2` | Texto sobre rojo sólido |

`--accent-orange` cae un poco fuera de sRGB; el hex es el recortado, que es lo
que se ve en pantallas sRGB.
