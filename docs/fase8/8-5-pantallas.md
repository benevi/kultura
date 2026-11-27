# Fase 8.5 · Pantallas: orden y plan de PRs

**Aprobado por Víctor el 21-11-2026**, con las cuatro decisiones de abajo.

## Hechos que cambian el encargo
- **«Buscar» ya no es pantalla**: `/search` redirige a Descubrir (E-DISCOVER-SEARCH-MERGE). La tercera pantalla es **Descubrir** (barra de búsqueda + rejilla).
- `KButton`/`PosterFrame`/`MediaCard` (src/components/ui, media) son lo viejo; «Sala» tiene sus propios `SalaButton` (48 px), `SalaPoster`, `SalaWorkCard`, `SalaStage`, `SalaTitle`… que hoy solo carga Storybook.
- El respaldo sin portada de «Sala» es el campo de color con el título (franja con la paleta de la obra o neutros): sustituye a **los dos** degradados (`posterGradient` de tarjetas y `posterGradientFeature` de la ficha).

## Orden
1. Ficha (`/media/[type]/[id]`, pública) → 2. Biblioteca → 3. Descubrir (con búsqueda) → 4. Inicio → 5. Perfil y páginas públicas → 5b. Marca y armazón → 6. Listas → resto (ajustes, amigos, grupos, chat, calendario, avisos) → landing, login y bienvenida al final.

## Banderas
Una por pantalla, leída en el servidor como `QUICK_ADD`: `SALA_FICHA`, `SALA_BIBLIOTECA`, `SALA_DESCUBRIR`… y `SALA_FICHA_3D` aparte. Valores `0` / `prueba` / `1`: con `prueba` solo la ve quien tiene la cookie de prueba (enlace que se da a los 3 usuarios de P-Uso). Caducan a 60 días: al pasar P-Uso se enciende y se quita el camino viejo.

## Ficha (PRs)
- F1: bandera + cookie de prueba + hojas de Sala solo en la ficha + precarga de Anybody + sala con rótulo en 2D (SalaStage/SalaTitle, color de la imagen en el navegador; libro/manga/cómic como pieza sobre su paleta). Debajo, la ficha de hoy. **Primer PR.**
- F2: cuerpo de la ficha en Sala: franja, panel, acciones de biblioteca (SalaButton/SalaDialog), sinopsis, créditos, «Dónde ver» deslizable, adaptaciones, Steam.
- F3: tráiler al final (marco 16:9, youtube-nocookie al pulsar).
- F4: datos: anime-película con formato propio; vertical redimensionada para llenar la sala (tope 1,25×); título original con su idioma.
- F5: imágenes sin rótulo de TMDB y cruce anime→TMDB por Wikidata (revisión de términos antes, kultura-legal-privacidad).
- F6: P-Uso y 100 %; se retira la ficha vieja. Con ella se retira `SalaButtonLazy` (`src/components/sala/`): solo existe para que la ficha con la bandera apagada no descargue `SalaButton` (los botones de la ficha con `skin="sala"` lo importan así); al 100 % se importa `SalaButton` directo.
- 3D: 3D-1 migración `media_depth` (expandir; «sí» de Víctor para producción) · 3D-2 tarea de Actions que produce los mapas (0 €) · 3D-3 motor WebGL detrás de `SALA_FICHA_3D` + texto de `/privacy` (se enseña antes) · 3D-4 P-Uso.

## Biblioteca
B1 rejilla con SalaWorkList/SalaWorkCard + edición rápida en SalaDialog · B2 cabecera, contadores que filtran por estado, panel de filtros, orden (`?sort=`) y progreso en la tarjeta · (opcional) gráficas de seguimiento · P-Uso.

## Descubrir
D1 buscador, tipos (botones con aria-pressed desde `sm`; en el móvil, un `<select>` nativo como los de B2), «Sorpréndeme», rejilla con SalaWorkList/SalaWorkCard y paginación (arregla de paso: imagen rota —las obras sin portada ya no se esconden—, × repetidas, error no anunciado —con «Reintentar»—, aria-pressed) · D2 filtros en un panel como B2 (botones con aria-pressed para los de varias opciones, `<select>` para los de una y para el orden, URL con `pushState`) y foco en la lista al cambiar de página · tráiler al pasar: aparte, necesita preferencia o cambio en `/privacy` · P-Uso.

## Inicio
Bandera `SALA_INICIO`. I1 `h1` (no había), «Continúa donde lo dejaste» y las filas de «Popular entre tus amigos» y novedades con SalaWorkList/SalaWorkCard, mismos datos que hoy (arregla de paso: sin `h1`, filas sin nombre, obras sin portada escondidas, barra de la fila oculta —sin rueda horizontal no se llegaba al final— y anillo de foco cortado por la fila) · I2, en dos PRs (decisiones de Víctor del 25-11-2026): **I2a** el hero «Continuando» en «Sala», columna de escritorio más ancha (`max-w-6xl`), flechas «anteriores / siguientes» de 48 px en las filas desde `md` (`aria-controls`, `aria-disabled` en los extremos para no perder el foco), aviso con «Reintentar» (`role="alert"`) si una fila falla, «N amigos» en «Popular entre tus amigos», y el «+1» con SalaButton y el aviso de terminar en `SalaConfirmDialog` (Cancelar primero) · **I2b** «Esta noche» con «Sorpréndeme», «Para ti» con todos sus estados, la actividad de amigos, el aviso de borrado, el esqueleto de `loading.tsx` (si la bandera puede decidirse ahí sin volver dinámica la página) y el papel tipográfico de los `h2` · P-Uso. El hero mensual de la landing pública (#269, #245) es otra cosa y no entra aquí: espera al texto de `/privacy` (#271) y su hueco está por decidir (ver `PLAN_FASE8.md` §12).

## Perfil y páginas públicas
Bandera `SALA_PERFIL` (una sola para `/profile/[username]`, `/u/[username]` y `/u/…/r/…`; en `1` no lee cookies, así las públicas pueden decidirlo como `media-anonima`). P1 `/profile` con la cabecera de persona (franja con el color del avatar, avatar cuadrado y `h1` «@nombre» como rótulo), los números en una fila, «Viendo ahora» y «Últimos completados» con `SalaRow` (la fila de Inicio, que pasa a `src/components/sala/`), estados de biblioteca oculta o vacía con `SalaBlockState` y columnas explícitas de `users` (arregla de paso: `h1` truncado, botón de la bio invisible con teclado, números repetidos, filas sin nombre y barra escondida, `select('*')`) · P2 acciones de `/profile` en «Sala»: amistad con «Dejar de ser amigos» y «Bloquear» en `SalaConfirmDialog`, errores anunciados, `ReportButton skin="sala"`, actividad del amigo con la vista de `SalaHomeActivity`, géneros con su número, `loading` y `error` · P3 `/u/[username]` con la misma cabecera, invitación, favoritos con la escala de nota de su dueño, filas, la barra de la app con sesión y una sola llamada a registrarse · P4 `/u/…/r/…` (póster con su paleta, rótulo, nota en bloque) · P5 P-Uso y retirada de lo viejo. La lista pública `/u/…/l/…` va con Listas (6).

Decisiones de Víctor (26-11-2026): (1) dos perfiles con la misma cabecera; la fusión en uno, después de P-Uso; «Pendientes» sale de `/profile`. (2) La bio no se edita en el perfil: «Editar perfil» lleva a Ajustes. (3) La lista pública, en la pantalla 6. (4) Una sola bandera, `SALA_PERFIL`. (5) Las gráficas de seguimiento, fuera de esta pantalla. Tras P1: el rótulo del nombre se queda entre 30 y 72 px, y los formatos de los números van en minúscula (igual en `/u`).

P2: las acciones sobre otra persona van en `SalaProfileSocial`. El estado de la amistad se dice en texto («Sois amigos.», «Solicitud enviada», «Te ha enviado una solicitud…»); «Solicitud enviada» ya no es un botón muerto (lleva «Cancelar solicitud») y una recibida se puede rechazar. «Bloquear» va en segundo plano (`quiet`), sin menú «Más». `error.tsx` ya era de «Sala» (`ErrorState`, 8.4); `loading.tsx` pinta el esqueleto de «Sala» con la bandera. El Supabase simulado de la red a11y ya filtra `or=(…)`: antes cualquiera salía como amigo.

P3: `/u/[username]` en «Sala» (`SalaPublicCollection`), decidido con `salaPerfilEnabled()`: en `1` no lee cookies y en `prueba` lee la de prueba (la página ya era dinámica: sesión y `searchParams`); con `0`, el HTML de siempre (instantánea en `tests/unit/app/u`). La misma `SalaProfileHeader` (sin fecha de alta para quien no tiene cuenta), «Invitar amigos» con `SalaButton`, favoritos en `SalaWorkCard` con la nota en la escala de su dueño («Nota: 9 de 10» o «4,5 de 5», como `/r`; antes siempre «de 5»), «En curso» y cada lista pública con `SalaRow` (`h3` bajo «Listas públicas», con el formato debajo y «Ver lista» a la `/l` de hoy), bloqueos y vacíos con `SalaBlockState`. Con sesión, la barra de la app (`AppChrome`, dentro de un proveedor con los textos del shell, como la ficha pública); sin sesión, la cabecera pública. Sin cuenta, una sola llamada a registrarse: la invitación si llega con `?ref=` de su dueño, si no «¿Y la tuya?» al final; el bloqueo de la biblioteca solo ofrece «Ya tengo cuenta». Lo que ve quien no tiene cuenta no cambia (§7 de la propuesta): ni fecha, ni visibilidad, ni biblioteca, ni se piden. Las piezas van por `SalaProfilePublicLazy` (sin las acciones de amistad de `/profile`). `/r` y `/l` entran en `pages.spec.ts` (benevi tiene una lista pública en los datos de prueba).

P4: `/u/[username]/r/[type]/[id]` en «Sala» (`SalaRatedTitle` + `SalaProfileReview`), con la misma bandera y la misma regla (en `1` sin cookies; con `0`, el HTML de siempre, instantánea en `tests/unit/app/u`). Qué se ve lo sigue decidiendo `resolveRatingShare`: sin cuenta ni enlace firmado, la página genérica sin nota, como hoy. La franja con el color de su dueño y «@nombre» con enlace a su perfil, el póster (`SalaPoster`), el `h1` «Nota de @nombre para» + el título como rótulo (tope de 30 a 72 px) y la nota en bloque en la escala de su dueño («9 de 10», «4,5 de 5»). «Ver la ficha» o «Puntúalo tú» y «Ver el perfil de @…» con `SalaButton`; la pista de quién ve la nota, solo al dueño. Con sesión, la barra de la app (`AppChromeLazy`, como `/u`); sin ella, la cabecera pública y una sola llamada a registrarse al final. El póster aún no tiñe la página con su paleta. El Supabase simulado de la red a11y resuelve ya `lists!lists_owner_id_fkey(…)` y los filtros sobre el embebido (`lists.is_public`): el e2e de `/u` ve la fila de la lista pública.

## Marca y armazón
Añadido el 28-11-2026 a petición de Víctor. El logo y el armazón común (cabecera, barra inferior del móvil y pie) no estaban en ninguna pantalla: cada una se pasaba a «Sala» por dentro y el armazón seguía siendo el viejo. Va antes de Listas para que P-Uso (desde el ~24-12) vea la app con un solo estilo.

Bandera `SALA_MARCA` (`0` / `prueba` / `1`, como las demás). Encendida, cambia el armazón de todas las páginas con sesión y de la cabecera pública. Apagada, el HTML de siempre (instantánea en el primer PR).

- M1: logo. Dirección de arte prepara 2–3 propuestas en «Sala» partiendo del logo B que eligió Víctor en las style tiles (D-F2d, D-F2f; abierto por D-F2q). Elige Víctor. Incluye el favicon, los iconos de la PWA (`manifest`) y la imagen de las tarjetas para compartir (OG). Solo el SVG y los recursos; nada se pinta todavía.
- M2: cabecera de escritorio (`AuthHeader`) y cabecera pública en «Sala», con el logo nuevo, `SalaLink` en la navegación, la página actual marcada con `aria-current` y el contador de no leídos.
- M3: barra inferior del móvil (`BottomNav`) y pie (`AppFooter`) en «Sala». La atribución a TMDB, RAWG y Steam se mantiene igual.
- M4: P-Uso junto con las demás pantallas y, al 100 %, retirar el armazón viejo. Se retira antes que las pantallas, porque las que ya están en «Sala» lo esperan.

Riesgos: el armazón sale en todas las páginas, así que un fallo las rompe todas a la vez. Por eso va primero en modo `prueba` y lleva axe y teclado en las rutas de `pages.spec.ts`. El peso del armazón entra en todas las páginas: Lighthouse con presupuesto en cada PR.

## Decisiones (Víctor, 21-11-2026)
1. `KButton sm` 32→44: **no se toca**; cada pantalla migrada pasa a `SalaButton` (48 px) y `KButton` muere con la migración. 32 px ya cumple WCAG 2.2 AA (2.5.8 pide 24).
2. Degradados: **no se unifican**; los dos se retiran con la migración (respaldo de Sala).
3. P-Uso: bandera con modo `prueba` (cookie por enlace) para los 3 usuarios antes del 100 %.
4. Orden de pantallas: el de arriba.
