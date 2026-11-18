# Prototipo 3D de la ficha · veredicto de la puerta P-3D

Fase 8.3 (`PLAN_FASE8.md` §3 y §7). Prototipo sobre la dirección «Sala» ([`../design/BIBLIA.md`](../design/BIBLIA.md)), en la rama desechable `proto/fase8-3-direcciones` (commit `895271e3`), que no se fusiona.

## Veredicto

**P-3D pasada el 18-11-2026. El 3D de la ficha entra en el plan (fase 8.5).**

- **Quién decide y cómo:** Víctor, probándolo en su móvil (vista previa HTTPS de Vercel, con giroscopio) y en su ordenador. Sus palabras: «sí al 3D, va fluido». Tras la tercera ronda: «Ahora está muy bien».
- **Cuadra con la dirección:** sí; es la misma sala con profundidad, y sin 3D queda la misma composición en 2D.
- **Lo que no hay:** cifras de FPS tomadas en sus dispositivos. La fluidez en ellos es su juicio a ojo. Las medidas de este documento son del equipo de pruebas (GTX 1070, Chromium).
- **Vía elegida:** sala con mapas precalculados (`?3d=fondo`): máscara de primer plano y mapa de profundidad. La vía sin mapas (`?3d=capas`) queda para la pieza de libro, manga y cómic.

### Decisiones tomadas

| Asunto | Decisión |
|---|---|
| Letras: cada una entera por detrás o por delante de la figura | Sí (firmado en la biblia, §3) |
| Título dentro de la imagen en móvil | Sí (biblia, §3) |
| Giroscopio | Sí, tras pulsar «Mover con el móvil»; recorrido de la tercera ronda |
| Superresolución por IA | No |
| Portadas pequeñas | A su tamaño; tope de ampliación 1,25× (biblia, §2) |
| Obra de cine, juego o anime sin imagen apaisada | Su imagen vertical se redimensiona para llenar la sala (biblia, §2). **Sin construir ni probar en el prototipo** |
| Fondo de la pieza (variante 1 o 2) | Sin decidir: a la 8.5 |
| Atribución doble (AniList + TMDB) en un anime con sala | A la revisión de términos, antes de producción |
| 404 de la ficha cuando el proveedor tarda | Es del cargador de la app: tarea aparte |

Lo que sigue es el informe del prototipo, por rondas.

## Cómo probarlo

En la rama del prototipo, con el servidor de desarrollo o su vista previa de Vercel.

Sobre la dirección A «Sala». En la sala hay un selector **2D · 3D capas · 3D fondo** (cambia la URL).

| Qué | URL (`/es/proto/ficha/a/…`) |
|---|---|
| Sala con mapas (lo recomendado) | `movie/496243?3d=fondo` (Parásitos) · `game/274755?3d=fondo` (Hades) · `anime/al-199?3d=fondo` (Chihiro) |
| Sala sin mapas | las mismas con `?3d=capas` |
| Pieza (portada como objeto) | `book/OL20150260W?3d=capas` · `manga/801513ba-a712-498c-8f57-cae55b38cc92?3d=capas` |
| Fondo de la Pieza, variante 2 | añadir `&campo=2` (vale también sin 3D) |
| Contador en pantalla | añadir `&fps=1` (FPS medio, p95 del fotograma, fotogramas largos > 32 ms, CPU por fotograma, DPR, MB de texturas, GPU) |
| Para medir sin mover el ratón | añadir `&loop=1` (deriva automática) |

En móvil, el botón **«Mover con el móvil»** activa el giroscopio (ver más abajo qué hace falta).

## Qué cambió en la segunda ronda

| Lo que pidió Víctor | Qué era | Qué se hizo | Medida de después |
|---|---|---|---|
| 1. Letras fundidas con mejor acabado, también en móvil | El corte salía de umbralizar un mapa de profundidad JPEG: borde deshilachado y, dentro de las figuras, un corte arbitrario | Máscara de **primer plano** de verdad (segmentación, sin pérdida, a 2048 px). Todo borde visible es el contorno de la figura. Cada letra va entera por detrás o entera por delante. En móvil el título va dentro de la imagen | 24 casos: tapado ≤ 14,3 %, letra peor ≤ 36 %, contraste ≥ 3,48, 0 % de letra bajo 3:1 |
| 2. Las imágenes cargan siempre | Tres cosas distintas (abajo): MangaDex cortaba la conexión, RAWG tardaba y la ficha salía 404, y el velo se calculaba a veces con la imagen a medio cambiar | Tamaño razonable primero y el grande después, en serie; reintentos y respaldo a un tamaño menor; campo de color mientras tanto; segundo intento de datos | 10 cargas en frío por obra y ancho (100): 100/100 con imagen, 0 fallos de red |
| 3. Imágenes que llenen la pantalla sin pixelar | Chihiro (banner de 1900 × 400) había caído a Pieza; las portadas pequeñas no llenaban | Anime por TMDB: Chihiro vuelve a tener sala (3830 × 2154). Pieza: portada a su tamaño y fondo a sangre hecho con su paleta, dos variantes | Ninguna imagen ampliada en px CSS (tabla) |
| 4. «Dónde ver» ocupa demasiado en móvil | Tres bloques con logotipo y nombre debajo | Una fila deslizable por grupo, logotipos de 44 px | Parásitos a 375: 262 px de alto con 10 servicios, sin desborde |
| 5. Que el 3D se mueva al mover el móvil | Estaba escrito sin probar | Terminado: permiso en iOS, zona muerta, recentrado, límite, respaldo | Probado con eventos sintéticos (abajo); falta un móvil real con HTTPS |

## 1. Letras fundidas: cómo queda

**Qué se construyó.** Un solo `<canvas aria-hidden>` encima de la sala 2D (WebGL a pelo, sin dependencias). En **Sala**: la imagen con parallax, el velo, y nuestro título pintado **entre** el fondo y lo que está en primer plano, con su sombra sobre el fondo. El `h1` real sigue en el HTML, en el árbol de accesibilidad y seleccionable. En **Pieza**: la portada como objeto con grosor (lomo, canto de páginas, sombra, brillo) que gira.

**De dónde sale ahora el corte** (`scripts/proto-depth/build.py`, en local):

| Archivo | Qué es | Modelo y licencia |
|---|---|---|
| `<obra>.m.png` | **Máscara de primer plano**: figura frente a fondo. PNG sin pérdida, 2048 px de ancho, 39–51 KB | BiRefNet «general-lite» (**MIT**), vía `rembg` 2.0.67 (**MIT**) y `onnxruntime` (MIT). Pesos: 224 MB, de las publicaciones de GitHub de `rembg`. No se usa RMBG de BRIA (no comercial) |
| `<obra>.d.jpg` | Profundidad, **solo para el parallax** (ya no decide el corte). 640 px, 10–12 KB | Depth Anything V2 **Small** (**Apache-2.0**) |

Limpieza de la máscara, antes de guardarla: fuera las zonas dudosas (componentes con alfa media baja o con mucha zona «a medias»), fuera las islas de menos del 0,4 % de la imagen, huecos pequeños cerrados, contorno suavizado y ajustado a la imagen con un filtro guiado corto. Queda un alfa de 2–3 px, sin halo. En el sombreador la máscara se lee en 5 puntos y se compone premultiplicada.

**Por qué cada letra va entera por detrás o entera por delante.** Con una figura de verdad delante de un título enorme, una letra queda tapada casi entera (la «d» de Hades, al 94 %). Probé tres salidas y descarté dos:

1. Dejar pasar solo la parte de la figura más cercana (compuerta por profundidad, borde nítido): el corte dentro de la figura sale a escalones (la profundidad es un JPEG de 8 bits). Descartado.
2. La misma compuerta con transición suave: la letra se ve a través de la figura, como un velo. Descartado.
3. **Lo que queda**: una letra que quedaría tapada más del 35 % va **entera por delante** de la figura; las demás, por detrás. Si aun así el título o una línea pasan del 18 %, se sacan las letras más tapadas. El corte nunca cae dentro de una figura. Es el recurso clásico de entrelazar rótulo y sujeto.

Resultado a 1440: en Hades, Zagreo pasa por detrás de la «d» y por delante de la «a» y la «e», y las borlas del templo cruzan la «H» y la «s»; en Parásitos, las manos y las rodillas cruzan «á», «s», «i», «t», «o»; en Chihiro, las piernas de Chihiro cruzan «je de». Es un criterio de diseño: la misma figura queda delante de unas letras y detrás de otras. Aceptado por Víctor.

**Reglas de legibilidad, medidas** píxel a píxel con Playwright (el motor tiene un modo que pinta el título sin tapar y otro sin título), `?3d=fondo`, tema oscuro, en reposo y con el puntero en dos esquinas:

| Obra | Ancho | Letra tapada (tope 22 %) | Letra peor (tope 35 % en reposo) | Contraste mínimo de la letra visible | Letra bajo 3:1 |
|---|---|---|---|---|---|
| Parásitos | 1440 | 11,2–11,5 % | «o» 33,6–36,2 % | 4,13 | 0 % |
| Parásitos | 1024 | 12,7–13,2 % | «s» 31,9–35,6 % | 4,15 | 0 % |
| Parásitos | 375 / 390 | 2,6 / 3,1 % | 10,9 / 12,6 % | 4,18 | 0 % |
| Hades | 1440 | 13,1–14,3 % | «s» 30,1–30,8 % | 5,54 | 0 % |
| Hades | 1024 | 12,6–13,3 % | «e» 32,2–34 % | 5,72 | 0 % |
| Hades | 375 / 390 | 1,1 / 1,3 % | 6 / 7,5 % | 3,67 | 0 % |
| Chihiro | 1440 | 3,2–3,3 % | «e» 30,4–30,6 % | 8,92 | 0 % |
| Chihiro | 1024, 375, 390 | 0 % (nada cruza el título) | — | 3,48 | 0 % |

Con el puntero en una esquina la letra peor llega al 36,2 % (el parallax mueve la figura un poco sobre la letra): el tope se aplica en reposo. El velo se calcula ahora con todo lo que el parallax puede traer detrás del título (44 px de margen).

**Móvil.** El título va dentro de la imagen (antes pisaba su borde inferior), así que ya hay letras entre capas: poco en Parásitos (2,6 %) y Hades (1,1 %), nada en Chihiro a 375 px, porque en el recorte 4:5 las figuras quedan por encima del título. Aceptado por Víctor. Es un cambio de composición de A en móvil que vale también para el 2D; si se quiere más cruce en móvil habría que subir el título dentro de la imagen (probé a colocarlo en automático según la máscara y no encontré una regla que diera buen resultado en las tres obras: lo quité).

**Antes y después** (ampliado ×3, `capturas/3d/`): `detalle-x3-hades-fondo.png`, `detalle-x3-parasitos-fondo.png`, `detalle-x3-chihiro-fondo.png`; el 2D de siempre, en `detalle-hades-2d.png` y `detalle-parasitos-2d.png`. El borde de la primera ronda (deshilachado, con motas) ya no existe en el código: quedó en el commit `fe69b2bb`.

**`capas` (sin mapas)** no cambia: dos planos con parallax y una máscara por color que, con las reglas, casi nunca deja pasar nada. Queda como respaldo para obras sin mapas.

## 2. Las imágenes cargan siempre: qué era

Diagnóstico con los registros de `kultura-dev` y con tiempos por origen:

| Qué fallaba | Prueba | Arreglo |
|---|---|---|
| **MangaDex cortaba la conexión.** En la primera ronda pedí el original (2,4 MB) a la vez que la miniatura; con dos descargas simultáneas MangaDex cierra una (`fetch failed · other side closed`, tras 2,42 MB) y el optimizador devolvía **500** | Registro del servidor; primera petición de la miniatura: 500 en 2,4 s | Primero la miniatura de 512 px (53 KB) y el original **después y en serie**, solo si la pantalla lo pide. Era un fallo introducido por mí |
| **La ficha de Hades salía como 404.** La API de RAWG tardó 6,2 s y el cargador real (`loadMediaDetail`) devuelve «no existe» cuando el proveedor falla | `GET /es/proto/ficha/a/game/274755 404 in 6165ms` | En el prototipo, un segundo intento antes de rendirse. **Es un problema del cargador de la app, no del prototipo**: ver decisiones |
| **Imágenes enormes en la primera carga.** El `srcset` ofrecía el original (523 KB TMDB, 360 KB RAWG) | — | `srcset` solo con tamaños razonables (60–165 KB); el original llega después, sin competir |
| **Velo mal calculado a veces.** Si el velo se medía justo cuando la imagen cambiaba de archivo, el lienzo estaba vacío y salía el velo mínimo (letras sin contraste). Y el 3D no se encendía si arrancaba en ese instante | Opacidad del velo 0,12 frente a 0,41 entre cargas iguales | Se espera a que la imagen esté completa; 36 arranques en frío: 36 con 3D |
| **Open Library es lento.** Su portada redirige (302) y tarda 2,7–3,2 s de mediana | Tiempos de abajo | No tiene arreglo por nuestra parte; mientras tanto se ve el campo de color |
| **Google Books devolvía 429** al enriquecer libros; el cortacircuitos de la app se abre 10 min | Registro del servidor | Nada: la app ya cae a Open Library |

Red de seguridad (en `Stage.tsx`, vale para 2D y 3D): si la imagen falla se oculta (queda el **campo de color** con el título, nunca el icono roto), se reintenta a los 0,8 s y a los 2,5 s, y después se baja a un tamaño menor; si la versión mayor falla, se queda la que ya se ve.

**10 cargas seguidas de cada obra, cada una en un contexto nuevo (sin caché del navegador)**, contra `next dev`:

| Obra · ancho | Con imagen | Versión mayor | TTFB mediana / máx. | Imagen lista mediana / máx. | Fallos de red |
|---|---|---|---|---|---|
| Parásitos · 1440 | 10/10 | 10/10 | 276 / 584 ms | 632 / 960 ms | 0 |
| Parásitos · 375 | 10/10 | 10/10 | 264 / 286 ms | 564 / 617 ms | 0 |
| Gente normal · 1440 | 10/10 | no hay mayor | 743 / 1630 ms | 2713 / 5197 ms | 0 |
| Gente normal · 375 | 10/10 | no hay mayor | 887 / 1430 ms | 3171 / 4143 ms | 0 |
| Hades · 1440 | 10/10 | 10/10 | 888 / 8744 ms | 1098 / 8971 ms | 0 |
| Hades · 375 | 10/10 | 10/10 | 1175 / 2514 ms | 1364 / 2717 ms | 0 |
| Berserk · 1440 | 10/10 | no hace falta | 374 / 1135 ms | 528 / 1226 ms | 0 |
| Berserk · 375 | 10/10 | 10/10 | 207 / 379 ms | 296 / 470 ms | 0 |
| Chihiro · 1440 | 10/10 | 10/10 | 426 / 752 ms | 747 / 1104 ms | 0 |
| Chihiro · 375 | 10/10 | 10/10 | 426 / 469 ms | 711 / 775 ms | 0 |

El máximo de Hades (8,7 s) es el servidor esperando a RAWG. La caché de datos del servidor estaba caliente; «en frío» aquí es el navegador.

Fallos provocados (Playwright corta las peticiones):

| Caso | Resultado |
|---|---|
| Ningún tamaño llega (Sala) | 11 intentos; imagen oculta, campo de color, `h1` presente; el 3D no se monta |
| Ningún tamaño llega (Pieza) | Reintentos; portada oculta, campo de color, título |
| Falla dos veces y a la tercera llega | Termina con imagen y con la versión mayor |
| El tamaño principal no llega nunca | Baja a `w780` y se ve |
| La versión mayor no llega (Sala, con 3D) | Se queda `w1280`; el 3D se enciende igual |
| 500 del optimizador a la primera (lo de MangaDex) | Reintenta y se ve |

## 3. Imágenes que llenan la pantalla

**Anime por TMDB.** Chihiro vuelve a tener sala: imagen de fondo sin rótulo de TMDB, 3830 × 2154. Cómo se cruza, en `DIRECCIONES.md` («Anime por TMDB»): en el prototipo, búsqueda por el título en japonés con coincidencia exacta de título original y año; en producción, por **Wikidata** (P8729 → P4947 / P4983), que la app ya consulta. Sin coincidencia, Pieza.

**Libro, manga y cómic.** La mayor que da cada proveedor:
- MangaDex: el original por el optimizador (Berserk: 1200 × 1706), después de la miniatura.
- Open Library: `-L` es su tope. El original sin sufijo de tamaño mide lo mismo (331 × 500 para esta obra): comprobado.
- Google Books: **no comprobado**: su API devolvía 429 durante la sesión. Además su servidor de imágenes no manda CORS, así que no serviría ni para el color ni para el 3D sin pasar por el optimizador (que no se amplía a hosts nuevos).

**Cómo llena la pantalla una Pieza sin ampliar la portada.** La portada va a su tamaño natural como mucho y, alrededor, un fondo a sangre hecho con su **paleta**, no con sus píxeles:
- **Variante 1** (por defecto): dos luces con los colores de la portada sobre el campo, y grano. `3d-pieza-libro-1440-campo1.png`.
- **Variante 2** (`?campo=2`): campo plano con viñeta y grano. `3d-pieza-libro-1440-campo2.png`.

El grano es ruido generado en el navegador. No se usa superresolución por IA. La variante se elige en la 8.5. La portada de Open Library sigue siendo pequeña (331 px): nítida a su tamaño en DPR 1, corta en pantallas de DPR 2–3 (tabla).

### Tamaño natural frente a tamaño en pantalla

| Obra | Pantalla | Modo | Archivo que se queda pintado (px) | Tamaño en pantalla (px CSS) | Ampliación en px CSS | En px de pantalla |
|---|---|---|---|---|---|---|
| Parásitos | 1440 @1× | Sala | 2732 × 1536 (TMDB original) | 1515 × 852 | 0,55 | 0,55 |
| Parásitos | 1440 @2× | Sala | 2732 × 1536 | 1515 × 852 | 0,55 | 1,11 |
| Parásitos | 375 @3× | Sala | 2732 × 1536 | 834 × 469 | 0,31 | 0,92 |
| Hades | 1440 @1× | Sala | 2580 × 1450 (RAWG original) | 1516 × 852 | 0,59 | 0,59 |
| Hades | 1440 @2× | Sala | 2580 × 1450 | 1516 × 852 | 0,59 | 1,18 |
| Hades | 375 @3× | Sala | 2580 × 1450 | 834 × 469 | 0,32 | 0,97 |
| Chihiro | 1440 @1× | Sala | 3830 × 2154 (TMDB original) | 1515 × 852 | 0,40 | 0,40 |
| Chihiro | 1440 @2× | Sala | 3830 × 2154 | 1515 × 852 | 0,40 | 0,79 |
| Chihiro | 375 @3× | Sala | 3830 × 2154 | 833 × 469 | 0,22 | 0,65 |
| Gente normal | 1440 @1× | Pieza | 331 × 500 (Open Library `-L`) | 331 × 500 | 1,00 | 1,00 |
| Gente normal | 1440 @2× | Pieza | 331 × 500 | 331 × 500 | 1,00 | **2,00** |
| Gente normal | 375 @3× | Pieza | 331 × 500 | 254 × 383 | 0,77 | **2,30** |
| Berserk | 1440 @1× | Pieza | 512 × 728 (miniatura de MangaDex; basta) | 397 × 565 | 0,78 | 0,78 |
| Berserk | 1440 @2× | Pieza | 1200 × 1706 (original por el optimizador) | 397 × 565 | 0,33 | 0,66 |
| Berserk | 375 @3× | Pieza | 1200 × 1706 | 254 × 361 | 0,21 | 0,63 |

Ninguna imagen se amplía en px CSS, y solo la portada de Open Library se queda corta en px de pantalla (el proveedor no da más). El original de la sala se pide siempre que la pantalla pida más de lo que da `w1280` (a 1440 px de ancho ya lo pide); llega después de la primera imagen.

Marco del tráiler: Parásitos y Chihiro usan la segunda imagen sin rótulo de TMDB, distinta de la de la sala; las otras tres obras no tienen tráiler.

## 4. «Dónde ver» en móvil

Cada grupo (suscripción, alquiler, compra) es una fila que se desliza con el dedo; logotipos de 44 × 44 px; el nombre de cada servicio sigue en el HTML (oculto a la vista, no al lector de pantalla); el enlace «Ver todas las opciones en TMDB» se conserva, a 44 px de alto. Parásitos a 375 px: la sección mide 262 px con 10 servicios, sin desborde horizontal. Los logotipos no son botones (no hay objetivo táctil que medir). Captura: `capturas/a/a-parasitos-claro-375-donde-ver.png`.

## 5. Giroscopio

Botón **«Mover con el móvil»** (solo en pantallas táctiles con el sensor declarado y sin movimiento reducido):

- **iOS**: `DeviceOrientationEvent.requestPermission()` se llama **solo al pulsar**; si se deniega, aviso «Sin permiso para el sensor de movimiento» y sigue el parallax por scroll y la deriva.
- **Android**: sin permiso; se activa al pulsar.
- Se **recentra** en la postura en que está el móvil al activarlo (y sigue muy despacio a la postura, con una constante de 30 s); **zona muerta** de 1,5°; **límite** de ±18°; el mismo suavizado que el puntero; con el móvil apaisado se intercambian los ejes.
- Con el sensor activo se para la deriva automática: en reposo, cero fotogramas.
- Si no llegan lecturas en 1,5 s (no hay sensor), aviso y vuelve la deriva. Con movimiento reducido el botón desaparece y el sensor se apaga. Sin contexto seguro, aviso «El sensor necesita HTTPS».

Probado en Chromium con eventos `deviceorientation` **sintéticos** (la emulación de sensores por CDP entregaba lecturas nulas en el Chromium sin ventana, y eso sirvió para probar el caso «sin sensor»):

| Prueba | Resultado |
|---|---|
| Activar | botón pulsado; 0 fotogramas en 1 s quieto |
| Inclinación dentro de la zona muerta (1°) | 0 % de píxeles cambian |
| Inclinación de 15° | cambian el 27 % (Sala) y el 32 % (Pieza) de los píxeles |
| De 25° a 60° (fuera del límite) | 0 % de píxeles cambian |
| Sin lecturas | aviso, botón sin pulsar, la deriva sigue (60 fotogramas/s) |
| iOS, permiso denegado / concedido | se pide 0 veces antes de pulsar y 1 al pulsar; aviso / activado |
| Movimiento reducido | el botón desaparece |

**Qué hace falta para que Víctor lo pruebe en su móvil**: los sensores exigen **contexto seguro**. `http://192.168.x.x:3000` no vale; hace falta HTTPS con un certificado en el que el móvil confíe. Sin tocar certificados ni la confianza del sistema, las dos formas son un despliegue de vista previa en Vercel de esta rama (HTTPS de serie; es una rama desechable y el repo es público, y fue lo que eligió Víctor) o un túnel HTTPS hacia el puerto 3000. No he instalado ni configurado nada.

## Técnica y peso

WebGL a pelo, un lienzo y un contexto; el motor se pide con `import()` después de `load`, de un rato libre y de las entradas de la sala.

| | Minificado | gzip |
|---|---|---|
| Motor 3D (trozo aparte, solo si hay 3D) | 22,9 KB | **9,8 KB** |
| Lo que crece `Stage` (siempre cargado: carga segura de la imagen, montaje, selector, contador y giroscopio) | +6,9 KB | **+2,8 KB** |
| Mapas por obra en `fondo` (máscara PNG + profundidad JPEG) | — | 51–62 KB |

Medido con esbuild sobre los archivos de la rama (no con el build de Next). three.js no se ha medido aquí.

## Medidas de rendimiento

**Equipo**: Windows 11, NVIDIA GeForce GTX 1070 (ANGLE, Direct3D 11), Chromium 147 de Playwright sin ventana, contra `next dev`. «375» es ese mismo equipo con ventana de móvil emulada: **no es un móvil**.

| Caso (segunda ronda, 6 s con deriva automática) | FPS | p95 del fotograma | Fotogramas > 32 ms | CPU por fotograma | Texturas |
|---|---|---|---|---|---|
| Hades `fondo`, 1440 a DPR 2 | 60 | 16,7 ms | 1 / 409 | 0,18 ms | 27,2 MB |
| Parásitos `fondo`, 1440 a DPR 2 | 60 | 16,7 ms | 1 / 416 | 0,12 ms | 26,4 MB |
| Berserk (Pieza), 1440 a DPR 2 | 60 | 16,7 ms | 1 / 406 | 0,08 ms | 4,1 MB |
| Los mismos con CPU ×4 | 60 | 16,7–16,8 ms | 1 / ~415 | 0,6–0,9 ms | — |

La matriz completa (5 obras × 2 vías × 1440 y 375 × con y sin CPU ×4: 60 fps y 0 fotogramas largos en los 40 casos) y el LCP con y sin 3D (sin diferencia atribuible) son de la **primera ronda** y no se han repetido con el motor nuevo; el sombreador de la segunda ronda hace una lectura de textura más por píxel. El lienzo pinta hasta DPR 2 y baja solo si el p95 pasa de 24 ms.

## Respaldos comprobados (repetidos en la segunda ronda)

Todos con Playwright; en todos la ficha conserva texto, enlaces y botones.

| Caso | Resultado |
|---|---|
| GPU por software (Chromium sin GPU) · sin WebGL (`--disable-3d-apis`) | No se monta; queda el 2D |
| Los mapas no llegan · la imagen no se puede subir a la GPU | Queda el 2D |
| Sin JS | El HTML del servidor: `h1` e imagen, sin lienzo |
| Movimiento reducido (sistema) | Sala: composición quieta (0 píxeles cambian con el puntero, 0 animaciones). Pieza: no se monta |
| Interruptor «Movimiento» · pestaña oculta · sala fuera de pantalla · en reposo | 0 fotogramas; se reanuda al volver |
| Pérdida de contexto | El lienzo se retira y el `h1` recupera su tinta; al restaurarse, vuelve el 3D |
| Contraste alto / colores forzados | No se monta: manda el texto real |
| Desmontar (3D → 2D) | Se retira el lienzo y se libera el contexto |

WCAG 2.2.2: la única deriva automática es en pantalla táctil sin giroscopio (y con `loop=1`); se para con el interruptor «Movimiento» y con movimiento reducido. WCAG 2.3.1: sin destellos.

## Qué NO se ha verificado

- **Dispositivos reales:** solo el móvil y el ordenador de Víctor, a ojo y sin cifras. Ningún otro dispositivo.
- Safari y Firefox. Build de producción. Red lenta. GPU integrada o de móvil.
- La matriz de rendimiento completa y el LCP con el motor de la segunda ronda (solo los 6 casos de arriba).
- Google Books como fuente de portada grande (429 durante la sesión).
- Pantallas de más de 1600 px de ancho. Lector de pantalla real. Tema claro y `en` en las medidas del título.
- La máscara en más obras: solo hay tres salas. En Chihiro, la figura de la derecha del vagón sale en la máscara a trozos (no cruza el título a ningún ancho probado).
- El cruce anime ↔ TMDB solo con Chihiro.

## Riesgos

1. **La máscara depende de cada imagen.** Tres obras no bastan: hace falta una tanda de 30–50 mirada a ojo antes de producción.
2. **Mapas = uso nuevo de las imágenes de los proveedores** (derivados guardados por nosotros). Bloqueo levantado por Víctor el 18-11-2026; sigue siendo un riesgo de términos.
3. **La ficha depende de la API del proveedor en caliente** (el 404 de Hades). Es de la app, no del 3D.
4. **Peso**: 51–62 KB de mapas por sala y hasta 27 MB de texturas a 1440 con DPR 2 (en móvil no se ha vuelto a medir).
5. La imagen de la sala de un anime es de TMDB y los datos de AniList: la atribución tiene que nombrar a los dos.
6. La máscara de letra del lienzo necesita la fuente variable registrada otra vez con su anchura; si falla, el 3D de la Sala no se monta. Comprobado solo en Chromium.
7. La landing usa Depth Anything V2 **Base** (CC-BY-NC-4.0); conviene pasarla a Small (Apache-2.0).

## Qué haría falta para llevarlo a producción

**De dónde salen los mapas para cualquier obra.** Una tarea en GitHub Actions como `landing-media.yml` (0 €, repo público): calcula máscara y profundidad de las obras que lo piden (las más vistas, o una cola que alimenta la ficha: la primera visita va en 2D) y los sube al almacenamiento de Supabase. En este equipo, en CPU: ~30 s por imagen la máscara (BiRefNet lite a resolución completa) y ~3 s la profundidad. Tabla nueva (p. ej. `media_depth`) con las reglas de `CLAUDE.md` (expandir → usar; bandera en `docs/banderas.json`). Almacenamiento: ~55 KB por sala → 10 000 salas ≈ 550 MB (el plan gratuito de Supabase da 1 GB). Solo las obras en modo Sala necesitan mapas. Si un proveedor pide retirar, se borran los suyos. Calcularlo en el navegador (decenas de MB de modelo) o en una función de Vercel no es viable.

**Resto**: cargador real para las imágenes sin rótulo de TMDB y para el cruce anime ↔ TMDB por Wikidata, con revisión legal; título localizado; tests (reglas de letras con máscaras sintéticas, Playwright de respaldos y de carga); presupuesto de CI para el trozo del motor; quitar selector, contador y `window.__kp3d`; que el cargador de la app no devuelva 404 cuando el proveedor falla.

**Texto para `/privacy`** (borrador sin aprobar: no está en `/privacy`; se enseña a Víctor antes de tocar esa página):

> **Imágenes con profundidad.** En la ficha de algunas obras, la imagen se mueve ligeramente con el puntero o con el móvil. Para eso guardamos en nuestro almacenamiento (Supabase) dos imágenes en escala de grises calculadas a partir de la imagen oficial de la obra (su silueta de primer plano y un mapa de profundidad). No contienen ningún dato tuyo ni se calculan en tu dispositivo. El efecto se dibuja en tu navegador; si activas «Mover con el móvil», la orientación del dispositivo se usa solo en ese momento y en tu navegador: no se envía ni se guarda. Con «reducir movimiento» la imagen queda quieta.

Y revisar la frase de #173 sobre las portadas: las imágenes de la sala se piden directamente al proveedor (TMDB, RAWG) a su tamaño original, y la de un anime, a TMDB.

## Capturas

En la rama del prototipo: `docs/proto/fase8-3/capturas/3d/` (`3d-fondo-*`, `3d-capas-*`, `3d-pieza-*`, `detalle-*`, `detalle-x3-*`, `respaldo-*`).

## Tercera ronda (tras la prueba de Víctor en su móvil, 18-11-2026)

- **Giroscopio más marcado.** Víctor: «al mover el móvil, sobre todo hacia los lados, tendría que notarse más». Con giroscopio el recorrido pasa a ×3 en horizontal y ×2 en vertical, el giro completo se alcanza a ±12° (antes ±18°) y el margen de la imagen sube de 1,035 a 1,06 para que el desplazamiento quepa sin estirar los bordes. La Pieza gira hasta 0,48 rad (antes 0,26). Validado por Víctor en su móvil.
- **«Dónde ver» en móvil:** logotipos a 28 px (no se pulsan, no les aplica el mínimo táctil); la sección de Parásitos baja de 262 a 202 px a 375.
- **Riesgo visto al comprobar:** `image.tmdb.org` solo manda `Access-Control-Allow-Origin` si la petición lleva `Origin`, y no manda `Vary`. Si el navegador tiene en caché la misma dirección pedida antes sin CORS, la petición con CORS falla. Aquí la sala cayó al tamaño menor (780) y siguió funcionando. En producción: todas las etiquetas de una misma dirección con el mismo `crossOrigin`, o una dirección distinta para las lecturas con CORS.
