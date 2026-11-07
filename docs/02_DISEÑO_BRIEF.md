# KULTURA 2.0 — Brief de diseño (F2, pasos 1–3 de §6.1)

**Estado:** v1.1 · 2026-11-07. Revisado por Artisan y Advocate (`04_DECISIONES` §4). Está **pendiente del «sí» escrito de Víctor** en cada puerta: §A, §B y §C–§D.
**Manda:** `PLAN_ESTRATEGICO.md` §5–§6 y `04_DECISIONES_Y_RIESGOS.md`. La voz va en `docs/VOZ.md`.
**Para qué sirve:** que «como kprverse» deje de ser un gusto y pase a ser una lista de reglas medibles. Una propuesta que incumpla una regla de este documento no se enseña.
**Evidencia:** las referencias se consultaron en el navegador integrado el **2026-11-07**, a 1440 × 900 (y kprverse también a 390 × 844). Las cifras salen de `getComputedStyle` sobre la página real. Lo no medido lleva **(no verificado)**.

---

## §A · Plataforma de marca

### A.1 A quién hablamos (cuña A, D-F1c y D-F1d)
Todo este apartado sale de **evidencia de mesa**: plan §1, §2.2 y §5.1, y el estudio C de D-F1d (en Trends ES, FilmAffinity ≈ 30 veces MAL + AniList; r/peliculas tiene 1,1 M). **(No verificado con personas** hasta las entrevistas, que D-F1 movió a antes de F4.)
- **Quién:** personas de 20 a 40 años en España que siguen **2–4 series a la vez** y ven películas sueltas. Puntúan en FilmAffinity, que no lleva episodios ni exporta. Llevan la cuenta de memoria, en notas del móvil o en una hoja, o se quedaron sin TV Time el 15/7/2026.
- **Cuándo y dónde:**
  - en el **móvil, en el sofá, al terminar un episodio**, con una mano y en < 10 s («¿por cuál iba?», «marcar visto»);
  - en el **escritorio**, para importar, ordenar y hacer listas.
- **Qué quieren:** saber por dónde van, no perder el hilo entre plataformas y que sus datos no dependan de que una app cierre.
- **El pack, como segundo acto (D-F2b):** los 7 formatos (películas, series, anime, manga, libros, cómics y juegos) juntos en una misma web son **lo único que nadie más ofrece** (plan §3). No son un regalo escondido:
  - son la razón para quedarse;
  - entran por la cuña;
  - **no son el titular**, porque la gente llega con un dolor concreto, no buscando un catálogo (plan §2.1 y §2.4).

  Cómo se ve, en §A.4. Si la prueba de humo reabre la cuña (≥ 30 altas de anime que ganan por D-F1b), se rehace la cuña y el pack se queda igual.

### A.2 Personalidad: 3 adjetivos y 3 anti-adjetivos
Cada adjetivo tiene una prueba que se ve en una captura; si falla, falla el criterio 1 de la rúbrica.

| Somos | Se ve en | No somos | Se ve en (prohibido) |
|---|---|---|---|
| **Cinematográfica**: la portada es la escena y la interfaz es el encuadre | portada real ≥ 40 % del primer pantallazo; profundidad con capas de la propia portada; negro `#0a0a0a` como sala | **Infantil o artesanal** | ilustraciones, mascotas, emojis, trazos «a mano», pastel, esquinas muy redondas |
| **Exacta**: el dato justo, en su sitio | «T2 E5», fecha o minutos que faltan como dato visible (K8); un número por bloque, nunca un párrafo | **Corporativa o SaaS** | «features / cómo funciona / FAQ», hero centrado con dos botones, «Empieza gratis», iconos de librería en tarjetas |
| **Cómplice**: habla como alguien que también va por el episodio 5 | tuteo, frases de ≤ 12 palabras, ningún texto que explique la interfaz | **Ruidosa** | neón, glow, cristal, degradados, estética gamer, animación que se nota en cada clic |

### A.3 Promesa
- **Promesa completa** (plan §5.1, sin cambios): *«Lleva tus series y películas al día, en español, con tu gente, y con tus datos siempre tuyos.»* No se escribe en la web: es el criterio para decidir qué entra.
- **Titular de la portada:** ≤ 32 caracteres, en 2 líneas a 390 px con el zoom por defecto. Hay 3 candidatos y **Víctor elige uno**:
  1. **«Sabes por dónde vas.»** (20): nombra el dolor (perder el hilo). Pero **solo funciona si la frase de apoyo se ve en el primer pantallazo a 390**; sola, podría ser un GPS.
  2. **«Tus series, al día.»** (19): se entiende en 5 s sin contexto. Es lo que diría cualquier tracker; el carácter lo pone el diseño.
  3. «Cada episodio, en su sitio.» (27): exacto, pero más frío.

  **Elegido: el 2, «Tus series, al día.»** (Víctor, 2026-11-07, D-F2a). El 1 queda como candidato para la frase del cierre de la portada.
- **Frase de apoyo** (≤ 90 caracteres, siempre visible con el titular): «Series y películas al día, en español. Y tus datos, siempre tuyos.»
- **Lo que no prometemos:** IA, cifras de usuarios, «gratis para siempre» ni «sustituto de TV Time» (D-F1d: esa demanda ya migró). Tampoco nada de dinero en la portada (D4).

### A.4 El pack: cómo se enseña (D-F2b)
- **P1 · Segundo acto de la portada:**
  - el **segundo pantallazo** enseña el pack con **portadas reales de los 7 formatos** en mosaico (R4);
  - es un grupo visible de **≥ 1 portada por formato**, que se reconoce sin leer;
  - los 7 formatos **no se listan con palabras** ni se explican; como mucho una frase (I1) que no sea «todo en un solo lugar» (X12).
- **P2 · El perfil público es el pack:** la vitrina de una persona junta sus formatos en una misma composición. Es lo que se comparte (bucle de crecimiento, plan §5.2.5). Un formato vacío no deja hueco ni rótulo: simplemente no aparece.
- **P3 · Un solo sistema para los 7:** la misma forma (K3), el mismo rótulo (R2) y el mismo gesto (B2) sirven para cualquier formato. Solo cambian la unidad del dato (K8: «T2 E5», «cap. 112», «p. 240», «12 h») y la proporción de la portada si el material lo exige (por ejemplo, la carátula de un juego). Nada de colores por formato ni iconos de formato.
- **P4 · Lo que no hace el pack:** no es el titular, no es una rejilla de 7 categorías con icono y no se anuncia con cifras («7 formatos»).

### A.5 Tono
El registro, el presupuesto de palabras y la lista negra están en **`docs/VOZ.md`** (v2). Allí también se dice qué reglas del `VOZ.md` de la raíz se anulan.

---

## §B · Referencias convertidas en reglas
Formato: **medido** → **se toma** (regla con identificador, para poder citarla: «falla K3») → **se descarta**.

### B.1 KPR — kprverse.com (referencia principal)
URL: https://kprverse.com · consultada el 2026-11-07.
**Medido:**
- Titular `h1` en ABC Whyte Plus de **159 px** a 1440 (56–73 px a 390), **tracking −8 %**, **interlineado 0,84**, en mayúsculas.
- Texto corrido en 13,5 px. Rótulos en IBM Plex Mono de **6–12 px**, en mayúsculas.
- Página de **16.410 px** con **171 imágenes y 19 vídeos**, y 1 `canvas` WebGL.
- **Chaflán de 16 px** en la esquina inferior izquierda del botón (`clip-path`).
- Personajes que se salen de su marco y escenas con un campo de color entero.
- Hay también secciones blancas, filetes de 1 px, una cruceta y un cargador a pantalla completa.

**Se toma:**
- **K1 · Titular display:** KulturaDisplay (corte estático de 800).
  - Tamaño: **≥ 96 px a 1440 y ≥ 48 px a 390**.
  - Tracking: **−5 % a ≥ 96 px** y **−3 % a 48 px**, con interpolación entre ambos.
  - Interlineado: **0,85–0,95** en caja baja; **≥ 0,92 en caja alta**, probado con «AÑO ÉPICO» para que no se toquen tildes y «Ñ».
  - Como máximo **2 líneas con el zoom por defecto**. Con zoom al 200 % puede partirse más, pero sin desbordarse ni cortarse.
  - Caja alta o baja se decide en los style tiles. Si es alta, **solo con `text-transform`**, nunca en `messages` (`glossary.test.ts:105-118`).
- **K2 · Contraste de escala:**
  - titular/cuerpo **≥ 6:1 a 1440** (KPR 11,8:1) y **≥ 3:1 a 390**;
  - el cuerpo nunca baja de 16 px;
  - **≤ 4 tamaños visibles** por pantalla: display, frase (I1), cuerpo y dato/botón.
- **K3 · Chaflán:** una sola esquina, la inferior izquierda.
  - Dos tokens: **14 px** en controles y **18 px** en portadas y paneles. Son los valores de `landing.css:59` y `:76`.
  - Ningún otro radio > 2 px, salvo los controles circulares (avatar, interruptor).
  - **El anillo de foco va fuera del recorte**, en el contenedor o en un pseudo-elemento sin `clip-path`, porque `clip-path` corta el `outline` (WCAG 2.4.7).
  - El área táctil sigue siendo ≥ 44 × 44 px.
- **K4 · Rompe el marco:**
  - la portada protagonista se parte en capas (mapa de profundidad del pipeline semanal, plan §6.4) y el sujeto sobresale del marco con chaflán;
  - **una vez por pantalla como máximo**, y solo si hay mapa de profundidad; si no, la portada va plana.
- **K5 · Campo de escena:**
  - **Color:** el acento se extrae de la portada protagonista (`--scene`, `landing.css:13`) y se acota a **L 55–75 % y C ≥ 0,08 en OKLCH**. Si su tono cae en 250–290° (X11), se gira fuera de esa franja.
  - **Contraste:** el pipeline calcula **≥ 4,5:1 para texto y ≥ 3:1 para controles y barras** (WCAG 1.4.11). Si no llega, se usa un color de reserva fijo (se define en el paso 5).
  - **Superficie:** **≤ 10 % de la pantalla**, salvo **un campo a sangre por recorrido**, que **no cuenta como «fondo claro»** para X1.
  - **El foco nunca usa `--scene`.**
- **K6 · Densidad de material:**
  - **≥ 1 portada real en cada pantallazo** y **≥ 40 % del primero**;
  - ninguna zona vacía de más de medio pantallazo.
- **K7 · El dato, no el adorno:**
  - los datos reales (`T2 E5`, `2026`, `48 min`) van en **cifras tabulares de Bricolage** (`font-variant-numeric: tabular-nums`);
  - **no hay tipografía mono**, porque sería la 3.ª familia (X21);
  - tamaño **≥ 14 px**, y **≥ 16 px el dato de progreso**;
  - sin espaciado añadido y nunca como etiqueta decorativa.

  Así se resuelve el choque entre «UI secundaria en mono ≥ 11 px» (plan §6.1) y la prohibición de taste-skill: se queda la idea (el dato con voz propia) y se quita el disfraz.
- **K8 · Firma propia (no de KPR): el progreso como forma tipográfica.**
  - «T2 E5» y «te quedan 3» se componen como objeto gráfico, a escala de titular secundario, junto a la portada.
  - Es lo que hace reconocible a KULTURA aunque se tape el logo, y no está en KPR.
  - En los style tiles se prueba como forma, no como texto.

**Se descarta:** fondos blancos o claros; mono de 6–12 px; numeración índice (`01K`, `02P`); filetes de 1 px, crucetas y marcas de corte; cargador a pantalla completa; páginas de 18 pantallazos; el «lore» en inglés; tracking de −8 %.

### B.2 Immersive Garden — immersive-g.com
URL: https://immersive-g.com · consultada el 2026-11-07.
**Medido:**
- El documento mide **900 px**: el desplazamiento es virtual y secuestra la rueda.
- Hay **12 `canvas`**.
- Serifa PSTimes de 36–44 px sobre gris claro `#e8e8e8`.
- La navegación visible es **«Menu» y «See all projects»**, y cada pantalla es **una frase y un objeto en relieve**.

**Se toma:**
- **I1 · Una idea por pantallazo** en las pantallas de relato (portada y perfil público): **≤ 1 frase de ≤ 25 palabras**, a **≤ 36 px** (24 px a 390); el resto es imagen.
- **I2 · Continuidad espacial:** al pasar de escena, **la portada se transforma** (escala o posición) en la siguiente, sin corte ni fundido a negro. Es la interacción firma de la portada.
  - Técnica: **View Transitions API**, dentro del documento o entre rutas de Next.
  - Sin soporte o con reduced-motion: cambio sin animación, sin plan intermedio.
- **I3 · Navegación mínima en el relato:**
  - en la portada pública, **≤ 2 controles visibles** arriba (marca y «Entrar») y 1 acción principal;
  - no cuentan «Saltar al contenido» (solo visible con foco) ni el selector de idioma, que va en el pie.

**Se descarta:** el desplazamiento secuestrado, que rompe el teclado, el lector de pantalla, Ctrl+F y el botón de volver; la serifa; el fondo claro; el relieve sin material propio; tener 12 `canvas`, cuando el presupuesto es 1 y opcional.

### B.3 Dropbox Brand — brand.dropbox.com
URLs: https://brand.dropbox.com, `/framework`, `/typography` y `/motion` · consultadas el 2026-11-07, con las cookies no esenciales rechazadas.
**Medido:**
- Es una guía en la que **cada principio se demuestra en vivo**.
- Tiene tipografía variable propia, con el **peso ajustado al fondo claro u oscuro**.
- Cuatro principios de motion: simplicidad, comprensión, respuesta inmediata y juego sutil («a wink, rather than confetti»).
- La expresividad está escalonada según la superficie.

**Se toma:**
- **D1 · El sistema se demuestra:** `03_DESIGN_SYSTEM.md` (paso 5) enlaza a una página viva (artifact) donde cada token se ve funcionando.
- **D2 · Pesos fijos por rol, pensados para el oscuro:**
  - display: KulturaDisplay 800 (estático);
  - titular secundario y dato: Bricolage 500–600;
  - cuerpo: Bricolage **≥ 400**;
  - un peso más ligero solo en texto **≥ 24 px**.

  Los valores exactos se prueban en los style tiles sobre `#0a0a0a`.
- **D3 · Tres niveles de expresividad:**
  - **alto** (portada, perfil y lista públicos): profundidad, I2 y K4;
  - **medio** (Inicio y ficha de título): una interacción firma;
  - **bajo** (biblioteca, búsqueda y ajustes): solo respuesta al toque.

  Cada pantalla de F3 declara su nivel.
- **D4 · Guiño, no confeti:** completar una serie se celebra con **un solo gesto de ≤ 600 ms**, sin partículas. Es una **excepción declarada a M2**, porque ocurre pocas veces.

**Se descarta:** el fondo blanco, el azul corporativo, la ilustración y la tipografía aleatoria.

### B.4 Rijksmuseum — rijksmuseum.nl
URL: https://www.rijksmuseum.nl/en · consultada el 2026-11-07, con las cookies no esenciales rechazadas.
**Medido:**
- Logotipo SVG de **1.282 px sobre 1.440 de ancho (89 %)**, encima de *La ronda de noche* a sangre.
- Bloques fotográficos **a sangre, con esquinas rectas y sin separación**.
- Rótulo pequeño abajo a la izquierda, sobre la imagen. Fondo `#40474f`.

**Se toma:**
- **R1 · La obra entera:** en la ficha, la portada se ve **completa en 2:3**, sin recortar ni tapar; encima solo va el chaflán.
- **R2 · Rótulo de museo:** el pie de una portada son **título y año**, abajo a la izquierda y en ≤ 2 líneas.
- **R3 · El nombre a lo ancho, una vez:** el logotipo a **≥ 85 % del ancho** solo aparece en la portada pública y en el pie. Ninguna otra pantalla repite la composición de la portada.
- **R4 · Mosaico sin hueco:** cuando las portadas son material (no una lista de trabajo), van a sangre con **0–4 px** de separación, nunca en tarjetas con margen y sombra.

**Se descarta:** las mayúsculas sostenidas en los rótulos, la banda de entradas, el gris azulado y el menú denso.

### B.5 Bruno Simon — bruno-simon.com
URL: https://bruno-simon.com · consultada el 2026-11-07.
**Medido:**
- **7,3 MB en 114 recursos** y 1 `canvas`.
- **0 caracteres de texto en el DOM.**
- La carga es un anillo de neón sobre una rejilla de cruces, y toda la navegación es un juego.

**Se toma:**
- **B1 · Peso físico:** la portada protagonista se inclina **±6° con el puntero**, solo en dispositivos con `pointer: fine`, y vuelve con muelle (token `--spring`, M1).
  - **Sin giroscopio**: en iOS pide permiso y no aporta nada a la tarea.
  - **Con reduced-motion, no hay inclinación.**
  - Al arrastrar más allá de un límite hay resistencia elástica, no un tope seco.
- **B2 · Una sola cosa jugable: marcar visto.** Es el gesto que se repite cada noche.
  - Base: **un toque en el botón «Marcar visto»**, con anuncio `aria-live` («T2 E5 visto») y **«Deshacer»** durante 5 s.
  - Un gesto de arrastre puede añadirse, pero **nunca es la única vía** (WCAG 2.5.7).
  - Animación ≤ 200 ms, y ninguna desde el teclado (M3).

**Se descarta:** casi todo: los 7 MB (el presupuesto es 150 KB de JS inicial), la página sin texto (inaccesible y sin SEO), el neón, la rejilla de cruces y el juego como navegación.

### B.6 Movimiento (taste-skill, emil-design-eng y design-motion-principles)
Perfil: **app móvil + marketing**. Pesa primero Jakub (pulido); Emil en la biblioteca, la búsqueda y los formularios; Jhey solo en la portada.
- **M1 · Curvas y muelle:**
  - entrada y salida: `cubic-bezier(.2,0,0,1)`;
  - movimiento dentro de la pantalla: `cubic-bezier(.77,0,.175,1)`;
  - `--spring`: muelle con amortiguamiento crítico, sin rebote visible (B1);
  - **nunca `ease-in`**, y no hay más curvas.
- **M2 · Duraciones:**
  - pulsación: 100–160 ms (escala 0,97);
  - menús: 150–250 ms;
  - hojas y diálogos: 200–400 ms;
  - escenas de la portada: ≤ 900 ms;
  - **nada de interfaz > 300 ms**, salvo las excepciones declaradas (D4 y las escenas).
- **M3 · Frecuencia:** lo que se hace decenas de veces al día (marcar visto, cambiar de pestaña, buscar) dura ≤ 200 ms o no se anima. **Lo que se activa con el teclado no se anima.**
- **M4 · Solo `transform` y `opacity`.**
  - Con `prefers-reduced-motion`: sin desplazamiento, sin escala, sin inclinación (B1) y sin View Transitions; solo opacidad de ≤ 150 ms.
  - El contenido se ve entero.
- **M5 · WebGL es una capa:**
  - la pantalla existe y se entiende sin él (`engine.ts` es opcional);
  - con `hardwareConcurrency ≤ 4` o `saveData`, no se carga.
- **Deuda anotada para el paso 5:** la landing actual incumple M2 (`.kl-btn` con transiciones de color de 0,5 s, `landing.css:60`) y M1 (la entrada usa `cubic-bezier(.65,0,.35,1)`, `landing.css:84`).

### B.7 Base que los style tiles deben fijar (huecos señalados por la revisión)
Cada tile debe resolver estos puntos. El brief fija los límites, no los valores.
- **Paleta:**
  - **3 superficies** en escalones de luminancia (`#0a0a0a`, `#151515` y una tercera), porque **se separan por luminancia, no por filetes ni sombras** (X13 y X17);
  - tinta;
  - apagado **≥ 4,5:1** sobre las 3 superficies (`#a19d96` sobre `#0a0a0a` da ≈ 7:1);
  - acento (K5) y su reserva;
  - error y éxito, que no se distinguen solo por el color.
- **Retícula:**
  - **4 columnas a 390 y 12 a 1440**;
  - margen `clamp(16px, 2.2vw, 32px)` (hoy `--m`, `landing.css:19`);
  - medianil y ancho máximo, que se proponen en los tiles;
  - escala de espaciado con **base de 4 px**;
  - separación entre secciones de 120–240 px a 1440.
- **Imagen:**
  - póster en **2:3** y fondo en **16:9**, con cada tratamiento definido;
  - una única veladura permitida: neutra, desde abajo, con opacidad ≤ 0,78 (`landing.css:102`) y solo bajo texto;
  - **sin portada:** un bloque del color de reserva con el título compuesto en tipografía, nunca un icono genérico.
- **Carga (alternativa a X7):** espacio reservado estático del color dominante de la portada, con `aria-busy`, y respuesta visible en < 1 s con 4G lenta.

### B.8 Lo que dicen las otras skills (y qué se ignora)
- **ui-ux-pro-max:**
  - se adoptan sus prioridades 1–3: contraste de 4,5:1, objetivos ≥ 44 × 44 px con ≥ 8 px de separación, y espacio reservado contra el CLS;
  - su paleta para «Video Streaming/OTT» (`#0F0F23`, `#1E1B4B` y `#312E81`, índigos, más un rojo) **se rechaza por la anti-lista**;
  - su buscador en Python no corre aquí (no hay Python): se leyeron sus CSV a mano.
- **taste-skill:** se adoptan sus reglas de casa (K1–K8, §C y §D). La mono se sustituye por cifras tabulares (K7).
- **impeccable:** pide un `PRODUCT.md`. Aquí ese papel lo cumple §A, y no se crea otro archivo para no duplicar la fuente de verdad.

---

## §C · Anti-lista cerrada
Lo que aparezca de esta lista **no se enseña**. Base: plan §6.2 (no se quita nada) y lo que añaden las referencias y la revisión.

| # | Prohibido | Cómo se detecta |
|---|---|---|
| X1 | Modo claro o **cualquier sección de fondo neutro claro** (L OKLCH > 20 %). El campo de escena de K5 queda fuera | inspector: color de fondo por sección |
| X2 | Texto denso: **> 40 palabras visibles por pantallazo** en la portada, o un párrafo de > 3 líneas | recuento en la captura de 390 |
| X3 | Etiquetas innecesarias y rótulos sobre el titular (*eyebrows*, chips, «Nuevo ·») | revisión de la captura |
| X4 | Dinero en la portada (precio, «gratis», donar, apoyo) | `grep` en las claves de la portada |
| X5 | Neón, glow, cristal (`backdrop-filter` decorativo) y degradados, salvo la veladura de B.7 | `grep backdrop-filter\|gradient\|box-shadow` |
| X6 | Tarjetas redondeadas en rejilla por defecto; radios > 2 px fuera de K3 | `grep rounded-` en `src/v2/` |
| X7 | Esqueletos `animate-pulse` y cargadores a pantalla completa > 1 s (la alternativa está en B.7, «Carga») | `grep animate-pulse`; captura a 1 s con 4G lenta |
| X8 | Hero centrado con dos botones; la estructura «features / cómo funciona / FAQ» | revisión |
| X9 | Emojis en títulos o en la interfaz | `glossary.test.ts` |
| X10 | Ilustración o 3D generados sin material propio; iconos de librería en tarjetas | revisión y `grep` de imports |
| X11 | Morado o índigo (tono OKLCH 250–290°); paleta crema con terracota | inspector |
| X12 | Micro-copy de SaaS (la lista negra está en `docs/VOZ.md`) | `grep` en `messages` |
| X13 | Retículas, crucetas, marcas de corte y **filetes de 1 px** como separador | `grep "border.*1px"` en `src/v2/` |
| X14 | La composición de la portada repetida en otra pantalla (R3) | revisión |
| X15 | **Desplazamiento secuestrado** | prueba: Ctrl+F y Tab llegan a todo |
| X16 | **Numeración índice** (01 / 02, «Paso 2») y cualquier fuente mono fuera de bloques de código | inspector: familias cargadas |
| X17 | **Sombras en reposo**; solo flota lo que flota (menú, diálogo, hoja) | `grep box-shadow` |
| X18 | **Eco del texto del usuario** en titulares o rótulos («Resultados para "…"»). El campo sí conserva lo escrito: las condiciones están en `docs/VOZ.md` | revisión de búsqueda y formularios |
| X19 | Palabra destacada con otro estilo dentro del titular | revisión |
| X20 | IA en la portada (plan §5.2.8) y cifras sin fuente (CLAUDE.md, regla 7) | `grep` en la portada |
| X21 | **> 2 familias tipográficas.** Hoy son Bricolage (con KulturaDisplay, que es un corte suyo) y Figtree; el paso 5 decide si Figtree sale | inspector: fuentes cargadas |

---

## §D · Rúbrica cerrada
**Escala de 1 a 5** por criterio.
- **Para pasar:** el **criterio 7 es una puerta** (si no llega a 4, la pieza no pasa) y, además, media ≥ 4 sin ningún 1 o 2.
- **En los style tiles (paso 4)** solo puntúan los criterios **1–4**, cada uno ≥ 4.
- **Quién puntúa:** Víctor y un subagente que no produjo la pieza. Si difieren en ≥ 2 puntos, vale la nota más baja hasta que se discuta por escrito. Se registra en `04_DECISIONES` §4.

| # | Criterio | 1 (no pasa) | 3 (correcto) | 5 (lo buscado) | Cómo se mide |
|---|---|---|---|---|---|
| 1 | **Carácter** | tapando el logo, podría ser cualquier tracker o **confundirse con KPR** | se intuye, pero solo por el color | tapando el logo se reconoce por la firma propia (K8) junto con K1, K3 y K4 | captura con el logo tapado, junto a 2 de la competencia **y una de kprverse**; si se confunde con KPR, es un 2 |
| 2 | **Fidelidad al brief** | ≥ 2 puntos de §C | 1 punto menor de §C, o falla una regla de §B | 0 de §C y cumple las reglas de §B que le aplican | X1–X21 marcadas y reglas citadas |
| 3 | **Portadas como material** | portadas pequeñas en tarjetas, o ninguna | presentes, pero en segundo plano | ≥ 40 % del primer pantallazo (K6), entera donde toca (R1) y, en la portada y el perfil, el pack visible con ≥ 1 portada por formato (P1 y P2) | área medida a 1440 y a 390; recuento por formato |
| 4 | **Legibilidad móvil** | a 390 hay desbordamiento, o el **cuerpo** < 16 px | se lee, pero la jerarquía tarda | en 3 s se sabe qué es y qué tocar, y la acción queda en el tercio inferior | captura de 390, enseñada 3 s a alguien |
| 5 | **Profundidad y movimiento con propósito** | movimiento decorativo o por todas partes | correcto, pero sin interacción firma | 1 interacción firma por pantalla (I2 o B2), y solo curvas y duraciones de M1–M3 | vídeo o lista de animaciones con su curva |
| 6 | **Sin WebGL ni animación** | sin WebGL se rompe, o > 150 KB de JS | funciona, pero queda pobre | sin WebGL y con reduced-motion se ve completa, en ≤ 150 KB | captura sin WebGL y con reduced-motion; build |
| 7 | **Accesibilidad (puerta)** | axe serious/critical, o foco invisible | AA, con fallos menores | WCAG 2.2 AA completo (abajo) y tokens preparados para `prefers-contrast: more` | axe a 390 y 1440, más la lista de abajo |
| 8 | **Voz** | texto de SaaS, o > 40 palabras por pantallazo | correcto, pero sobran palabras | cumple `docs/VOZ.md` y no se puede quitar ninguna palabra | recuento y lista negra |
| 9 | **Coherencia de sistema** | valores sueltos | casi todo con tokens | solo tokens y componentes de `03_DESIGN_SYSTEM` | `grep` de literales (desde el paso 5) |
| 10 | **Viabilidad** | exige otra librería o rompe el presupuesto | viable, con deuda | viable en Next.js 15 con lo que ya hay | estimación con rutas de archivo |

**Lista del criterio 7:**
- contraste de 4,5:1 en texto y 3:1 en controles (1.4.3 y 1.4.11);
- foco visible y no tapado por barras fijas (2.4.7 y 2.4.11);
- objetivos ≥ 44 px;
- zoom al 200 % y reflujo a 320 px sin pérdida (1.4.4 y 1.4.10);
- espaciado de texto ampliado sin cortes (1.4.12);
- mensajes de estado con `aria-live` (4.1.3);
- alternativa de un toque a todo arrastre (2.5.7);
- reduced-motion (M4);
- lector de pantalla probado con **VoiceOver en iOS y NVDA**.

---

## §E · Lo que decide Víctor (puerta de F2, pasos 1–3)
1. ~~**Titular**~~: **hecho**, el 2 (D-F2a).
2. **Personalidad:** sí o cambios a §A.2.
3. **§B, §C y §D:** sí, o qué regla cambia y por qué.

Con el «sí» escrito, la sesión siguiente hace el paso 4: **3 style tiles** (logotipo, paleta, tipografía, forma y un fragmento de pantalla) en HTML. Se prueban a 390 y 1440, sin WebGL y con reduced-motion, y cada uno resuelve B.7.
