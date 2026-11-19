# Biblia de diseño · Dirección «Sala»

**Estado:** firmada por Víctor el 18-11-2026 (puerta **P-Gusto**, `PLAN_FASE8.md` §3).
**Elegida el 18-11-2026** entre tres direcciones hechas en código («Sala», «Objeto», «Pliego») sobre la ficha, con obras reales, en claro y oscuro, en móvil y escritorio. El código de las tres vive en la rama `proto/fase8-3-direcciones`, que no se fusiona.

Esta biblia fija el lenguaje común. El diseño de cada pantalla se hace en la fase 8.5, pantalla a pantalla; el sistema (tokens y componentes) se construye en la 8.4.

## 1. La idea

Entrar en una obra es entrar en su sala: una imagen de la obra llena la pantalla, como en MUBI, y el título —que ponemos nosotros— vive dentro de la imagen, con partes de ella pasando por delante de las letras. Debajo, una franja entera con el color de la imagen y la ficha sobre un fondo teñido de ese color.

Con personalidad, sin recargar: esquinas rectas, color plano, sin sombras ni líneas de adorno.

## 2. La imagen

| Dónde | Qué imagen | Regla |
|---|---|---|
| **Ficha** de película, serie, videojuego y anime | Imagen oficial **sin rótulo**, apaisada | A todo el ancho de la pantalla. El título lo ponemos nosotros |
| **Ficha** de libro, manga y cómic | La portada (ningún proveedor da imagen sin rótulo) | Entera, sin recortar y a su tamaño, centrada sobre un fondo a sangre hecho con su paleta (no con sus píxeles). El título va debajo, nunca encima de la portada |
| **Tarjetas, listas y biblioteca** | La portada real | Como hasta ahora |

- Si una obra de cine, juego o anime no trae imagen apaisada, **su imagen vertical se redimensiona para llenar la sala**: se pide en su resolución original, se ajusta al ancho de la pantalla y se recorta por la zona de interés (sin rótulo si el proveedor la da así). No se compone como un libro.
- **Siempre en alta calidad, sin pixelar.** Se pide la resolución que haga falta para el tamaño real en pantalla. Ninguna imagen se amplía por encima de 1,25 veces su tamaño natural: solo si ninguna imagen de la obra, ni apaisada ni vertical, da para llenar la sala sin pasar de ese tope, la obra se compone como un libro, con la portada a su tamaño.
- Obras sin ninguna imagen: carátula generada, solo en ese caso.
- De dónde sale la imagen sin rótulo: imágenes sin idioma de TMDB y arte de RAWG. Para anime, la imagen de TMDB de la misma obra (el banner de AniList no da resolución); el cruce se hace por Wikidata y, sin coincidencia segura, se usa su imagen vertical redimensionada. Las de TMDB son peticiones que la app no hace hoy: pasan por la revisión de términos antes de llegar a producción.
- La imagen nunca queda rota: mientras llega, o si no llega, se ve el campo de color con el título.

## 3. El título

- Siempre en el idioma que elige la persona. Debajo, el título original en su escritura, marcado con su idioma: «Parásitos» / 기생충, «El viaje de Chihiro» / 千と千尋の神隠し.
- Un solo título real por página, en el HTML del servidor. Lo que se pinte dentro de la imagen o del 3D es adorno que lo repite, oculto a lectores de pantalla.
- **Letras fundidas:** la imagen puede tapar como mucho el 22 % de la letra, medido sobre los píxeles de letra, en el título entero y en cada línea, a cualquier ancho. Toda la letra visible guarda al menos 3:1 contra lo que tiene detrás. Si una imagen no lo permite, esa obra va sin fundido. Se apaga con `prefers-contrast: more`.
- El corte sale de una máscara de la figura calculada de antemano, y **cada letra va entera por detrás o entera por delante** de la figura: el corte nunca cae dentro de una letra a medias. Una letra que quedaría tapada más del 35 % pasa entera por delante.
- En móvil el título también va dentro de la imagen.
- Hueco de datos (para la 8.5): solo TMDB da el título traducido. AniList, Open Library, MangaDex y RAWG no. Hace falta una fuente de títulos por idioma.

## 4. Color

- El color sale de la imagen de cada obra, **en el navegador**, a partir de la imagen ya cargada. Ni se calcula en el servidor ni se guarda.
- Nunca se usa crudo: se ajusta la luminosidad (OKLCH) hasta cumplir AA, 4,5:1 para texto y 3:1 para componentes, en claro y en oscuro. Probado con 3000 portadas al azar.
- Si la imagen no da color útil, o su origen no permite leerla (Google Books), paleta neutra.
- **Claro y oscuro, los dos**, a elegir por cada persona; por defecto, el del sistema. El fondo claro es un gris teñido, nunca blanco.
- La sala no cambia con el tema: la imagen es la imagen. Cambia todo lo de debajo.

| Papel | Qué es | Claro | Oscuro |
|---|---|---|---|
| Franja | El color más vivo de la imagen, como bloque entero, con su tinta | L 0,52–0,80 | L 0,30–0,50 |
| Fondo | Teñido con el tono dominante | L 0,905 | L 0,165 |
| Panel | Un paso de tono sobre el fondo, sin líneas ni sombras | — | — |
| Acento | Enlaces y acción principal | ≥ 4,5:1 | ≥ 4,5:1 |

Neutros de respaldo: fondo `#e6e3dd` / `#171614`, tinta `#1b1a17` / `#f2f0eb`.

El formato de una obra nunca se distingue solo por el color.

## 5. Tipografía

| Uso | Fuente | Licencia |
|---|---|---|
| Rótulo (títulos) | **Anybody**, variable en peso y anchura. La anchura se elige por la longitud del título, que llena el ancho en 1–2 líneas (3 en móvil) | SIL OFL 1.1 · github.com/Etcetera-Type-Co/Anybody |
| Texto e interfaz | **Instrument Sans** | SIL OFL 1.1 · github.com/Instrument/instrument-sans |
| Hangul y japonés | **Noto Sans KR / JP**; en texto japonés va primero la japonesa, y en coreano la coreana | SIL OFL 1.1 · github.com/notofonts/noto-cjk |

Fuera: JetBrains Mono y Newsreader. Sus archivos de `assets/fonts/` se sustituyeron en la 8.4 por los de estas cuatro familias, con su fila en `LICENSES.csv`.

Los valores concretos (colores neutros y de estado, papeles tipográficos, medidas) y cómo se usan están en [`TOKENS.md`](TOKENS.md).

## 6. Movimiento

- Una entrada: la imagen se asienta y el título sube. Con ratón, imagen y título se mueven en sentidos contrarios. Al bajar, la sala se queda atrás.
- Con movimiento reducido (preferencia del sistema o interruptor propio): todo quieto y nada oculto.
- Nada se mueve solo más de 5 segundos sin poder pararse.
- En el móvil, la sala se mueve al inclinar el teléfono, solo después de pulsar «Mover con el móvil» (en iPhone pide permiso). Sin sensor o sin permiso, queda como estaba.
- El 3D: ver §8.

## 7. Tráiler

- **En la ficha**, aparte de la sala: sección propia al final. Un marco 16:9 con una imagen de la obra y «Ver el tráiler». **Esa imagen nunca es la misma que la de la sala**: otra imagen oficial sin rótulo y, si la obra no tiene una segunda, el marco va sin imagen, sobre el color de la obra. Al pulsar, el marco pasa a ser el reproductor de YouTube (`youtube-nocookie`), en silencio, con sus controles y su marca y sin nada encima. Antes de pulsar no sale ninguna petición a YouTube.
- **En Descubrir** (idea de Víctor, para la 8.5): tráiler al pasar el ratón por la tarjeta, como en la biblioteca de Steam. Condición: YouTube exige consentimiento expreso para reproducir y `/privacy` dice hoy «solo cuando pulsas reproducir»; hará falta una preferencia que cada persona enciende o cambiar ese texto legal. Los vídeos propios de Steam quedan descartados por sus términos.

## 8. 3D

**Entra en el plan.** Puerta **P-3D** pasada el 18-11-2026: Víctor lo probó en su móvil y en su ordenador, va fluido y cuadra con la dirección. Medidas y detalle en [`../spikes/3d-ficha.md`](../spikes/3d-ficha.md).

- **Qué es:** la sala gana profundidad. La imagen se separa en planos con un mapa de profundidad y se mueve con el ratón, con el scroll o con el giroscopio; el título queda entre los planos. En libro, manga y cómic, la portada es una pieza con cuerpo que gira un poco.
- **Cómo:** WebGL directo, sin librería, cargado después de la página. Los mapas se calculan de antemano con modelos de licencia libre y se sirven como archivos; nada se calcula en el dispositivo.
- **Reglas:** todo se puede hacer sin 3D; el HTML del servidor es la fuente de verdad; el 3D nunca retrasa la página; se apaga con movimiento reducido, sin WebGL o con gráfica por software, y entonces queda la sala en 2D, que es la misma composición.
- **Pendiente para la 8.4/8.5:** producir los mapas para el catálogo a coste cero y la revisión de términos de las copias de imagen (riesgo asumido en `PLAN_FASE8.md` §1).

## 9. Accesibilidad

WCAG 2.2 AA. Revisión del 18-11-2026 sobre el prototipo: sin infracciones automáticas (axe), un solo `h1`, sin scroll horizontal a 320 px, foco visible, acciones de 48 px o más.

Riesgo de fondo de esta dirección, asumido al elegirla: el título va sobre una imagen cualquiera, así que su contraste se decide obra a obra. Por eso las reglas de §3 se miden, no se miran, y en la 8.4 entran como prueba automática.

Sin comprobar todavía: lector de pantalla real, Safari y Firefox, zoom real del navegador.

## 10. Lo que se descartó

- **«Objeto»:** la portada como cosa con cuerpo según el formato, sobre su color.
- **«Pliego»:** editorial, suelo gris, portada en ventana.
- **Gráficas de seguimiento** (referencia: The StoryGraph): no son de la ficha; candidatas para perfil o biblioteca en la 8.5.

## Firma

**Víctor, 18-11-2026.** Dijo «firmo» tras leerla entera, con estos puntos señalados antes de firmar: tope del fundido (22 % y 3:1), tope de ampliación (1,25×), la sala no cambia con el tema, letras enteras por delante o por detrás y título dentro de la imagen en móvil, y el riesgo asumido de términos sobre las copias de imagen y los mapas.
