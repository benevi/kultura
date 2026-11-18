# Prototipo 3D de la ficha · borrador para `docs/spikes/3d-ficha.md`

Fase 8.3, puerta **P-3D** (`PLAN_FASE8.md` §3 y §7). Rama desechable `proto/fase8-3-direcciones`. 18-11-2026.
Redacta el agente de movimiento y 3D; **decide Víctor** probándolo en su móvil y su ordenador. **[P]** = pendiente de Víctor.

## Cómo probarlo

Sobre la dirección A «Sala». En la sala hay un selector **2D · 3D capas · 3D fondo** (cambia la URL).

| Qué | URL (`/es/proto/ficha/a/…`) |
|---|---|
| Sala con mapa (lo recomendado) | `movie/496243?3d=fondo` (Parásitos) · `game/274755?3d=fondo` (Hades) |
| Sala sin mapa | `movie/496243?3d=capas` · `game/274755?3d=capas` |
| Pieza (portada como objeto) | `book/OL20150260W?3d=capas` · `manga/801513ba-a712-498c-8f57-cae55b38cc92?3d=capas` · `anime/al-199?3d=capas` |
| Contador en pantalla | añadir `&fps=1` (FPS medio, p95 del fotograma, fotogramas largos > 32 ms, CPU por fotograma, DPR, MB de texturas, GPU) |
| Para medir sin mover el ratón | añadir `&loop=1` (deriva automática) |

En móvil, el botón «Mover con el móvil» pide el giroscopio (solo tras pulsarlo; en iOS sale el permiso del sistema). Nunca hace falta.

## Qué se construyó

Una capa 3D que se pone **encima** de la sala 2D, en un solo `<canvas aria-hidden>`:

- **Sala** (imagen apaisada: película, serie, videojuego). La imagen con profundidad y nuestro título pintado **entre** el fondo y lo que queda delante, con una sombra suave del título sobre el fondo (no sobre lo que lo tapa). El título del lienzo es adorno; el `h1` real sigue en el HTML, en el árbol de accesibilidad y seleccionable (solo se apaga su tinta cuando el lienzo ya lo ha pintado).
- **Pieza** (libro, manga, cómic, anime). La portada como objeto con grosor: cubierta, lomo (que sale de la propia portada), canto de páginas, sombra de contacto y un brillo que cruza la cubierta. Gira con el puntero, con el scroll o con el giroscopio. En manga el lomo va a la derecha.
- `?fps=1`, pausa fuera de pantalla y con la pestaña oculta, densidad limitada y rebajada sola si el fotograma no llega, recuperación de pérdida de contexto, liberación al desmontar.

Archivos: `src/app/[locale]/proto/ficha/_dirs/a/sala3d/engine.ts` (motor), `sala3d/depth.ts` (mapas del prototipo), `Stage.tsx` (montaje diferido, selector, contador), `a.css`; `scripts/proto-depth/build.py` (cómo se generan los mapas); `public/proto/depth/` (los mapas).

## Técnica y por qué

**WebGL a pelo, sin dependencias**, como el motor de la landing. Motivo: el peso.

| | Minificado | gzip |
|---|---|---|
| Motor 3D (trozo aparte, se pide con `import()` solo si hay 3D) | 19,6 KB | **8,5 KB** |
| Lo que crece `Stage` (siempre cargado: montaje, selector y contador del prototipo) | +4,2 KB | **+1,7 KB** |
| Mapas por obra en `fondo` (dos JPEG en gris) | — | 43–59 KB |

Medido con esbuild sobre los archivos de la rama (no con el build de Next). three.js no se ha medido aquí; su núcleo ronda diez veces o más ese peso y no aporta nada a una escena que es un rectángulo con un sombreador y una caja de seis caras.

Un solo lienzo y un solo contexto (la landing usa dos lienzos con el nombre en DOM entre ambos). Ventajas de pintar el título dentro: el corte es por píxel y con borde suavizado, el título se mueve con su plano sin desfase respecto a la imagen, y hay sombra con oclusión correcta.

Mejoras de acabado respecto a la landing y al fundido 2D de A:

- **Borde del corte**: ancho constante de ~1,5 px de pantalla (derivadas de pantalla, `OES_standard_derivatives`) leyendo la máscara en 5 puntos: sin borrón y sin los bloques del 2D (comparar `detalle-hades-2d.png` y `detalle-hades-fondo.png`). No es perfecto: ampliado ×2 se ven escalones pequeños en el contorno, porque la máscara mide 1280 px y es un JPEG; una máscara mayor o sin pérdida los quitaría (queda por hacer). Sin esa extensión cae a un borde fijo.
- **Máscara propia para el corte**, distinta del mapa del parallax. El parallax usa la profundidad dilatada y suavizada (como la landing: no rasga siluetas). El corte usa la profundidad sin dilatar, calculada al doble de resolución, sin el suelo (a cada fila se le resta su nivel de fondo) y con una curva en S: el umbral cae en el contorno de la figura. La landing usa un solo mapa dilatado para las dos cosas, y por eso su recorte lleva halo.
- **Sin salto al encenderse**: el primer fotograma es la misma composición que el 2D (mismo encuadre, mismo velo) y el lienzo entra con un fundido de 0,45 s; después la imagen «despierta» (un 3,5 % de acercamiento en 1,1 s). Comprobado comparando 2D y 3D quietos: misma posición y escala; las diferencias son de remuestreo en líneas finas.
- **Grano fijo** de ±1,5/255 para que el velo no haga bandas.

## Las reglas del título (las del 2D, medidas en el 3D)

El motor elige el umbral del corte con el título ya colocado, a cada ancho:

1. Tapado ≤ 22 % de los píxeles de letra, en el título y en cada línea (se busca el 18 %).
2. Ninguna letra tapada más del 62 % (45 % sin mapa). Regla nueva mía: una letra que desaparece cambia la palabra.
3. Lo tapado no cruza más del 36 % del ancho de una línea (una franja de suelo que tacha media palabra no es una figura por delante).
4. Si lo tapado queda por debajo del 7 %, se ve como un mordisco: el título va entero por delante.
5. Si el título no cabe entero dentro de la imagen (móvil: va a caballo del borde inferior), va entero por delante. La landing hace lo mismo en móvil.

Medido píxel a píxel con Playwright (el motor tiene un modo de depuración que pinta el título sin tapar y sin título), en reposo y con el puntero en dos esquinas, tema oscuro:

| Obra · vía · ancho | Tapado medido | Contraste mínimo de la letra visible | Letra por debajo de 3:1 |
|---|---|---|---|
| Parásitos · fondo · 1440 | 14,8–15,1 % | 3,78 | 0 % |
| Parásitos · fondo · 1024 | 7,5–7,7 % | 3,89 | 0 % |
| Hades · fondo · 1440 | 16,1–16,2 % | 5,34 | 0 % |
| Hades · fondo · 1024 | 14,3 % | 5,63 | 0 % |
| Parásitos y Hades · fondo · 375 | 0 % (regla 5) | 4,55 / 3,68 | 0 % |
| Parásitos y Hades · capas · 1440, 1024 y 375 | 0 % (ningún corte cumple las reglas) | 3,73 / 3,64 | 0 % |

El `h1` no está oculto y el lienzo lleva `aria-hidden="true"` en todos los casos. No se midió en tema claro (la sala no cambia con el tema) ni con `en`.

## Las dos vías, comparadas

| | `capas` (sin mapa) | `fondo` (con mapa) |
|---|---|---|
| De dónde sale la profundidad | De la imagen ya cargada: lo que se aparta del color de fondo | Mapa de profundidad calculado antes, en local |
| Parallax | Dos planos rígidos (imagen y título) que se mueven entre sí | Dentro de la imagen: lo cercano se mueve más que lo lejano |
| Título entre capas | En las obras de prueba, **nunca** con las reglas de arriba: las formas que salen del color (un cartón en el suelo, unas estalactitas) no son figuras y tachan letras. Con las reglas más flojas salía, y se veía arbitrario | **Sí en escritorio**: el brazo del hijo pasa por delante de la «P» de Parásitos; Zagreo, por delante de la «d» de Hades. El contorno sigue a la figura |
| En móvil | Planos, sin corte | Parallax interior, sin corte (regla 5) |
| Pieza | Igual en las dos: la portada como objeto. El relieve dentro de la cubierta no se activa (la portada lleva su rótulo impreso; un parallax interior lo deformaría) | |
| Coste por obra | Nada | Dos JPEG (43–59 KB) y un proceso que los calcule |
| Peso de JS | El mismo motor | El mismo motor |
| Tiempo de `import()` a primer fotograma | 0,3–0,7 s (calcula la máscara en ratos libres) | 0,2–0,3 s |
| Memoria de texturas a 1440 (DPR 1 / 2) | 7,2 MB / — | 11,4 MB / 24 MB |

**Recomendación: `fondo` para la Sala y el objeto para la Pieza.** `capas` no da lo que Víctor pide (figuras por delante de las letras) más que por casualidad; sirve como respaldo cuando una obra no tiene mapa: planos con parallax y el título limpio. Lo que hay que saber antes de decir que sí:

- El efecto «entre capas» depende de la imagen. De las dos salas de prueba sale en las dos a escritorio; en móvil, en ninguna (por composición: el título pisa el borde de la imagen). **[P]** Si en móvil se quiere el corte, hay que cambiar la composición móvil de A (título dentro de la imagen), y eso es diseño, no 3D.
- En Hades, la «d» queda tapada en torno al 60 %. Cumple el 22 % del título, pero es una letra casi oculta. **[P]** ¿Vale ese tope por letra?
- Chihiro ya no es Sala (regla de calidad de imagen): es Pieza.

## Medidas

**Equipo**: Windows 11, NVIDIA GeForce GTX 1070 (ANGLE, Direct3D 11), Chromium 147 de Playwright sin ventana, contra `next dev` (no es el build de producción). «375» es ese mismo equipo con ventana de móvil emulada (DPR 2): **no es un móvil**. 5 s con deriva automática (`loop=1`), 300 fotogramas por caso.

| Caso | FPS | p95 del fotograma | Fotogramas > 32 ms | CPU por fotograma | Con CPU ×4 |
|---|---|---|---|---|---|
| Sala `capas` y `fondo`, 1440 (DPR 1) | 60 | 16,7–16,8 ms | 0 / 300 | 0,07–0,15 ms | 60 fps, 0 largos, 0,6–0,7 ms |
| Sala `capas` y `fondo`, 375 (DPR 2) | 60 | 16,7–16,8 ms | 0 / 300 | 0,07–0,08 ms | 60 fps, 0 largos, 0,6–0,7 ms |
| Sala `fondo`, 1440 a DPR 2 | 60 | 16,7–16,8 ms | 1 / 400 | 0,09–0,14 ms | 60 fps, 1 largo, 0,7–0,8 ms |
| Pieza, 1440 y 375 (tres obras) | 60 | 16,7–16,8 ms | 0 / 300 | 0,07–0,10 ms | 60 fps, 0 largos, 0,8–1,2 ms |

El fotograma va sobrado en esta GPU; la medida que decide P-3D es la del móvil de Víctor, con `?fps=1`.

**Tiempo hasta que aparece el 3D** (en `next dev`): la capa espera a `load`, a un rato libre y a que acaben las entradas de la sala (0,9 s). Desde `load` hasta el primer fotograma: Sala `fondo` 0,6–0,9 s, Sala `capas` 1,0–1,3 s, Pieza 0,03–0,7 s.

**LCP con y sin 3D** (mediana de 3 cargas, ms, en `next dev`, con mucha variación entre cargas):

| Obra | 1440: 2D / 3D | 375: 2D / 3D |
|---|---|---|
| Parásitos | 1056 / 712 | 920 / 904 |
| Hades | 1644 / 1456 | 1888 / 1544 |
| Gente normal | 1460 / 1484 | 3140 / 2960 |
| Berserk | 1360 / 956 | 864 / 596 |
| Chihiro | 1684 / 1288 | 768 / 680 |

No hay diferencia atribuible al 3D (se monta después del LCP). El elemento LCP es el `<img>` de la sala; en Pieza a 1440 es el texto del título, que es mayor que la portada. Ojo: con la regla de calidad, Parásitos pide ahora el original de TMDB (523 KB frente a 149 KB de `w1280`) y Hades el de RAWG (360 KB frente a 165 KB): eso sí pesa en el LCP en una red lenta y no se ha medido con red limitada.

**Memoria de texturas** (RGBA sin comprimir, aproximada): Sala `fondo` 11,4–12,1 MB a DPR 1–2 de móvil, 24 MB a 1440 con DPR 2; Sala `capas` 7,2–8 MB; Pieza 0,6–4,1 MB. La textura de la imagen se limita a lo que el lienzo enseña (tope 4096 px de lado).

### Tamaño natural frente a tamaño en pantalla (regla de calidad)

| Obra | Pantalla | Modo | Archivo pintado (px) | Tamaño en pantalla (px CSS) | Ampliación en px CSS | En px de pantalla |
|---|---|---|---|---|---|---|
| Parásitos | 1440 @1× | Sala | 2732 × 1536 (TMDB original) | 1515 × 852 | 0,55 | 0,55 |
| Parásitos | 1440 @2× | Sala | 2732 × 1536 | 1515 × 852 | 0,55 | 1,11 |
| Parásitos | 375 @3× | Sala | 2732 × 1536 | 834 × 469 | 0,31 | 0,92 |
| Hades | 1440 @1× | Sala | 2580 × 1450 (RAWG original) | 1516 × 852 | 0,59 | 0,59 |
| Hades | 1440 @2× | Sala | 2580 × 1450 | 1516 × 852 | 0,59 | 1,18 |
| Hades | 375 @3× | Sala | 2580 × 1450 | 834 × 469 | 0,32 | 0,97 |
| Gente normal | 1440 @1× | Pieza | 331 × 500 (Open Library `-L`) | 331 × 500 | 1,00 | 1,00 |
| Gente normal | 1440 @2× | Pieza | 331 × 500 | 331 × 500 | 1,00 | **2,00** |
| Gente normal | 375 @3× | Pieza | 331 × 500 | 254 × 383 | 0,77 | **2,30** |
| Berserk | 1440 @1× | Pieza | 1200 × 1706 (original de MangaDex por el optimizador) | 397 × 565 | 0,33 | 0,33 |
| Berserk | 1440 @2× | Pieza | 1200 × 1706 | 397 × 565 | 0,33 | 0,66 |
| Berserk | 375 @3× | Pieza | 1200 × 1706 | 254 × 361 | 0,21 | 0,63 |
| Chihiro | 1440 @1× | Pieza | 460 × 656 (AniList `large`) | 412 × 587 | 0,89 | 0,89 |
| Chihiro | 1440 @2× | Pieza | 460 × 656 | 412 × 587 | 0,89 | **1,79** |
| Chihiro | 375 @3× | Pieza | 460 × 656 | 254 × 362 | 0,55 | **1,66** |

Ninguna imagen se amplía en px CSS. **[P]** En px de pantalla, la portada de Open Library y la de AniList se quedan cortas con DPR 2–3 porque el proveedor no da una mayor; cumplir 1,25× también ahí obligaría a pintarlas mucho más pequeñas (unos 200 px CSS de ancho). He tomado la regla en px CSS, que es como se midió el «×2» del banner de Chihiro; si Víctor la quiere en px de pantalla, hay que decidir entre portada pequeña o portada blanda.

Marco del tráiler: Parásitos usa la segunda imagen sin rótulo de TMDB (distinta de la de la sala); Chihiro no tiene segunda imagen y el marco va sin imagen, con el color de la obra. Las otras tres obras no tienen tráiler.

## Respaldos comprobados

Todos con Playwright; en todos la ficha conserva texto, enlaces y botones.

| Caso | Cómo se probó | Resultado |
|---|---|---|
| GPU por software | Chromium sin GPU (SwiftShader) | No se monta; se queda el 2D. Aviso «3D no disponible» (solo en el prototipo) |
| Sin WebGL | `--disable-3d-apis` | Igual |
| El mapa no llega | Se bloquea `/proto/depth/` | Igual |
| La imagen no se puede subir a la GPU | `texImage2D` forzado a fallar | Igual |
| Sin JS | Contexto sin JavaScript | El HTML del servidor: `h1` e imagen, sin lienzo |
| Movimiento reducido (sistema) | `prefers-reduced-motion: reduce` | Sala: composición quieta, 0 píxeles cambian al mover el puntero, 0 animaciones. Pieza: no se monta (2D) |
| Interruptor «Movimiento» | Apagarlo con el bucle en marcha | 0 fotogramas después |
| Pestaña oculta | `visibilitychange` simulado | 0 fotogramas mientras está oculta; se reanuda al volver |
| Sala fuera de pantalla | Scroll hasta abajo | 0 fotogramas; se reanuda al volver |
| En reposo con ratón | 2 s sin tocar nada | 0 fotogramas |
| Pérdida de contexto | `WEBGL_lose_context` | El lienzo se retira y el `h1` recupera su tinta; al restaurarse, vuelve el 3D |
| Contraste alto / colores forzados | `prefers-contrast: more` | No se monta: manda el texto real |
| Desmontar (3D → 2D) | Selector | Se retira el lienzo y se libera el contexto |

WCAG 2.2.2: la única deriva automática es en pantalla táctil sin giroscopio (y con `loop=1`); se para con el interruptor «Movimiento» de la barra y con movimiento reducido. WCAG 2.3.1: no hay destellos (el brillo de la pieza es una banda del 11 % que se mueve con el giro).

## Qué NO se ha verificado

- **Ningún dispositivo real**: ni móvil (iOS o Android) ni el ordenador de Víctor. Es justo lo que pide P-3D.
- **El giroscopio**: escrito, sin probar (necesita un móvil y, en iOS, HTTPS).
- Safari y Firefox. Build de producción. Red lenta. GPU integrada o móvil de gama baja (el ×4 de CPU no ralentiza la GPU).
- Pantallas de más de 1600 px de ancho (el tope de 1,25× está en el CSS, sin captura).
- Lector de pantalla real (se comprobó el árbol: `h1` presente, lienzo oculto).
- Tema claro y `en` en las medidas del título; títulos en escritura no latina dentro del lienzo.
- El relieve dentro de la cubierta de la Pieza: está apagado por criterio, no por una prueba a fondo.

## Riesgos

1. **El corte depende de cada imagen.** Con otra obra puede no salir (título entero por delante) o salir raro. Las reglas lo frenan, pero solo hay dos salas probadas. Antes de producción: una tanda de 30–50 obras reales mirada a ojo.
2. **Móvil sin «entre capas»** con la composición actual de A.
3. **Mapas = uso nuevo de las imágenes de los proveedores** (derivado guardado en nuestro almacenamiento). Víctor levantó el bloqueo el 18-11-2026; sigue siendo un riesgo de términos (varios proveedores prohíben derivados), igual que las imágenes OG.
4. **Licencia del modelo.** Depth Anything V2 **Small** es Apache-2.0 (es el que usa el prototipo). La variante **Base** que usa hoy la landing es CC-BY-NC-4.0 (no comercial). **[P]** Conviene pasar la landing a Small.
5. **Peso de imagen**: los originales de TMDB y RAWG en la sala (regla de calidad) suben el LCP en redes lentas.
6. **Memoria** en móviles modestos con DPR 3: hasta ~12 MB de texturas por sala (medido con DPR 2 emulado).
7. La máscara de letra del lienzo necesita la fuente variable registrada otra vez con su anchura; si falla, el 3D de la Sala no se monta (se queda el 2D). Comprobado solo en Chromium.

## Qué haría falta para llevarlo a producción

**De dónde salen los mapas para cualquier obra.** Tres caminos:

| | Cómo | Coste | Pega |
|---|---|---|---|
| A. Tarea en GitHub Actions (recomendado) | Como `landing-media.yml`: una tarea que calcula los mapas de las obras que lo piden (las más vistas, o las que alguien abre: la ficha apunta la obra en una cola y sale en 2D hasta que el mapa existe) y los sube al almacenamiento de Supabase | 0 € (repo público). En este equipo, 5 imágenes en 17 s en CPU, con la carga del modelo incluida | No es inmediato: la primera visita va sin mapa |
| B. En el navegador | El modelo en WebGPU/WASM | 0 € | Decenas de MB de descarga y segundos de cálculo por obra en el dispositivo del usuario: contra el principio 4 |
| C. Función de servidor | — | — | El modelo no cabe en una función de Vercel |

Con A: tabla nueva (p. ej. `media_depth`: obra, rutas, tamaño, versión del modelo), con las reglas de `CLAUDE.md` (expandir → usar; bandera en `docs/banderas.json`). Almacenamiento: 43–59 KB por sala hoy; bajando la máscara a 960 px, unos 30 KB → 10 000 salas ≈ 300 MB (el plan gratuito de Supabase da 1 GB, y la landing ya usa parte). Solo las obras en modo Sala necesitan mapa. Retirada: si un proveedor lo pide, se borran sus mapas (encaja con `provider_art_policy`).

**Resto de trabajo**: pasar al cargador real las imágenes sin rótulo de TMDB (`/images`) con revisión legal; título localizado (hueco de datos ya anotado en `DIRECCIONES.md`); tests (unitario del umbral con mapas sintéticos, Playwright de respaldos); presupuesto de CI para el trozo del motor; quitar selector, contador y `window.__kp3d`; decidir si el corte se calcula en servidor (el umbral depende del ancho: hoy se calcula en el navegador en pocos ms).

**Texto para `/privacy`** (borrador; se enseña a Víctor antes de fusionar, como todo texto legal):

> **Imágenes con profundidad.** En la ficha de algunas obras, la imagen se mueve ligeramente con el puntero o con el móvil. Para eso guardamos en nuestro almacenamiento (Supabase) dos imágenes en escala de grises calculadas a partir de la imagen oficial de la obra (un «mapa de profundidad»). No contienen ningún dato tuyo ni se calculan en tu dispositivo. El efecto se dibuja en tu navegador; si activas «Mover con el móvil», la orientación del dispositivo se usa solo en ese momento y en tu navegador: no se envía ni se guarda. Con «reducir movimiento» la imagen queda quieta.

Y revisar la frase de #173 sobre las portadas: las imágenes de la sala se piden directamente al proveedor (TMDB, RAWG) a su tamaño original.

## Veredicto que propongo (lo firma Víctor al probarlo)

- **Técnica: pasa.** Pesa 8,5 KB, no retrasa la página, se cae limpio a 2D y va a 60 fps en el equipo de pruebas.
- **Diseño: pasa en escritorio con `fondo`**; en móvil se queda en parallax y objeto, sin letras entre capas.
- **Pendiente para cerrar P-3D**: la prueba de Víctor en su móvil y su ordenador con `?fps=1` (¿60 fps estables, sin tirones al hacer scroll?), y sus respuestas a los **[P]** de arriba.

Capturas: `docs/proto/fase8-3/capturas/3d/` (`3d-fondo-*`, `3d-capas-*`, `3d-pieza-*`, `detalle-*` con el corte ampliado en 2D, capas y fondo, `respaldo-*`).
