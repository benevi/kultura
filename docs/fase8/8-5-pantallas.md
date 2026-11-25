# Fase 8.5 · Pantallas: orden y plan de PRs

**Aprobado por Víctor el 21-11-2026**, con las cuatro decisiones de abajo.

## Hechos que cambian el encargo
- **«Buscar» ya no es pantalla**: `/search` redirige a Descubrir (E-DISCOVER-SEARCH-MERGE). La tercera pantalla es **Descubrir** (barra de búsqueda + rejilla).
- `KButton`/`PosterFrame`/`MediaCard` (src/components/ui, media) son lo viejo; «Sala» tiene sus propios `SalaButton` (48 px), `SalaPoster`, `SalaWorkCard`, `SalaStage`, `SalaTitle`… que hoy solo carga Storybook.
- El respaldo sin portada de «Sala» es el campo de color con el título (franja con la paleta de la obra o neutros): sustituye a **los dos** degradados (`posterGradient` de tarjetas y `posterGradientFeature` de la ficha).

## Orden
1. Ficha (`/media/[type]/[id]`, pública) → 2. Biblioteca → 3. Descubrir (con búsqueda) → 4. Inicio → 5. Perfil y páginas públicas → 6. Listas → resto (ajustes, amigos, grupos, chat, calendario, avisos) → landing, login y bienvenida al final.

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

## Decisiones (Víctor, 21-11-2026)
1. `KButton sm` 32→44: **no se toca**; cada pantalla migrada pasa a `SalaButton` (48 px) y `KButton` muere con la migración. 32 px ya cumple WCAG 2.2 AA (2.5.8 pide 24).
2. Degradados: **no se unifican**; los dos se retiran con la migración (respaldo de Sala).
3. P-Uso: bandera con modo `prueba` (cookie por enlace) para los 3 usuarios antes del 100 %.
4. Orden de pantallas: el de arriba.
