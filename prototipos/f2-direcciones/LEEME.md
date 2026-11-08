# F2 · Direcciones nuevas, desde cero (con las skills)

Tres prototipos de portada pública + fragmento de Inicio. Abrir por HTTP (por `file://` fallan máscaras y fuente).

## Contrato de dirección (impeccable, modo Persuade, `seed:2b2125ee60c82639`)
- **Tesis común:** tu progreso en 7 formatos es lo que se ve, no una etiqueta sobre una portada.
- **Mundo propio:** portadas reales como material; negro `#0a0a0a`; el acento lo pone la portada activa.
- **Historia:** primer pantallazo = pack + una obra activa + «Marcar visto» que responde; debajo, «Por dónde vas».
- **Primer pantallazo:** titular, frase, obra, dato de progreso, «Marcar visto», «Crear cuenta». También a 320×640.

| Dirección | Idea | Riesgo |
|---|---|---|
| **Revelado** | Cada copia se revela en franjas hasta donde vas; lo pendiente queda subexpuesto. Se lee el estado de toda la pared de un vistazo. | La mitad inferior de cada portada se ve oscura a propósito. |
| **La tira** | Tambor 3D de 14 caras movido con flechas, arrastre o teclado; debajo, una celda por unidad. | La más cercana a un carrusel. Una celda por unidad no escala a series largas. |
| **La balda** | Estantería con 7 volúmenes en 3D y proporciones físicas; el marcapáginas asoma por el canto de la portada, sin tocarla, y baja hasta donde vas. | La más familiar; a 768 la fila se desplaza de lado; el marcapáginas pierde fuerza como firma al salir de la portada. |

Candidatos y veredicto: 1 Revelado (fusión con el reto *cuarto oscuro*), 2 La tira (la tirada), 3 La balda (mi elección), 4 Pasillo de videoclub (declinado: repite la perspectiva de La balda), 5 Sala a oscuras (declinado: glow, anti-lista), 6 Álbum de cromos (declinado: infantil), 7 Marquesina de Gran Vía (declinado: solo sirve a cine). Retos de la tirada declinados: sol interior, mampara, sobre de cromos, instalador shareware, zine (artesanal, anti-lista). Desviación del proceso de impeccable: 3 prototipos probados en vez de `serve-question`, porque Víctor elige entre direcciones vivas (§6.1 del plan).

## Pruebas (2026-11-08, Chromium sin WebGL, por HTTP)
| Puerta | Resultado |
|---|---|
| `taste lint` | 0 FAIL, 0 WARN en las 3 |
| `taste inspect` 1440/768/390 | 0 FAIL en las 3 (avisos abajo) |
| `impeccable detect` | 0 hallazgos por archivo; 3 `buried-raster` por URL, juzgados falsos por el revisor |
| axe wcag2a/aa, 2.1, 2.2 a 1440/390, normal, reduced-motion y `contrast: more` | 0 serious/critical |
| Consola, a 6 tamaños (1440×900, 390×844, 320×640, 844×390, 320×256, 640×360) | sin errores |
| Desplazamiento lateral, a los mismos 6 tamaños | ninguno |
| Titular | ≤ 2 líneas a 1440, 390 y 320 |
| Botones del primer pantallazo con cada una de las 7 obras | dentro, a 1440, 390 y 320 |
| Marcar → Deshacer, con teclado | T2 E5 → T2 E6 → T2 E5; Deshacer a 1 Tab; el foco vuelve al botón |
| Acabar una obra y deshacer 4 pasos | «Al día» y vuelta a T2 E5 |
| La tira, 6 toques rápidos | llega a las 7 obras |
| Doble toque en el mismo punto de marcar (centro y borde derecho), 7 obras, a 320/360/390/1440 | el botón no se mueve; ni abre «Crear cuenta» ni deshace |
| La tira, arrastre | el tambor sigue al puntero, se asienta al soltar; el botón derecho y los arrastres cortos no cambian de obra |

## Revisión independiente (2 pasadas; Artisan y Advocate)
Nota de Artisan en la 2.ª pasada, escala 1–5: Revelado 3,3 · La tira 3,3 · La balda 3,1. **Ninguna pasa la puerta** (criterio 7 = 3 o menos, falta lector de pantalla real). Los dos graves nuevos de la 2.ª pasada (Deshacer movía marcar bajo el dedo; cinta de La balda sobre los títulos) y el foco fuera de pantalla en La balda se corrigieron después y se midieron, sin repuntuar. Recomendación dividida: Advocate enseñaría Revelado; Artisan, La tira.

## Avisos que se quedan, y por qué
`no-footage` (no hay vídeo propio ni licencia); `font-not-dealt` (Kultura Display y Bricolage son preferencia de `CLAUDE.md`, aunque «desde cero» permitía replantearlas); `side-scroll` a 768 en La balda; `still-page` en La balda y La tira (las entradas se quitaron de las listas de trabajo a propósito); `blank-gap` y `ragged-edges` en Revelado (hoja de contactos, a revisar).

## Sin resolver
- **El titular dice «series» y la pantalla enseña 7 formatos.** Los revisores confirman que se lee como solo series. Choca con la cuña A (plan §5.1, D-F1c/D-F1d) y D-F2a. Lo decide Víctor.
- Sin mosaico P1 en el 2.º pantallazo; pie al 63 % (R3 ≥ 85 %); frase ≠ brief §A.3; K4 sin romper marco; I2 (View Transitions) ausente; `lang` sin poner en títulos extranjeros.
- Inicio con progreso de muestra dentro de la portada pública; en la app real va tras la sesión.
- Miniaturas de 63×56 en Revelado a 390. `flex-grow` y `width` recalculan layout (M4; aceptable en prototipo, no en producción). Literales fuera de tokens (`revelado.html:15`, `tira.html:82`).
- Revelado sigue plana a 390: el fuelle solo existe a ≥ 1024 y la inclinación exige puntero fino. El corte duro cruza la figura.
- La tira sigue pareciendo un coverflow; a 390 enseña 2 de 7 formatos y Valheim, oscura, se lee como un hueco a la izquierda.
- Portadas a 390: Revelado 46 %; La tira y La balda ≈ 37–38 % antes de dar línea propia a «Crear cuenta» (K6 pide 40 %), sin volver a medir.
- Deshacer es solo un icono y no caduca, frente a B2 («Deshacer» durante 5 s). Al cambiar de obra desaparece y ya no hay forma de corregir: decisión a confirmar.

## Sin verificar
NVDA y VoiceOver, táctil real, Safari y Firefox, prueba de 5 s con personas. Lighthouse y JS por ruta: esto es HTML de prototipo con todo montado por JS, no la app; no sirve para comprobar el presupuesto de 150 KB ni el comportamiento sin JS.

El progreso es de muestra. Las portadas salen de `prototipos/login/img` y `prototipos/f2-tiles/img`.
