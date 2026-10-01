# KULTURA — CLAUDE.md

## Cómo trabajar en este proyecto (instrucciones operativas)

**Meta-regla, la más importante de esta sección:** cualquier indicación
operativa que el usuario dé sobre cómo trabajar (no sobre diseño visual —
eso va en la sección de más abajo) se añade AQUÍ, para no depender de la
memoria de una conversación concreta y saber en todo momento cómo actuar.

- **Tests**: no ejecutar `vitest run` (suite completa) de forma rutinaria
  mientras se itera — pierde tiempo. Usar archivos de test concretos
  (`npx vitest run tests/unit/ruta/al/archivo.test.tsx`) relacionados con
  lo que se está tocando. Reservar la suite completa (y `npx playwright
  test` si aplica) para checkpoints explícitos: justo antes de un push
  importante o al cerrar un bloque de trabajo.
- **Verificación mínima antes de cada push**: `npx tsc --noEmit` limpio +
  los tests unitarios directamente relacionados con los archivos tocados
  en verde. No hace falta más para cada commit intermedio.
- **Un test unitario sobre la query de un proveedor NO la valida.** Fija que
  el código construye lo que yo supuse, no que la API lo acepte — y el proxy
  de estas sesiones bloquea casi todos los proveedores, así que esa mitad no
  se puede comprobar desde aquí. Pasó con E-BOOKS-RANGO: los tests fijaban
  `first_publish_year:[* TO 2026]` en verde mientras Open Library tumbaba esa
  query en producción. Cuando se cambia la FORMA de una query (no solo un
  valor), decirlo explícitamente al pedir la verificación en preview, en vez
  de dar el tema por cerrado con los tests en verde.
- **Antes de dar un fallo por diagnosticado, mirar el LOG, no solo el
  síntoma.** El visor de Vercel está en `vercel.com/<team>/<proyecto>/logs`, y
  el diagnóstico útil va dentro de `message` desde `1fd9606`. Si no tengo
  acceso al log, decir que el diagnóstico es una hipótesis, no un hecho.
- **Una correlación no es un mecanismo. Aislar la variable ANTES de pushear.**
  Con el catálogo de libros caído encadené DOS arreglos equivocados: deduje la
  causa de "falla sin filtro de año, funciona con década" y pusheé; falló; volví
  a deducir y volví a pushear; falló otra vez. La correlación era correcta las
  dos veces, el mecanismo no. Lo resolvió una tabla de seis peticiones a la API
  viva cambiando UN parámetro cada vez, que reveló que el culpable era un campo
  (`isbn`) que no aparecía en ninguna de mis dos teorías.
  **El proxy de estas sesiones bloquea a los proveedores, pero el usuario tiene
  navegador**: construir las URLs exactas, pedirle que las abra y decir qué
  significa cada resultado. Cuesta una ronda y ahorra varios pushes a ciegas.
- **Un test de regresión que no se ha visto FALLAR no prueba nada.** Comentar
  el arreglo, comprobar que el test se pone rojo, restaurarlo. Son treinta
  segundos y es la diferencia entre fijar el bug y fijar la suposición.
- **Máximo paralelismo cuando se pida** ("usa agentes en paralelo", "usa
  todo lo que tengas a tu disposición", etc.): lanzar varios `Agent` en
  paralelo con `isolation: "worktree"`, uno por área de trabajo
  independiente (pantalla, componente, feature — nunca dos agentes sobre
  el mismo archivo). Cada agente debe: leer este archivo primero, hacer
  solo el cambio que se le pide (paso puramente visual salvo que se diga
  lo contrario), verificar con `tsc` + tests dirigidos, commitear
  localmente (sin pushear, sin PR). Al terminar cada uno: revisar el
  resultado, fusionar (`git merge --no-ff`) en la rama de trabajo,
  resolver a mano los conflictos que aparezcan (los worktrees pueden
  partir de un commit base distinto al HEAD actual si se lanzaron antes
  de un push reciente — comprobar con `git merge-base` si algo no
  cuadra), volver a verificar (`tsc` + tests dirigidos) y solo entonces
  pushear. Limpiar los worktrees y ramas temporales (`git worktree
  remove`, `git branch -d`) una vez fusionados.
- **Una tarea o lote coherente de trabajo por commit**, mensaje
  descriptivo en español (prefijo `[design]`/`[fix]`/`[cleanup]` según el
  tipo). Sin `Co-Authored-By` salvo que el arnés de la sesión lo exija
  explícitamente.
- **PR activa**: mientras haya una PR abierta y suscrita (referencia
  actual: `benevi/kultura#5`), cada push se verifica contra CI antes de
  darlo por bueno; los avisos rutinarios de Vercel (building/ready) no
  requieren ninguna acción, solo los fallos de CI o comentarios de
  revisión nuevos.
- **No fusionar/mergear la PR sin autorización explícita y fresca del
  usuario** para esa PR en concreto — una aprobación anterior no vale
  automáticamente para el siguiente push.
- **Si la app cae entera con `ERR_NAME_NOT_RESOLVED` contra
  `*.supabase.co`, sospechar PRIMERO del proyecto pausado**, no del código.
  El plan gratuito de Supabase pausa el proyecto tras unos días sin
  actividad y deja de publicar su DNS; el síntoma es exactamente ese y no
  lo provoca ningún despliegue. Se resuelve con *Restore* en el panel.
  Mitigación en el repo: cron diario a `/api/health` (E-KEEPALIVE, ver
  abajo). Mitigación de verdad para producción: plan de pago, que no
  auto-pausa.

---

# Sistema de diseño (fuente de verdad)

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
- **Badge colgante (pegatina)**: pill `--lime` + texto on-lime,
  `font-weight:800`. Versión "colgante" (esquina de poster): offset
  `top:-14px; left:-14px`, `rotate(-8deg)`,
  `box-shadow:4px 4px 0 rgba(0,0,0,.4)` — sombra dura tipo pegatina, no
  blur. **E-MATCH-SIN-BADGE:** nació como "badge de match" y ya NO se usa
  para porcentajes de afinidad (retirados de toda la UI a petición del
  usuario). El primitivo sigue vivo para etiquetas de texto real
  ("Continuando" en el hero de Inicio, "7 formatos culturales" en la
  landing). No reintroducir un `%` aquí sin decisión expresa.
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
   un problema similar. Si tampoco existe, pregunta — no es un caso que
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
  custom"). Si se necesita, combina componentes existentes — card + backdrop
  estándar, etc.
- Cambiar la tipografía (Bricolage/Figtree) ni los pesos. Si necesitas enfasis,
  usa 700 en lugar de 500, o 800 en lugar de 700 — mismo juego de fuentes.

## Paleta de espacios y medidas (literales de F0)

Usar SIEMPRE estos valores — no añadir nuevos:
- **Padding/margen principal** en secciones: `28px` (horizontal) × `28px–56px`
  (vertical, según altura de sección).
- **Gap entre cards en fila**: `20px`.
- **Tamaño de card "standar"** en scroll horizontal: `220px`.
- **Tamaño de avatar**: `44×44` (header), `36×36` (listas), `24×24` (inline).
- **Radio de card estándar**: `14px` o `16px` (héroes y grandes: `20px`).
- **Tamaño de icono en búsqueda**: caja `44×44` con radio `16px`.

No hagas cards de `180px`, `250px`, `300px`, etc. — el set de tamaños es cerrado.

## Checklist de validación antes de implementar una pantalla

Antes de tocar código (React/Tailwind), revisar:

- [ ] ¿Existe un mockup en "Kultura Editorial" (F0 v2) o "Kultura — Diseño
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
4. No refactorices lógica de negocio — solo estilos.
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

## Estado de la migración a código (Tailwind / componentes React)

Los tokens OKLCH de este documento están mapeados 1:1 a las custom
properties CSS reales (`globals.css`/`tailwind.config.ts`) — MISMOS
nombres de variable que ya usaba el código, valor nuevo; así se propaga
automáticamente a casi todo componente existente sin tocarlo. No mezclar
con una paleta hex antigua.

**Hecho:**
- Tokens OKLCH + radios de chip/botón a píldora completa (999px).
- `Logo` con la geometría literal de F0 (3 rectángulos rotados).
- `MediaCard`: gradiente de poster determinista cuando no hay imagen real
  (nunca gris plano) + acento radial opcional (`accentHue`) para las
  cards "feature" del bento.
- `KButton` ya es píldora completa (pesos 800/700 primario/secundario).
- **Home, Discover y MediaDetail** ya tienen el acabado visual literal de
  F0 (hero con badge colgante, bento con rotación + acento radial, layout
  de dos columnas con badge colgante en MediaDetail).
- **Landing**: reducida a DOS bloques (hero + features) y con PORTADAS
  REALES del catálogo en vez de bloques de color
  (E-LANDING-SHOWCASE). Patrón nuevo, reutilizable en cualquier pantalla
  pública que quiera enseñar catálogo:
  - `src/lib/landing/showcase.ts` resuelve la muestra reusando
    `fetchAggregateData` (el modo "all" de Descubrir: fan-out a las 7
    familias, normalizado, NSFW filtrado, tolerante a que una familia
    falle). `pickShowcase` pone primero un item de cada tipo para que el
    collage no salga con tres películas.
  - `/[locale]` se renderiza on-demand, así que la muestra va envuelta en
    `unstable_cache` (un día) con presupuesto de tiempo duro. Una muestra
    corta LANZA a propósito: `unstable_cache` no guarda rechazos, así un
    hipo de un proveedor no congela la landing sin imágenes 24 h.
  - `src/components/landing/PosterTile.tsx` es el primitivo de portada
    (imagen con respaldo de gradiente DETRÁS, así que un 404 deja color y
    no un hueco). **Ninguna pantalla debe depender de que haya
    portadas**: sin muestra, cada pieza cae a su versión de gradiente,
    y por eso los huecos van dentro de `<Suspense>` con esa versión como
    fallback (`ShowcaseSlots`) — el primer pintado no espera a ningún
    proveedor.
  - Las portadas se enseñan SOLO en el hero (collage en escritorio, tira
    en móvil). Las tarjetas de features llevan únicamente su icono
    centrado: las miniaturas que hubo ahí competían con el collage y
    dejaban la tarjeta abarrotada.
  - El hero tiene UN solo CTA. El secundario era un ancla a `#features`
    que, con la landing en dos bloques, movía la página unos píxeles; y
    el catálogo no vale de destino porque todo `(app)` redirige a login
    sin sesión.

**Pendiente:** las 13 pantallas restantes (Login, Library,
Search, Friends, Groups, GroupDetail, Chat, Notifications, Profile,
Lists, ListDetail, Settings, Suggestions) heredan bien los colores vía
custom properties pero no tienen todavía el acabado F0 específico de
cada una (formas, sombras duras, chips colgantes, etc. — ver "Principio
de extensión a pantallas nuevas" arriba). Migrar con el mismo patrón:
un agente por pantalla o grupo de pantallas afines, siguiendo las
instrucciones operativas de la cabecera de este documento.

- **Porcentaje de match retirado de la UI** (E-MATCH-SIN-BADGE). Ya no se
  pinta en Descubrir, ficha, recomendaciones IA ni novedades de Inicio. Lo
  que se quitó es la ETIQUETA, no el motor: `computeMatchScores` sigue
  siendo el criterio con el que la IA elige cada recomendación
  (`lib/claude/recommendations.ts`). Consecuencias a tener presentes:
  - `/api/discover` y `/api/genre-news` ya NO calculan match: lo hacían
    solo para el badge, y era una lectura de biblioteca + scoring en cada
    petición de catálogo.
  - La ficha SÍ sigue recibiendo `matchScore`, pero solo como compuerta de
    "Por qué te lo recomendamos": sin él, esa sección le diría "coincide
    con géneros que ya te gustan" a alguien de cuyos gustos no sabemos
    nada. El texto ya no cita ningún porcentaje.
  - **El prompt de las recomendaciones prohíbe citar el % en la frase.**
    Quitar los badges no bastó: el modelo seguía escribiendo "match de
    73%" en el `reason`, que es la misma cifra por la puerta de atrás. El
    match sigue viajando en el prompt como criterio de elección; lo que no
    puede es salir en el texto.

- **El catálogo no muestra fechas futuras** (E-CATALOGO-FUTURO). Regla
  común a las 7 familias; la referencia vive en
  `src/lib/api/catalog-window.ts` y cada proveedor la aplica con SU
  operador nativo (`.lte` en TMDB, `startDate_lesser` en AniList, `dates`
  en RAWG, `cover_date` en ComicVine, `first_publish_year` en Open
  Library). Tres cosas que hay que respetar al tocarlo:
  - **Excepción `estado=upcoming`** en series y anime: ahí el futuro es
    justo lo que se pide. En `tv` la regla se INVIERTE — el límite va abajo
    (`first_air_date.gte = hoy`), no arriba. Tres cosas se juntaron aquí y
    conviene no deshacer ninguna por separado:
    1. El tope superior no se aplica (con él, cero resultados siempre).
    2. **Tampoco el suelo de votos** (E94) — E-UPCOMING-SIN-VOTOS: una
       serie sin emitir no la ha votado nadie, así que exigirle 50 votos la
       vaciaba igual. El filtro llevaba vacío desde julio de 2026 por esto,
       no por el tope. Si se añade otro umbral de calidad a TMDB,
       comprobar antes qué hace con `upcoming`.
    3. **Hace falta el límite inferior de fecha** — E-UPCOMING-FECHA:
       `with_status=1|2` es el estado de PRODUCCIÓN (Planned | In
       Production), NO "aún no estrenada". Una serie de 1989 que sigue
       rodándose lo cumple, y sin el `.gte` la primera página de
       "Próximamente" salía con estrenos de 1989, 2021 y 2024. Contrapartida
       asumida: las series anunciadas SIN fecha quedan fuera.
  - **Rango que empieza en el futuro se respeta** sin recortar: recortarlo
    daría una ventana invertida = catálogo vacío.
  - **Libros: el rango solo viaja si el usuario filtró por año**
    (E-BOOKS-RANGO). Sin filtro de año, un rango que abarca el corpus entero no
    filtra nada, así que no se manda y el tope de futuro se aplica como
    **post-filtro** (`dropFutureYears`), igual que en manga; la ventana de 60
    absorbe el recorte. Con filtro de año el rango viaja en la consulta —ahí es
    selectivo y mantiene las páginas llenas— y ya trae el tope puesto, así que
    no se post-filtra: hacerlo vaciaría además el caso de un año futuro
    explícito, que se respeta a propósito.

    **Aviso: el rango NO era la causa del catálogo caído.** Lo diagnostiqué así
    dos veces seguidas (primero el comodín `*`, luego el coste del rango ancho)
    y las dos veces pusheé un arreglo que no arreglaba nada. La causa real está
    en el punto siguiente.
  - **Libros: el LISTADO nunca pide `isbn`** (E-BOOKS-ISBN). **Esta era la
    causa real** de que Descubrir → Libros devolviera "No se pudo cargar el
    contenido". Open Library sirve TODOS los ISBN de TODAS las ediciones de una
    obra, y la consulta ancha del catálogo (`subject:"fiction"`) abre por los
    clásicos — Frankenstein, Drácula, Dorian Gray — que acumulan miles de
    ediciones. Pedir ese campo para 20-60 obras genera una respuesta que el
    proveedor no llega a servir: corta la conexión, y en el log sale como
    `TypeError: terminated · cause=SocketError: other side closed`, **no** como
    un 4xx (por eso parecía una query rechazada y no lo era).

    Medido contra la API viva, misma consulta y mismo `limit`: con `isbn` falla
    con 60 **y con 20**; sin `isbn` responde con 60 aunque lleve `subject` y
    `publisher`, que también son arrays grandes. Es ese campo, no el tamaño de
    página ni el rango de años.

    `LIST_FIELDS` (catálogo y buscador) va sin `isbn`; `DETAIL_FIELDS` (ficha)
    lo lleva, y ahí es seguro porque se pide para UN solo documento. El ISBN
    sigue haciendo falta para puentear a Google Books sin emparejar por título.
    `openLibraryFetch` tiene además un timeout de 8 s: sin él, una conexión
    cortada dejaba la función esperando y el log no decía nada útil.
  - **Manga es la excepción técnica**: MangaDex solo acepta `year` como
    igualdad, sin rango, así que ahí el tope es un post-filtro
    (`dropFutureYears`) de tipo marginal — como el NSFW global, no cuenta
    en `hasActivePostFilter`.
  - **Cómic necesitó ventana ampliada** (E-COMIC-VENTANA). El tope no
    rompió nada, pero DESTAPÓ que el filtro de editoriales se come el
    grueso de lo reciente: sin tope, los 100 primeros por `cover_date:desc`
    eran solicitaciones futuras de grandes editoriales americanas (que
    sobreviven bien); con tope pasaron a ser los 100 más recientes ya
    publicados, donde ComicVine está lleno de manga que el filtro descarta
    → la página 1 se quedó en CINCO cómics. Ahora cada página mira hasta
    3 ventanas de 100 y para en cuanto junta 20. Dos cosas que van juntas:
    el presupuesto está acotado a propósito (ComicVine limita a ~200
    peticiones/hora, y cada ventana cuesta 2: issues + volúmenes), y el
    conteo de páginas divide por lo que la página CONSUME (300), no por lo
    que enseña (20) — dividir por 20 anunciaba 15 veces más páginas de las
    que existen.

- **El catálogo de cómic es una LISTA BLANCA de editoriales**
  (E-COMIC-ALLOWLIST). Vive en `src/lib/api/comic-publishers.ts`, no en
  `comicvine.ts`. Antes eran dos listas NEGRAS (manga + adulto) y el
  problema no era su contenido sino su forma: **por defecto aceptaban**,
  así que una editorial no enumerada pasaba. La página 100 de Descubrir →
  Cómics salía entera en manga, con hentai explícito ("ANGEL Club MEGA").
  Cuatro cosas que hay que respetar:
  - **La puerta deniega por defecto.** Solo entra el publisher que está en
    `COMIC_PUBLISHERS`. Añadir el sello que se acaba de colar a una lista
    negra es el patrón que falló: cada hueco se descubría en pantalla.
    Contrapartida asumida: una editorial legítima que falte queda fuera
    del catálogo — es el lado correcto en el que fallar.
  - **Las listas negras siguen vivas como VETO posterior, y no es
    redundancia.** Resuelven los sellos que heredan el nombre de una
    editorial permitida: "Dark Horse Manga" dentro de "Dark Horse",
    "Glénat Manga" dentro de "Glénat", "Fantagraphics Eros" dentro de
    "Fantagraphics". El orden es lista blanca → veto; invertirlo los deja
    pasar.
  - **El match es por PALABRAS COMPLETAS, no por substring.** Con
    substring crudo la entrada "DC" casa con "Hardcover" ("har-DC-over") y
    abre la lista blanca de par en par. Se normaliza (minúsculas, sin
    diacríticos, puntuación a espacios) y se compara con espacios a los
    lados. Misma política anti-falsos-positivos que el filtro NSFW.
  - **El filtro NSFW global NO cubre al cómic.** `normalizeComic` no
    asigna `genres`, así que de ese filtro solo aplica la rama de
    texto ES/EN sobre el título. La puerta de editoriales es la defensa
    real; no contar con la otra.

- **La editorial NO basta: hace falta un veto por SERIE**
  (E-COMIC-SERIE-ADULTA). Medido en pantalla, no deducido: *Swinging Island
  — A Taste of Freedom* es un álbum erótico que sale con el logo de
  **Splitter** en la portada, la misma casa que publica *Der tönerne
  Thron*, *Bob Morane* y *Rick Master*. Una editorial legítima publicando
  una serie adulta bajo su propio nombre es un caso que **ninguna lista de
  editoriales puede resolver**, porque la editorial es la misma a los dos
  lados. Tres cosas:
  - `BLOCKED_COMIC_VOLUMES` veta por nombre de SERIE, y `acceptsComicIssue`
    aplica las dos puertas: editorial primero, serie después. El nombre sale
    de `volume.name`, que ya viene en el `field_list`, así que no cuesta
    una petición más.
  - **Quitar la editorial era la alternativa y es peor**: se habría llevado
    por delante la BD alemana legítima, y la siguiente editorial europea
    haría lo mismo. Lo adulto aquí es la serie, no la casa.
  - **Esta lista es enumerativa y no lo disimula.** Es el grano correcto,
    no la solución estructural. La estructural sería pasarle el filtro NSFW
    a la sinopsis larga (`description`) de ComicVine; está **pendiente de
    medir el coste del campo**, porque pedirlo para 300 issues por página es
    exactamente lo que tumbó el catálogo de libros (E-BOOKS-ISBN). Ojo: la
    API de ComicVine exige clave, así que el truco de pasarle URLs al
    usuario para medir desde su navegador NO sirve aquí.
  - El manga de esa misma página resultó ser **también de Splitter**, así
    que era el mismo agujero. Lo resuelve el punto siguiente, no el veto por
    serie: una línea de manga es una categoría, no una serie, y enumerarla
    no escala.

- **El cómic tiene su propio techo de páginas** (E-COMIC-PROFUNDIDAD):
  `COMIC_MAX_PAGES = 20`, por debajo del común `DISCOVER_MAX_PAGES = 100`.
  Es la única familia cuya página N no lee la página N del proveedor sino
  el offset `(N-1) × 300`, así que con el tope común la página 100 pedía a
  partir del issue 29.700 por `cover_date:desc` — donde ya no hay catálogo
  occidental y solo queda el fondo que la lista blanca descarta. Dos
  matices:
  - **El techo es del CATÁLOGO, no del buscador.** En búsqueda la página N
    es el offset `(N-1) × 20`, la zancada normal, y el argumento de la
    profundidad no aplica: buscar un cómic por su nombre y no encontrarlo
    sería peor que el problema. Mismo criterio que el tope de fechas.
  - **20 es un número estimado, no medido** contra la API viva (el proxy
    de estas sesiones bloquea `comicvine.gamespot.com`). Si en preview la
    página 20 sigue llegando llena, subirlo; si se vacía antes, bajarlo.

- **El veto por concepto NO FUNCIONA, y sale manga en Cómics a propósito**
  (E-COMIC-CONCEPTO). Verificado en preview: tras desplegarlo, los cuatro
  mangas de Splitter (*I Wanna Be Your Girl*, *Is He the One?*, *Ascendance
  of a Bookworm*, *Hana Ne Peut Pas Vivre Sans Moi*) **seguían saliendo**.
  `concepts` no llega en el batch a `/volumes/`. Si alguien lee ese código
  buscando qué protege el catálogo del manga: **nada lo protege**; trabajan
  la lista blanca y el veto por serie.
  - **La contrapartida está ACEPTADA, no pendiente** (decisión del usuario,
    01/10/2026): sale manga europeo en Cómics y se queda así. Es un fallo de
    categorización —el manga tiene su propia sección—, no de contenido: lo
    adulto sí está cubierto. La alternativa era una lista blanca estricta que
    se llevaba por delante a Splitter, Dargaud, Delcourt, Casterman, Soleil,
    Panini y Egmont, o sea la BD europea entera. Pagar el catálogo por una
    cuestión de estantería era mal cambio.
  - **El código se queda porque falla ABIERTO y no cuesta nada**: sin
    conceptos el issue pasa, el campo viaja en un batch que ya se hacía, y el
    día que llegue empieza a trabajar solo. Hay un test que fija el
    fallo-abierto: denegar sin dato vaciaría el catálogo entero.
  - **Hipótesis de por qué no llega, SIN CONFIRMAR**: los endpoints de LISTA
    de ComicVine no pueblan los campos agregados (`concepts`, `characters`,
    `people`), que solo existen en el de DETALLE (`/volume/4050-{id}/`). Si
    es así la vía se cae por coste: una petición de detalle por volumen
    (20-60 por página) contra ~200/hora.
  - **Cómo medirlo si se retoma**: una línea de log temporal en
    `resolveVolumePublishers` y el visor de Vercel. El truco de construir
    URLs y pedirle al usuario que las abra NO sirve aquí: la API exige clave.
    Se intentó y se gastaron tres rondas en 404s y claves inválidas.
  - **Lección que vale más que el filtro**: un filtro que falla abierto y no
    funciona es indistinguible de uno que funciona si solo miras si la página
    carga. Lo que hay que mirar es si el contenido DESAPARECE. Mismo patrón
    que el keep-alive cacheado (E-KEEPALIVE): un placebo que devuelve 200.

- **Keep-alive de Supabase** (E-KEEPALIVE). `/api/health` hace una consulta
  real a la base (`profiles`, `head:true`) y `vercel.json` la llama con un
  cron diario. Sirve además de endpoint para un monitor de caídas externo.
  Tres cosas que NO hay que romper:
  - `export const dynamic = "force-dynamic"` + `Cache-Control: no-store`.
    Si la respuesta se cachea, el cron deja de tocar la base y el
    keep-alive pasa a ser un placebo que devuelve 200 mientras el proyecto
    se pausa igual. Hay un test que lo fija.
  - Usa el cliente **admin**: así el chequeo no depende de RLS ni de que
    haya sesión, y "hay error" significa de verdad "la base no responde".
  - El detalle del error va al log, NUNCA a la respuesta pública.
  - **Los crons de Vercel solo corren en producción**, no en preview.
  - Esto MITIGA la pausa, no la garantiza: depende de que Supabase cuente
    la petición como actividad (no documentado). Para producción, plan de
    pago.

**Deuda técnica por resolver:**
- **`EXCLUDED_COMIC_CONCEPTS` es un placebo verificado** (E-COMIC-CONCEPTO):
  el filtro está, los tests están, y no filtra nada porque el campo no llega.
  Se conserva porque falla abierto y es gratis, pero NO contarlo como defensa
  al razonar sobre el catálogo de cómics. Resolver o borrar cuando se mida de
  verdad por qué `concepts` no viaja.
- `books-maps.ts` quedó casi entero como código muerto tras el híbrido de
  libros (E-BOOKS-HIBRIDO): solo siguen vivos `BOOKS_FORMATO` y
  `BOOKS_PUBLISHER`, que alimentan opciones de la UI. El constructor de query
  de Google Books y sus helpers ya no los importa nadie — se conservan un
  ciclo por si hay que revertir, y hay que borrarlos (con sus tests) cuando el
  híbrido esté validado en producción.
- `KButton` y `button.tsx` (shadcn-style) conviven como dos sistemas de
  botón distintos — decidir cuál se queda antes de seguir migrando
  pantallas que usan el segundo.
- Revisar si el rojo legado de shadcn (`--primary: 0 79% 51%` en
  `globals.css`) sigue siendo visible en algún componente real; no se ha
  tocado en este pase.

## Flujo de trabajo recomendado para un nuevo sprint de diseño

1. **Planificación:** listar pantallas a migrar (p. ej. "Landing, Login").
2. **Lanzar agentes en paralelo** (si son 2+ pantallas):
   - Cada agente lee este CLAUDE.md primero.
   - Cada agente hace el checklist de validación.
   - Cada agente toca componentes/pantalla de su área ÚNICAMENTE.
   - Cada agente verifica con `tsc` + tests dirigidos localmente.
   - Cada agente commitea sin pushear.
3. **Fusión local:** revisar cada rama, hacer merge con `--no-ff`, resolver
   conflictos de estilos/espacios a mano, volver a verificar.
4. **Push único:** cuando todo esté verde y fusionado, push a la rama de
   feature.
5. **CI check:** esperar a que Vercel/CI se ponga verde.

## "¿Y si necesito algo no documentado?"

1. Abre una "issue de diseño" en el repo o apunta en este CLAUDE.md como
   "patrón por resolver: [descripción]".
2. No avances hasta que el usuario valide la solución.
3. Una vez validado, añade la solución a este documento para que no dependa
   de memoria.

Este documento es vivo; evolucionará conforme aparezcan nuevos patrones.
