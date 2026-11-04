# Kultura · prototipo de nivel premio — notas de trabajo

## Por qué fallaron v1–v3 (autocrítica honesta)
- v1 «frase con tira de portadas»: plano, mucho texto, ningún 3D. No cumplía ninguno de los tres pilares del brief (Bruno Simon / Immersive Garden / Dropbox).
- v2 «hoja de contactos»: oscuro pero estático. Una tira de imágenes atenuadas no es una experiencia. Creatividad ≈ 6.
- v3 «tres portadas»: parallax 2D por UV (efecto ya visto, el mismo de la landing v2 actual), sin escena, sin narrativa de scroll, sin «cosa viva», sin pantallas de app. Y presentado como menú de opciones en vez de una decisión. Creatividad ≈ 6,5 y diseño ≈ 6,5.

## Inventario de lo que solo Kultura tiene (Taste paso 1)
1. Siete formatos en un sitio: película, serie, anime, manga, videojuego, libro, cómic. Ningún competidor los junta.
2. Tres verbos: **ves, lees, juegas**. Letterboxd = solo «ves», Goodreads = solo «lees», Backloggd = solo «juegas».
3. Portadas reales cada semana, cada una con su **mapa de profundidad** (Depth Anything V2, pipeline propio). Es material que nadie más tiene preparado.
4. Cada formato tiene un **objeto físico** distinto: póster o pantalla (cine, series, anime), tomo (manga), libro con lomo, grapa de cómic, caja de juego.
5. La vida de un título: Pendiente → En curso → Completado (o Abandonado).
6. Nota sobre 10 con ★; «Lo mejor de 2026» por formato.
7. El onboarding real: puntúas unos títulos y Kultura empieza a conocerte (`/welcome`).
8. Gratis y sin anuncios.

## La idea (Taste paso 4)
> En Kultura, **los tres verbos (ves, lees, juegas)** se convierten en **tres salas de una misma escena 3D por la que viaja la cámara**. Las portadas reales son **objetos físicos de su formato**, con relieve real sacado de su mapa de profundidad.

- **Prueba del competidor:** Letterboxd solo tendría una sala. Pasa.
- **Dirección (Taste, repartida):** `pinned-poster`, «algo se queda quieto mientras todo cambia». Aquí se queda fijo «Lo que **ves**» y cambia el verbo y la sala.
- **Cosa viva:** puntúas 4 portadas reales y se dibuja en directo tu mezcla de formatos. Es el primer paso real del producto, `/welcome`: contenido real, se usa con el pulgar y tiene alternativa sin script.

## Pilares del brief → cómo se cumplen
- **Bruno Simon:** objetos 3D con personalidad (cada formato con su cuerpo), luz que sigue al cursor, objetos que reaccionan (se inclinan hacia el cursor; al pasar por encima, la figura sale del relieve).
- **Immersive Garden:** la cámara viaja entre salas al hacer scroll (escena en escenario fijo, GSAP ScrollTrigger con scrub), el verbo fijo cambia con un enmascarado de línea, el color de fondo cambia por capítulo con cortes duros.
- **Dropbox brand:** tipografía protagonista (Red Hat Display 900, repartida), composición editorial con dos o tres bordes, mucho espacio negativo y una paleta controlada.

## Sistema (Taste, repartido y ajustado al requisito oscuro)
- **Tipografía:** Red Hat Display 900 en mayúsculas, tracking −0,03em, interlineado 0,92. Red Hat Text 400/500.
- **Color:** suelo casi negro teñido con el acento de la portada del capítulo (fórmula de la hoja: cada panel trae su color muestreado de la foto). Tinta blanca. Acción en amarillo #e9e34a (del «Cobalt field» repartido), usado solo en la acción.
- **Escenas:** como mucho 2, con una sección tranquila entre ellas. Sin precargador, sin cursor propio, sin secuestrar la rueda.

## Arquitectura de la página
1. **Héroe = escena 1 «Constelación».** Los objetos flotan en profundidad y la luz sigue al cursor. Esquinas: marca, Entrar, frase y botón. El h1 «KULTURA» en HTML se pinta desde el primer fotograma.
2. **Escena 2 «Ves · Lees · Juegas»** (aguanta 3 pantallas). La cámara viaja y los objetos se reagrupan:
   - **VES**: pantallas en un muro.
   - **LEES**: tomos y libros en una estantería.
   - **JUEGAS**: cajas en abanico.

   Titular fijo «Lo que ves» con el verbo enmascarado. Cuenta sencilla «1 de 3».
3. **Tranquila:** «Lo mejor de 2026», filas reales con dos extremos (título y formato ↔ ★ nota).
4. **Cosa viva:** puntuar 4 títulos y ver tu mezcla en directo.
5. **App, en fragmento real:** ficha de título con el objeto 3D en la cabecera, más la biblioteca. `data-ui`.
6. **Cierre:** invitación más el nombre recortado.

## Barreras antes de enseñar nada
- Taste: `lint.mjs` y `inspect.mjs` a 0 FAIL en 1440/768/390.
- Crítica con la rúbrica de Taste (critique.md §4) escrita; objetivo ≥ 8,0 sin topes aplicados.
- Design Motion Principles en modo auditoría sobre el movimiento.
- Checklist de UI UX Pro Max (accesibilidad, táctil, rendimiento).
- Crítico independiente (agente sin mi razonamiento) con las capturas.
- Rendimiento: FPS en swiftshader, nada bloquea la primera pintura, movimiento reducido = composición terminada.
