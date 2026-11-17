# Biblia de dirección de arte · «Archivo vivo»

**Versión 0 (borrador), 17-11-2026.** Plan: `docs/PLAN_FASE8.md` §5.2–5.6. Redacta Claude (agente); decide Víctor.
La V1 se aprueba al final de 8A.1, con la ficha 2D que pase el panel visual. Hasta entonces, todo lo marcado **[propuesta]** se puede cambiar.

Tablero de pencil (`docs/design/biblia.pen`): pendiente. El conector de pencil no respondió el 17-11-2026; se añade cuando conecte. Mientras tanto se explora en código y Storybook (plan B de D7).

## 1. Dirección

KULTURA deja de parecer una rejilla de pósters y pasa a ser **un archivo personal**: cada cosa que ves, lees o juegas es una ficha con su signatura, guardada en su sitio. El archivo es de quien lo usa, no del catálogo.

- **Qué se gana:** identidad propia sin depender de las portadas de terceros, lectura densa y rápida, y un 2D que vale por sí solo si el 3D no pasa las puertas.
- **Qué no es:** nostalgia, museo ni escritorio simulado. Es editorial y actual, con materiales sugeridos y nunca imitados.

## 2. Concepto

**«Archivo»:** papel, cartón, latón, tinta y luz cálida.

| Adjetivo | Significa | No significa |
|---|---|---|
| **Sobrio** | Pocos elementos, un acento por pantalla, mucho aire | Gris, frío, corporativo |
| **Táctil** | Bordes, capas y peso que sugieren objeto | Texturas fotográficas, sombras realistas, cuero cosido |
| **Preciso** | Rejilla estricta, cifras tabulares, signaturas, alineación al píxel | Denso hasta agobiar |

**Materiales y su papel:**
- **Papel:** la superficie de lectura (fondo de día).
- **Cartón:** lo que contiene (fichas, carpetas, carátula generativa).
- **Latón:** el único acento metálico (signatura, foco, sello). Poco y pequeño.
- **Tinta:** todo el texto. Casi negra de día, casi blanca de noche; nunca negro ni blanco puros.
- **Luz cálida:** de noche y en Cine la sala está oscura, y lo que se mira recibe luz cálida.

## 3. Regla de contención

Por pantalla: **1 material, 1 acento, 1 objeto héroe** (`data-hero`).

- Casilla en la plantilla de PR desde 8A.3.
- Prueba de entrecierre (`npm run design:squint`, 8A.3): con la pantalla desenfocada 8 px, lo que más contrasta tiene que ser el objeto héroe.
- El color de formato nunca va solo: siempre con icono y etiqueta (A11Y-11).

## 4. Antirreferencias

| No | Por qué |
|---|---|
| Rejilla genérica de pósters (Letterboxd, Trakt) | La identidad la ponen las portadas ajenas; todas las apps parecen la misma |
| Skeuomorfismo de iOS 6 (cuero, costuras, madera fotográfica) | Imita en vez de sugerir; envejece mal y pesa |
| *Glassmorphism* oscuro | Bajo contraste, caro en móviles modestos, estética de plantilla |
| Degradados tipo Wrapped | Ruido de color; rompe «1 acento» |
| Neón *cyberpunk* | Lo contrario de sobrio y cálido |
| Lo que KULTURA es hoy: fondo violeta oscuro con seis acentos saturados (rosa, lima, naranja, morado, azul, amarillo) | Seis acentos compiten entre sí; no hay material ni héroe |

## 5. Tokens base **[propuesta]**

Valores de partida en OKLCH. Los definitivos, la escala completa y la matriz de contraste (21 pares en 8A) salen de 8A.3. Los contrastes de abajo están calculados (WCAG 2), no medidos en pantalla.

### Archivo · día
| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `papel` | `oklch(95% 0.02 85)` | Fondo | — |
| `carton` | `oklch(88% 0.035 80)` | Fichas, carpetas | — |
| `tinta` | `oklch(22% 0.02 60)` | Texto | 15,0 sobre papel · 12,1 sobre cartón |
| `tinta-2` | `oklch(42% 0.02 60)` | Texto secundario | 7,3 · 5,9 |
| `laton-texto` | `oklch(45% 0.09 75)` | Signatura, enlaces | 6,5 · 5,3 |
| `laton` | `oklch(62% 0.11 80)` | Filetes, sello, foco (no texto) | 3,2 sobre papel |

### Archivo · noche
| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `fondo` | `oklch(18% 0.015 60)` | Fondo (marrón muy oscuro, no violeta) | — |
| `carton` | `oklch(24% 0.02 65)` | Fichas | — |
| `tinta` | `oklch(93% 0.02 85)` | Texto | 15,3 · 13,4 |
| `tinta-2` | `oklch(74% 0.025 80)` | Texto secundario | 8,2 · 7,1 |
| `laton` | `oklch(76% 0.11 85)` | Signatura, foco, enlaces | 8,7 · 7,6 |

### Cine · noche (8A.4)
| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `fondo` | `oklch(13% 0.01 30)` | Sala a oscuras | — |
| `panel` | `oklch(19% 0.015 30)` | Paneles | — |
| `luz` | `oklch(82% 0.10 70)` | Acento de luz de proyector | 11,4 · 10,5 |

### Forma, tipo y movimiento (ya fijados en el plan)
- **Radios** 4/8/12. **Espaciado** 4…128 px. **Elevación** `elev-1…3`, con sombra corta y cálida.
- **Tipografía:** Bricolage Grotesque (marca e interfaz), JetBrains Mono (signaturas y cifras), Newsreader (títulos editoriales y sinopsis; recortable). Figtree sale. Aprobadas el 17-11-2026 (`assets/fonts/`).
- **Movimiento:** `dur-instant` 100, `dur-quick` 180, `dur-base` 280, `dur-flight` 320 ms. El papel no rebota: curvas de salida suaves, sin muelles.
- **Textura de papel:** ≤ 4 KB, opacidad ≤ 6 %. Es lo cuarto que se recorta.

### Acento de formato **[propuesta, abierta]**
El plan dice que «el acento de formato se mantiene» entre salas. Hoy los formatos usan los seis acentos saturados. Propuesta: siete tintas de sello, apagadas (croma ≤ 0,10), usadas solo en el icono, la etiqueta y el filete de la signatura. Los valores se eligen en 8A.1 sobre la ficha real.

## 6. Signatura

Código en mono, igual en lista, ficha y carátula: **`FMT-AAAA-NNNN`**.

- `FMT`: formato en 3 letras. **[propuesta]** `PEL` película · `SER` serie · `ANI` anime · `LIB` libro · `COM` cómic · `MAN` manga · `JUE` videojuego.
- `AAAA`: año de la obra (`0000` si no se conoce).
- `NNNN`: número estable derivado del `media_id` (no del orden en la biblioteca de nadie).
- Ejemplo: `PEL-1994-0231`.
- Los prefijos no se traducen: son parte de la marca, como una signatura de biblioteca. **[propuesta]**
- Función `signature()` con test (8A.3).

## 7. Moodboard

Objetivo de la V1: 12–20 referencias de Archivo y 6–10 de Cine, anotadas y con fuente. En la v0 solo va la lista de qué buscar; las imágenes las elegimos juntos en 8A.1, y en el repo solo entran enlaces, nunca copias.

**Archivo, qué buscar:**
1. Fichas de catálogo de biblioteca (cartulina, mecanografiadas, con signatura arriba a la izquierda).
2. Cajas y carpetas de archivo con etiqueta y tarjetero de latón.
3. Lomos de colecciones editoriales con sistema (misma retícula, cambia el color).
4. Sellos de caucho y matasellos: tinta desigual, un color.
5. Tarjetas de préstamo y sobres de bolsillo de biblioteca.
6. Diseño editorial suizo: retícula, mono para datos, serif para lectura.
7. Etiquetas de inventario de museo.
8. Fichas técnicas de filmoteca.

**Cine, qué buscar:**
1. Sala a oscuras con un solo haz de luz.
2. Marquesinas y letreros de cine de barrio.
3. Entradas de papel y tiras de fotogramas.
4. Carteles tipográficos (sin fotografía).

## 8. Identidad sonora (solo texto en 8A)

Tres familias: **madera** (cajón que cierra), **papel** (ficha que se desliza), **metal** (tarjetero de latón, sello). Sonidos cortos (< 300 ms), secos, sin melodía.
En 8A no hay código de audio. Las 3 referencias CC0 se eligen en 8A.1 y se anotan aquí con su enlace y licencia.

## 9. Abierto para Víctor

1. ¿Vale la dirección de §1–§2, o falta o sobra algún material?
2. Paleta base (§5): ¿marrón cálido de noche en lugar del violeta actual?
3. Acento de formato: ¿siete tintas apagadas, o un solo acento (latón) y el formato solo con icono y etiqueta?
4. Prefijos de la signatura (§6) y que no se traduzcan.
5. La marca: ¿el logotipo actual (rosa) se adapta al latón o se queda como está?

## Registro

| Fecha | Versión | Qué | Quién |
|---|---|---|---|
| 17-11-2026 | v0 | Borrador: dirección, concepto, antirreferencias, tokens base | Claude (agente); pendiente de Víctor |
