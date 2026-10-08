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
  navegación en el header**, F0 no la tiene; no inventarla.
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
- Usar un radio que no esté en {0, 4px, 6px, 8px, 13px, 14px, 16px, 20px, 32px}
  (o 999px para píldoras). Redondear a la que esté ya en uso.
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

## Referencia rápida: tokens OKLCH → aproximación visual (para debug)

Los valores OKLCH son autoridad. Esta tabla es SOLO para debug visual rápido:

| Nombre | OKLCH | Hex aprox. | Uso |
|--------|-------|-----------|-----|
| `--bg` | oklch(16% 0.015 280) | #1a1620 | Fondo página |
| `--surface` | oklch(21% 0.02 280) | #262230 | Card bg |
| `--surface-2` | oklch(26% 0.025 280) | #312c3c | Chip inactivo, icono box |
| `--stroke` | oklch(32% 0.025 280) | #464254 | Borde |
| `--text` | oklch(97% 0.004 280) | #f8f7fa | Texto principal |
| `--muted` | oklch(68% 0.02 280) | #a9a5b5 | Texto secundario |
| `--pink` | oklch(68% 0.24 350) | #e63b7d | Accento primario |
| `--lime` | oklch(83% 0.24 130) | #c4f037 | Accento complementario |
| `--orange` | oklch(72% 0.19 55) | #e8933c | Warm accent |
| `--purple` | oklch(62% 0.19 300) | #b83cc8 | Accent alternativo |
| `--blue` | oklch(68% 0.16 250) | #4a7dd8 | Info/secondary |
| `--yellow` | oklch(85% 0.17 95) | #d4e03c | Alert/warning |

**Importante:** los valores hex son solo referencia visual; el código debe
usar OKLCH. Si necesitas debug en navegador y Tailwind no genera la clase,
usa directamente `background: oklch(...)` en `<style>`.
