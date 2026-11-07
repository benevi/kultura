# F2 · paso 4 · Style tiles (rondas 1 y 2)

Tres direcciones para `docs/02_DISEÑO_BRIEF.md` (v1.2), cuña A, titular «Tus series, al día.» (D-F2a). Portadas reales de TMDB (consulta `discover` del 2026-11-07, `language=es-ES`). Se abren en local (`A.html`, `B.html`, `C.html`); las fuentes y portadas van en `fuentes/` e `img/`.

| Tile | Dirección | K8 (firma) | Artifact privado |
|---|---|---|---|
| A · Encuadre | póster a sangre como marco, titular abajo a la izquierda, ocre de «El último reino» | «T2 / E5» apilado junto al póster | https://claude.ai/artifact/Lyh1swKbsMjRm3tcvpaYrw |
| B · Marcador | muro de portadas a 2 px (R4), titular en caja alta por CSS, naranja de «Proyecto Salvación» | pista de episodios: cada tramo, uno; los vistos se llenan | https://claude.ai/artifact/VqnKzjWxeDWARBwavsTzTN |
| C · Escena | titular arriba en una línea, fondo 16:9 a sangre como pantalla y póster en capa, verde agua de «Sherlock» | la cuenta de lo que falta («te quedan 2 episodios») | https://claude.ai/artifact/KjTku74WJKpSuRvJhp6K9x |

## Pruebas (regla 4), 2026-11-07, Playwright + axe-core del repo
- 390 × 844, 1440 × 900 y 320 × 700; con y sin `prefers-reduced-motion`; `getContext('webgl')` anulado (los tiles no usan WebGL).
- axe (wcag2a/aa, 21a/aa, 22aa, best-practice): **0 infracciones** en las 18 combinaciones. Consola: 0 errores y 0 avisos.
- Sin desbordamiento horizontal a 320. Portadas en el 1.er pantallazo (muestreo): A 56–58 %, B 40–48 %, C 41–50 %.
- B2 (marcar visto): un toque, `aria-live` «Temporada 2, episodio 5, visto.», «Deshacer» 5 s que se pausa con el foco dentro; el foco vuelve a «Marcar visto» al expirar y al llegar al último episodio.
- Sin probar: VoiceOver en iOS, NVDA y Safari real.

## Rúbrica §D, criterios 1–4 (pasa con ≥ 4 en los cuatro)
| Tile | Implementador | Revisor (Artisan + Advocate, ronda 2) | Vale (la más baja si difieren ≥ 2) |
|---|---|---|---|
| A | 4 · 4 · 5 · 4 | 3 · 4 · 4 · 2→4 * | 3 · 4 · 4 · 4 |
| B | 4 · 4 · 5 · 3 | 3 · 4 · 4 · 3–4 | 3 · 4 · 4 · 3 |
| C | 4 · 4 · 4 · 4 | 3 · 4 · 4 · 4 | 3 · 4 · 4 · 4 |

\* El 2 de Artisan en A era el solape del K8 con el titular a 390; corregido y medido después (sin solape a 320, 390 y 1440), sin repuntuar.

**Ninguno pasa todavía:** los revisores dejan el criterio 1 (Carácter) en 3 en los tres. B además deja el botón en 699–751 px a 390 (bajo la barra de Safari). Falta la nota de Víctor y su feedback escrito contra la rúbrica para la ronda 2. Sugerencia de los revisores: C como base con la pista de B como K8; o A (mejor para el usuario de la cuña, según Advocate).

Capturas en `capturas/` (las JPEG van al repo; las PNG de página completa y reduced-motion se quedan en local).

## Ronda 2 · A2 «Encuadre con pista» (D-F2d)
Feedback de Víctor a la ronda 1: paleta de A, logotipo de B, C descartado y el acento no es fijo. A2 = paleta de A + monograma de B (toma el color de la escena; fijo en tinta como icono) + pista de episodios de B como lado izquierdo del marco del póster, con la etiqueta «El último reino / T2 E5 / te quedan 4 episodios» colgada del tramo actual, igual a 390 y a 1440. En «Seguir viendo» cada fila lleva el acento de su portada (ocre, verde, verde agua) y el acento solo llena la pista.

- Artifact privado: https://claude.ai/artifact/3bSSJt3aKQQURxQ8Vxuggs
- Pruebas: axe 0 en 8 combinaciones (390/1440/320/1024 × reduced-motion), consola limpia, sin WebGL, sin desbordes ni solapes, portadas 45 % (390) y 52 % (1440), B2 con ratón y teclado (nombre accesible «Marcar visto: T2 E5 de El último reino»).
- Rúbrica (C1·C2·C3·C4): implementador 4·4·4·4; Artisan 3·3·3·4 → 4·4·4·4 tras arreglos; Advocate 4·4·4·4 → 4·4·4·4. **Pasa la puerta del paso 4**, pendiente de la nota de Víctor.
- Condiciones abiertas: pack P1 en el paso 6; probar un acento frío (riesgo X11); P3 con pistas largas (anime); verde de Los 100 frente a `--ok`.
- Capturas: `capturas/A2-390.jpg` y `A2-1440.jpg`.

## Ronda 3 · A3 «Encuadre en profundidad» (D-F2e)
Nota de Víctor a A2: 3 (falla la legibilidad móvil; falta profundidad/3D). A3 = A2 + escena en tres planos sin WebGL: el fondo 16:9 de la serie lejos (fundido con máscara), Los 100 y Sherlock alejándose en Z, y delante el póster con la pista. La escena reposa ya girada, así que la profundidad se ve también en táctil y con reduced-motion; con puntero fino gira ±6° más y vuelve con muelle. A 390: titular primero, escena, «Crear cuenta» y entradilla.

- Artifact privado: https://claude.ai/artifact/TtWXN7RnwijpACzUt7ZP6R
- Pruebas: axe 0 en 8 combinaciones (390/1440/320/1024 × reduced-motion), consola limpia, sin desbordes, «Crear cuenta» visible sin desplazar a 390×844 y 320×640, escena 46 % (390) y 60 % (1440), B2 correcto.
- Rúbrica (C1·C2·C3·C4): Artisan 3·3·3·4 → 4·4·4·4; Advocate 4·4·3·4 → 4·4·4·4. **Pasa**, pendiente de la nota de Víctor (última ronda: si no pasa, R3/D6).
- Pendiente para el paso 5: la etiqueta tapa el tramo actual de la pista en móvil; «te quedan 4 episodios» en 2 líneas a 390; ¿cuenta el fondo 16:9 como portada (K6)?
- Capturas: `capturas/A3-390.jpg` y `A3-1440.jpg`.
