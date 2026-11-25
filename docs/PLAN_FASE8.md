# Plan de la fase 8 · Rediseño

**Versión 4** · 2026-11-17 · Responsable único: **Víctor**. Redacta Claude (agente); decide Víctor.

Sustituye a la v3 («Archivo vivo»), archivada en [`archivo/PLAN_FASE8_v3.md`](archivo/PLAN_FASE8_v3.md). De la v3 siguen valiendo como referencia técnica sus apartados §6 (accesibilidad), §7.4 (tabla de proveedores), §8 (presupuestos y CI) y §9 (legal), salvo donde esta versión diga otra cosa. El paquete `docs/fase8/` es de la v3: se rehace fase a fase al empezar cada una.

Leyenda: **[P]** pendiente del «sí» de Víctor · **[E]** estimación orientativa.

---

## 0. Resumen

- **Para qué:** que KULTURA **crezca**, que **le guste a Víctor** y el **reto del 3D**. En ese orden cuando choquen.
- **Qué cambia respecto a la v3:**
  - Las **portadas reales** son obligatorias y son la protagonista del diseño. La carátula generada queda solo para obras sin portada.
  - **«Archivo» deja de ser la dirección fijada.** La dirección visual se elige entre tres propuestas hechas en código (8.3).
  - **Crecer** tiene fase propia (8.2).
  - El **3D entra en el plan** y se prueba junto con la dirección visual. Sale si no cuadra con el diseño.
  - **Todas las API, oficiales** (8.1).
  - **Proceso ligero:** cuatro puertas en lugar de siete. Sin panel externo, sin estudio formal y sin el bloque 8B.
- **Coste:** ≈ 0 €/mes. Ningún gasto sin un «sí» propio de Víctor.
- **Tiempo:** sin fechas límite. Manda el orden de las fases.

## 1. Decisiones tomadas

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-11-12 | Portadas reales: se mantiene lo que ya ocurre (optimizador de Vercel para MangaDex, ComicVine y Steam; OG con portada). Declarado en `/privacy` (#173). Riesgo asumido | Víctor |
| 2026-11-12 | Coste ≈ 0 y sin fechas límite | Víctor |
| 2026-11-16 | Tarea semanal `landing-media.yml` pausada (#175) | Víctor |
| 2026-11-17 | **Se revisa el plan entero.** Objetivos: crecer, que le guste a Víctor, reto del 3D | Víctor |
| 2026-11-17 | **El uso de portadas reales es obligatorio** | Víctor |
| 2026-11-17 | **Los correos a los proveedores no se envían ahora; riesgo asumido.** Se mandarán más adelante. Los borradores quedan en `docs/legal/correos-proveedores.md` | Víctor |
| 2026-11-17 | **El 3D entra en el plan; se saca si no cuadra con el diseño** | Víctor |
| 2026-11-17 | **Todas las API tienen que ser oficiales** | Víctor |
| 2026-11-17 | **Steam se mantiene** (`store.steampowered.com/api/appdetails`) como única excepción a «API oficiales» | Víctor |
| 2026-11-17 | **Portadas en el 3D:** MangaDex, ComicVine y Steam pasan por el optimizador de Vercel (la misma copia temporal que ya ocurre en 2D); el resto, carga directa | Víctor |
| 2026-11-17 | **Meta de crecimiento:** ≥ 12 activos a 30 días, como referencia; no bloquea nada | Víctor |
| 2026-11-17 | El borrador de biblia «Archivo» (PR #214) se descarta | Víctor |
| 2026-11-17 | Tipografías de la v3 (JetBrains Mono, Newsreader): **no gustan**. Se eligen de nuevo en 8.3. Los archivos de `assets/fonts/` se sustituyen entonces | Víctor |
| 2026-11-18 | **Se levanta el bloqueo de §9** sobre copia propia de portadas, KTX2 y mapas de profundidad («levanta §9»). Riesgo asumido. Llevarlo a producción sigue pidiendo su texto en `/privacy` y las reglas de migraciones y de coste | Víctor |
| 2026-11-20 | **El hero muestra lo nuevo de cada mes:** las imágenes de la portada de la app no son siempre las mismas; cada mes pasan a los estrenos o novedades de ese mes (cine, series, juegos, libros…), sin intervención manual. Se adelanta a la 8.5: reanuda `landing-media.yml` con cron mensual y criterio «novedades del mes» (#269), que no se fusiona hasta que `/privacy` declare las copias. Relacionado: la tarea `landing-media.yml`, pausada el 16-11 (#175) | Víctor |
| 2026-11-21 | **Plan de la 8.5 aprobado** ([`fase8/8-5-pantallas.md`](fase8/8-5-pantallas.md)): ficha → biblioteca → Descubrir (con búsqueda) → inicio → perfil → listas → resto; una bandera por pantalla con modo `prueba` para P-Uso; `KButton sm` no sube a 44 px y los dos degradados no se unifican: se retiran al pasar cada pantalla a «Sala» | Víctor |
| 2026-11-23 | **Ficha en «Sala» (F2–F4):** «Cancelar» va primero en todos los diálogos; «Denunciar» es un diálogo; el foco pasa a la primera lista. Tráiler a 2/3 de ancho, antes de «Dónde ver», con reproducción automática al pulsar y la imagen de la obra de fondo (nada de YouTube antes del clic). OVA y ONA siguen como «Anime»; las películas de TMDB siguen como «Película». El título original solo muestra el idioma si ya va bajo el rótulo. El nombre de la plataforma con modalidad espera a F6 | Víctor |
| 2026-11-24 | **Ficha (F5):** pie «Imagen, tráiler y disponibilidad: TMDB» o «Imagen: TMDB»; cruce AniList → TMDB por Wikidata con caché de Next (30 y 7 días); textos de `/privacy` y `/terms` aprobados | Víctor |
| 2026-11-24 | **P-Uso:** criterio de `f6-p-uso` aprobado; los probadores usan su cuenta real. `SALA_FICHA`, `SALA_BIBLIOTECA` y `SALA_DESCUBRIR` en `prueba` en producción (solo con la cookie de `/api/sala-prueba?on=1`) | Víctor |
| 2026-11-24 | **Biblioteca (B1, B2) y Descubrir (D1, D2):** con «Sala», la edición rápida sale siempre; los contadores filtran por estado; panel «Filtros» cerrado al entrar; nota mínima en desplegable y «Solo favoritos» como interruptor; obras sin portada con respaldo (no se esconden); rejilla uniforme; barra de Descubrir no fija; tipos en desplegable en el móvil; al cambiar de página, el foco pasa a la lista; nombres oficiales de plataforma | Víctor |
| 2026-11-25 | **Vercel pausa el proyecto** por agotar dos límites del plan Hobby: CPU de funciones (4 h) y transformaciones de imagen (5.000). **Se espera a la reanudación (hacia el 24-12-2026), sin pasar a Pro.** Mientras tanto se recorta el consumo. La fase sigue: se fusiona en `master` y sale a producción al reanudarse | Víctor |
| 2026-11-25 | **Fondos de TMDB de la ficha:** dejan de servirse a tamaño original por el optimizador de Vercel. Pasan a cargarse directamente de TMDB, con el tamaño según la pantalla y sin cambiar el diseño | Víctor |

### Riesgos que Víctor asume (escritos para que consten)

Detalle en [`legal/terminos/README.md`](legal/terminos/README.md).

- **AniList** prohíbe su API en servicios de listas de anime y manga. KULTURA lo es en parte.
- **MangaDex** no permite enlazar sus imágenes directamente: pasan por el optimizador de Vercel (copia temporal).
- **Imágenes para compartir (OG)** con portada: varios proveedores prohíben derivados.
- **Copia propia de portadas y mapas de profundidad** (desde el 18-11-2026): son obras derivadas guardadas. Las vetan TMDB (§1.C: sin derivados, caché de 6 meses como máximo) y la regla general de ComicVine, Steam, MangaDex y Google Books. Incluye lo que ya sirve la landing (bucket `landing` y `public/landing/fallback/`).
- **Sin respuesta escrita de ningún proveedor** mientras no se envíen los correos.
- Si un proveedor pide retirar algo, se retira en 7 días (canal de `/legal`, #179). Eso manda sobre «portadas obligatorias».

## 2. Principios

1. **La portada manda.** El diseño se construye alrededor de la portada real. Precisión del 18-11-2026 (biblia, §2): en la **ficha** de película, serie, videojuego y anime manda la imagen oficial sin rótulo, a todo el ancho; la portada real sigue en tarjetas, listas y biblioteca, y en la ficha de libro, manga y cómic.
2. **2D primero.** Todo se puede hacer sin 3D. El 3D es una capa que puede faltar sin perder texto, acción ni enlace.
3. **El HTML del servidor es la fuente de verdad.** Ningún texto *solo* dentro del 3D: lo que el 3D pinte repite un texto que ya está en el HTML y va oculto a lectores de pantalla (decisión del 18-11-2026).
4. **El 3D nunca retrasa la página.** Se carga después de que la pantalla ya sea usable.
5. **Decide Víctor viéndolo.** Las propuestas visuales se enseñan en código, con datos reales.
6. **Decir la verdad en `/privacy`.**
7. **API oficiales** y atribución como pide cada proveedor.
8. **Coste ≈ 0.**

## 3. Puertas

| Puerta | Cuándo | Se pasa si | Si falla |
|---|---|---|---|
| **P-Gusto** | Fin de 8.3 | Víctor elige una dirección y la firma en `docs/design/BIBLIA.md` | Otra ronda de propuestas |
| **P-3D** | Fin de 8.3 | El prototipo 3D de la ficha cuadra con la dirección elegida **y** va fluido en los dispositivos de Víctor (móvil y ordenador) | El 3D sale del plan; todo sigue en 2D |
| **P-Uso** | Antes de pasar cada pantalla nueva al 100 % | Al menos 3 usuarios actuales completan las tareas habituales sin atascarse (prueba informal) | Se corrige y se repite |
| **P-Números** | 4 semanas después de cada cambio grande | Entradas por usuario activo y activos a 30 días **no bajan** respecto a la línea base | Se revisa o se revierte con la bandera |

## 4. Fases

| Fase | Qué | Sale con | [E] sem. |
|---|---|---|---|
| **8.0 Preparación** | Ya hecho: `/privacy` (#173), inventario de portadas (#174), licencias (#176), notificaciones (#177), plan de Vercel (#178), canal de retirada (#179), términos de proveedores (#210), borradores de correo (#212) | Este plan aprobado | — |
| **8.1 API oficiales y atribución** | **Hecha (17-11-2026):** #216, #217, #218, #219. Ver §5 | Ninguna llamada a una API no oficial; atribución completa | — |
| **8.2 Crecer** | **Hecha (17-11-2026):** #221–#226. Ver §6. Falta encender tres banderas en Vercel | Línea base medida; acciones rápidas fusionadas | — |
| **8.3 Dirección visual y prototipo 3D** | **Hecha (18-11-2026).** Ver §7 | **P-Gusto** y **P-3D** pasadas: dirección «Sala» firmada y 3D dentro del plan | — |
| **8.4 Sistema y deuda de interfaz** | **Hecha (21-11-2026):** #233–#266. Ver §11 | Componentes con estados y sin fallos graves de accesibilidad | — |
| **8.5 Pantallas** | **En curso.** Ver §12. Rediseño pantalla a pantalla, cada una detrás de una bandera; **P-Uso** antes del 100 %. El 3D de la ficha entra aquí (P-3D pasada). El hero se renueva cada mes con lo nuevo (§1, 20-11-2026) | Todas las pantallas con el diseño nuevo | 5–9 |
| **8.6 Observación** | **P-Números**; se retiran las banderas | Informe de una página | 0,5 |

**Laboratorio (sin compromiso ni orden):** salas por formato, vuelo entre pantallas, sonido, Wrapped, perfil en 3D. Solo se sacan de aquí si el 3D de la ficha funciona y Víctor lo pide.

**Encaje con el saneamiento:** orden vigente `… → 9 → 10 → 12 → 8 → 11`. Las banderas de la fase 8 se registran en `docs/banderas.json`. Las migraciones siguen las reglas de `CLAUDE.md`.

## 5. Fase 8.1 · API oficiales y atribución

**Hecha el 17-11-2026.** Enlace de Comic Vine en el pie (#216); Jikan retirado (#217); «Powered by Google» y enlace a cada libro (#218); «MyAnimeList» fuera del pie, de `/privacy` y de `/terms` (#219).

- **Ids de Jikan en producción: 0** (consulta de agregados del 17-11-2026 sobre `media`, `user_media`, `user_media_logs`, `list_items`, `recommendations`, `group_posts`, `media_adaptations` y `media_translations`). No hubo nada que convertir ni migración. El pendiente [P] de §10.1 queda sin objeto.
- **Importador de MyAnimeList:** si AniList no tiene el MAL ID de una fila, la fila queda sin emparejar (antes se pedía a Jikan).
- **Queda para más adelante, sin prisa:** renombrar `src/lib/api/jikan-maps.ts` (tablas de géneros y estados; no llama a ninguna API) y quitar el trato de ids `anime_{n}` / `manga_{n}` que sobrevive en el correo de calendario y en las adaptaciones (usan AniList y Wikidata, no Jikan).

Lo que sigue es la tabla con la que arrancó la fase.

| Proveedor | Hoy | Qué se hace |
|---|---|---|
| TMDB, RAWG, AniList, MangaDex, ComicVine, Open Library, Google Books | API oficial | Nada |
| JustWatch | Llega por el *endpoint* oficial de TMDB | Nada |
| **Jikan** (MyAnimeList no oficial) | Solo resuelve ids antiguos de bibliotecas y hace de respaldo de la búsqueda de manga (`src/lib/api/jikan.ts`) | **Se retira.** Los ids antiguos se convierten a AniList o MangaDex. Si alguno no se puede convertir, **[P]**: pasar a la API oficial de MAL (exige que Víctor registre la aplicación y avise a MAL) o dejar esa obra sin datos nuevos |
| **Steam** (`store.steampowered.com/api/appdetails`) | Descripción, capturas e idiomas de los videojuegos; no está en la Web API documentada | **Se mantiene** como única excepción (decisión del 17-11-2026). Complementa a RAWG; el pie ya enlaza a Steam y lleva el aviso de marca de Valve |

Atribución que falta:
- **ComicVine:** enlace en el pie (hoy solo el nombre).
- **Google Books:** logo «Powered by Google» y enlace a cada libro.
- «MyAnimeList» sale del pie cuando se retire Jikan.

Migraciones, si la conversión de ids las necesita: expandir → usar → contraer.

## 6. Fase 8.2 · Crecer

**Hecha el 17-11-2026**, con el diseño actual.

- **Medir** (#221). [`metricas-fase8.sql`](metricas-fase8.sql) y la línea base en [`metricas-fase8-linea-base.md`](metricas-fase8-linea-base.md): 4 cuentas, 1 activo a 30 días, 0 a 7 días. El freno es que llega poca gente, no la velocidad de registro.
- **Registrar más rápido.** «+» en las tarjetas de Descubrir: guarda como Pendiente y avisa con «Deshacer» (#222, bandera `QUICK_ADD`). Estado y nota desde la tarjeta de la Biblioteca, con el diálogo de la ficha (#226, bandera `LIBRARY_QUICK_EDIT`).
- **Volver** (#223, sin bandera). La fila «Continúa donde lo dejaste» y el «+1» ya existían; ahora lo que está en curso va primero y caben 12 tarjetas.
- **Invitar** (#224, sin bandera). El perfil con su imagen de enlace y la invitación con enlace firmado ya existían; la lista pública tiene ahora su propia imagen de enlace.
- **Llegar** (#225, bandera `WELCOME_RATE_FIRST`). La bienvenida empieza por puntuar: notas → nombre → recomendaciones. El alta con Google sin la casilla de edad y términos conserva el orden de siempre.

**Pendiente:**
- Encender en Vercel (producción) `QUICK_ADD=1`, `WELCOME_RATE_FIRST=1` y `LIBRARY_QUICK_EDIT=1`, redesplegar y pasar `produccion` a `on` en `banderas.json`. Las tres caducan el 16-01-2027 (60 días): antes, se quita la bandera y queda un solo camino.
- **P-Números:** repetir la medición hacia el 15-12-2026 (4 semanas) y añadirla a la línea base.
- Comprobar en Supabase que la confirmación de correo sigue apagada en producción; con ella encendida, el alta con correo no cabe en un minuto.

Lo que sigue es el encargo con el que arrancó la fase.

1. **Medir.** `docs/metricas-fase8.sql` (solo lectura, solo agregados): entradas por usuario activo, activos a 7 y 30 días, altas, de dónde vienen. Línea base antes de tocar nada.
2. **Registrar más rápido.** Añadir una obra en dos toques desde la búsqueda; cambiar estado y nota sin entrar en la ficha; deshacer.
3. **Volver.** Lista densa de «en curso»; continuar donde se dejó.
4. **Invitar.** Páginas públicas que se comparten bien (perfil y lista, con su imagen de enlace); invitación con un enlace.
5. **Llegar.** Qué necesita un visitante nuevo para registrarse: landing, alta y primera obra en menos de un minuto.

Cada punto es un PR o pocos, detrás de bandera si cambia una pantalla. Privacidad: medición agregada, sin `user_id`.

**Meta de referencia:** ≥ 12 activos a 30 días. No bloquea nada (decisión del 17-11-2026).

## 7. Fase 8.3 · Dirección visual y prototipo 3D

**Hecha el 18-11-2026.**

- **P-Gusto: pasada.** Entre tres direcciones hechas en código («Sala», «Objeto», «Pliego»), Víctor eligió «Sala» y firmó [`design/BIBLIA.md`](design/BIBLIA.md).
- **P-3D: pasada.** Víctor probó el prototipo en su móvil y su ordenador: «sí al 3D, va fluido». Veredicto y medidas en [`spikes/3d-ficha.md`](spikes/3d-ficha.md). El 3D de la ficha entra en la 8.5.
- El código de las tres direcciones y del prototipo está en la rama `proto/fase8-3-direcciones`, que no se fusiona.

**Las cinco decisiones que había que resolver al empezar** (las de las referencias de Víctor):

1. **Letras dentro del 3D:** sí, como adorno. El título real es uno, en el HTML del servidor (principio 3, reescrito).
2. **Portadas en capas con profundidad:** Víctor levantó el bloqueo de §9 sobre mapas de profundidad y copia propia. La sala usa mapas calculados de antemano; queda el riesgo de términos, asumido.
3. **Tráiler:** en la ficha, solo al pulsar y en sección aparte de la sala. El tráiler al pasar el ratón es para Descubrir (8.5) y necesita antes una preferencia que cada persona enciende o un cambio en `/privacy`.
4. **Color sacado de la imagen:** en el navegador, ajustado hasta cumplir AA en claro y oscuro; paleta neutra de respaldo.
5. **Gráficas de seguimiento:** fuera de la ficha; candidatas para perfil o biblioteca en la 8.5.

**Sale hacia la 8.4 y la 8.5:**

- Fuente de **títulos por idioma**: solo TMDB da el título traducido.
- **Anime que es película** (El viaje de Chihiro: AniList `MOVIE`, 1 episodio) no debe salir como «Anime · Episodios 1»: formato propio, sin episodios y con duración. Pedido por Víctor el 18-11-2026 para la app real.
- Obra de cine, juego o anime **sin imagen apaisada**: su imagen vertical se redimensiona para llenar la sala (biblia, §2). Sin construir.
- **Producir los mapas** para el catálogo a coste cero (GitHub Actions y almacenamiento de Supabase; propuesta en el spike).
- **Revisión de términos** antes de producción: imágenes sin rótulo de TMDB, cruce anime → TMDB, atribución doble (AniList + TMDB), copias y mapas. Texto de `/privacy` si el 3D llega a producción (borrador en el spike; se enseña a Víctor antes).
- Fondo de la pieza de libro y manga: dos variantes, sin elegir.
- La ficha de la app da 404 cuando el proveedor tarda: es del cargador real, tarea aparte.
- Sin probar: lector de pantalla real, Safari y Firefox, más dispositivos que los de Víctor.
- Hecho en la 8.4: las fuentes de «Sala» (Anybody, Instrument Sans y Noto Sans KR/JP) están en `assets/fonts/` y cargadas en los tokens y componentes (§11).

Lo que sigue es el encargo con el que arrancó la fase.

- **Tres direcciones distintas** de la ficha, en código (rama desechable), con obras reales y sus portadas: día y noche, móvil y escritorio, tres formatos y un título en escritura no latina.
- Cada dirección trae paleta, tipografía (fuentes libres, comprobadas) y trato de la portada.
- Referencias de Víctor: dadas el 18-11-2026, en §7.1.
- **Prototipo 3D de la ficha** sobre la dirección que vaya ganando: la portada real como objeto. Se prueba en los dispositivos de Víctor.
- **Portadas en el 3D** (decisión del 17-11-2026). WebGL solo puede usar imágenes que el servidor de origen permita. Carga directa donde se pueda; MangaDex, ComicVine y Steam, por el optimizador de Vercel, que ya hace esa misma copia temporal en 2D (no es un uso nuevo). `/privacy` ya lo cuenta (#173); se revisa el texto si el 3D llega a producción.
- Sale: `docs/design/BIBLIA.md` con la dirección elegida y firmada (**P-Gusto**) y `docs/spikes/3d-ficha.md` con el veredicto (**P-3D**).
- El borrador de biblia «Archivo» (PR #214) queda descartado. Las tres direcciones parten de cero.

### 7.1 Referencias y gustos de Víctor (18-11-2026)

Recogidas enseñándole una lista de webs y apps; son sus palabras, resumidas.

**Le gusta (y qué):**
- **MUBI:** la obra a pantalla completa.
- **Apple Music / Apple TV:** los colores salen de la portada.
- **Steam (biblioteca):** el tráiler al pasar por encima de la portada.
- **Cosmos:** muy limpio; portadas con animación.
- **The StoryGraph:** gráficas para seguir y analizar lo que se consume.

**No le gusta:** Letterboxd, Backloggd, Are.na y A24 (esta, por el exceso de blanco). Criterion Channel no la pudo abrir (bloqueo por país).

**Criterios:**
- **Claro y oscuro, los dos**, y que cada persona elija.
- **Con personalidad, sin llegar a recargado.**
- **Del diseño actual solo salva una cosa**, y pide mejorar su acabado: las portadas en capas que dan profundidad y sensación de 3D, con las letras fundidas dentro de la imagen, como parte de ese 3D.
- Ya constaba: no a JetBrains Mono ni a Newsreader; «Archivo» descartado.

**Qué hay que resolver al empezar la 8.3** (choca con lo escrito más arriba; decide Víctor **[P]**):
1. **Letras dentro del 3D** frente al principio 3 («ningún texto dentro del 3D»). Salida posible: el texto sigue en el HTML del servidor y la capa 3D lo repite como adorno, oculto a lectores de pantalla.
2. **Portadas en capas con profundidad** frente a §9: la copia propia de portadas y los mapas de profundidad siguen bloqueados. Hay que ver si el efecto sale sin ellos (capas a partir de la portada cargada en el navegador) o si Víctor levanta el bloqueo.
3. **Tráiler al pasar por encima:** es un uso nuevo de datos de proveedores (vídeos de TMDB, YouTube o Steam). Antes de construirlo, mirar términos y `/privacy` (texto legal).
4. **Color sacado de la portada:** comprobar el contraste AA en claro y en oscuro con cualquier portada.
5. **Gráficas de seguimiento:** no son de la ficha; candidatas para perfil o biblioteca en la 8.5.

## 8. Lo que se conserva de la v3

- Accesibilidad WCAG 2.2 AA y sus pruebas (v3 §6.3): contraste, movimiento reducido con interruptor, formato nunca solo por color.
- Presupuestos de rendimiento y CI (v3 §8.1–8.2).
- Tabla `provider_art_policy` (v3 §7.4), para la atribución y para retirar un proveedor.
- Privacidad P-1…P-11 (v3 §9.7) según se toque cada cosa.
- `LICENSES.csv` y `NOTICE` (#176).

## 9. Lo que se deja fuera

- Panel visual de tres voluntarias, estudio con cinco participantes y pruebas en seis modelos de móvil.
- Puertas G0–G6 de la v3 y el bloque 8B como compromiso.
- Encargo a asesoría jurídica: **aplazado**, como los correos. Se retoma cuando Víctor lo diga.
- ~~Copia propia de portadas, KTX2 y mapas de profundidad~~: **bloqueo levantado el 18-11-2026** (§1). Ya no quedan fuera.

## 10. Pendiente de Víctor

1. ~~Ids antiguos de Jikan que no se puedan convertir~~. Resuelto en 8.1: no había ninguno en producción (§5).
2. ~~Referencias visuales, antes de empezar 8.3~~. Dadas el 18-11-2026 (§7.1).
3. Las cinco decisiones de §7.1, al empezar la 8.3.

## 11. Fase 8.4 · Sistema y deuda de interfaz

**Hecha el 21-11-2026.** PRs #233–#266.

**Sistema «Sala»:**

- Color sacado de la imagen, ajustado a AA, y reglas medibles de la biblia (#233).
- Fuentes en `assets/fonts/` (#234) y tokens en claro y oscuro con página de Fundamentos (#236). Referencia: [`design/TOKENS.md`](design/TOKENS.md).
- Storybook como guía interna, con axe en cada historia dentro del CI (#235).
- Componentes con sus estados: botón y enlace (#238), campos (#239), póster y tarjeta de obra (#240), diálogo, avisos y estado de bloque (#241), rótulo y sala (#243).
- Carga en las páginas de `(app)` que no la tenían (#242) y `error.tsx` con el estado de error común (#244).

**Deuda heredada (antes 8A.3b de la v3):**

- Componentes partidos en piezas y hooks: WelcomeFlow, SettingsForm, ImportClient, ListDetail y ConversationClient (#246–#249, #251).
- Los `style={{}}` pasan a tokens (#252, #253). Quedan solo los que dependen de un dato (un porcentaje, un color sacado de la imagen). Un test barrera (`tests/unit/visual/inline-styles.test.ts`) guarda la lista cerrada de archivos, cuántos tiene cada uno y por qué.
- Pósteres y miniaturas a mano pasan a `PosterFrame` (#255, #265).
- Botones a mano pasan a `KButton` (#256, #257, #259, #260). El foco es un contorno visible también con colores forzados, y hay variantes `tonal` y `danger`.
- Campos a mano pasan a `KInput`, `KTextarea` y `Select`, que comparten `KField`: etiqueta, error anunciado y `aria-describedby` (#258, #261, #262).
- Un solo pie legal para la landing y la app, con Privacidad, Términos, Aviso legal y Accesibilidad en el mismo orden (#254, #264).
- La declaración de accesibilidad recoge que los fallos conocidos están arreglados (#266).
- Intermitentes vistos, apuntados en `docs/tests-intermitentes.md` (#250, #263).

**Pasa a la 8.5:**

- Sustituir pantalla a pantalla lo que aún no usa «Sala», cada pantalla detrás de su bandera.
- Decidir si `KButton` pequeño sube de 32 a 44 px (afecta a 84 botones) y unificar los colores del degradado de la ficha y de las tarjetas.

**Fallos pequeños sin arreglar** (para PRs sueltos):

- El buscador muestra el icono de imagen rota si falla una portada.
- «Buscar amigo» no tiene etiqueta accesible.
- En Descubrir: dos botones × con el mismo nombre, un error de carga que no se anuncia y el botón de pausa cambia `aria-pressed` y `aria-label` a la vez.
- El simulado de Supabase del arnés de accesibilidad no cubre los embebidos por columna ni `discover_groups`.

## 12. Fase 8.5 · Estado y desviaciones (25-11-2026)

Plan de PRs: [`fase8/8-5-pantallas.md`](fase8/8-5-pantallas.md).

### Hecho (en `master`)

| Pantalla | PRs | Bandera | Producción |
|---|---|---|---|
| Ficha | F1 #270 · F2 #273–#278 · F3 #279 · F4 #281–#283 · F5 #284–#286 · F6 (preparación) #287–#290 | `SALA_FICHA` | `prueba` |
| Biblioteca | B1 #291 · B2 #292 | `SALA_BIBLIOTECA` | `prueba` |
| Descubrir | D1 #299 · D2 #300 · nombres de plataforma #301 | `SALA_DESCUBRIR` | `prueba` |
| Inicio | I1 #303 | `SALA_INICIO` | apagada |

Ninguna pantalla ha pasado todavía P-Uso ni está al 100 %.

### Desviaciones respecto al plan

1. **Coste.** No se ha pagado nada, pero se agotaron los límites gratuitos de Vercel y la web está caída hasta la reanudación (§1, 25-11-2026). El plan solo vigilaba el presupuesto de Lighthouse, no el consumo de CPU ni de imágenes.
   - Se está analizando qué consume y se recorta en PRs pequeños.
   - MangaDex, ComicVine y Steam siguen por el optimizador (§1, 17-11-2026).
2. **En anchura, sin cerrar pantallas.** Hay cuatro pantallas en «Sala» y ninguna al 100 %. Con la caída, el margen hasta las caducidades se estrecha (ver calendario).
3. **P-Números (8.2) se aplaza.** Medir el 15-12-2026 con la web caída daría una bajada que no se debe al diseño. Se mide 4 semanas después de la reanudación.
4. **El 3D de la ficha** (3D-1 a 3D-4) no ha empezado.
5. **El hero mensual** (#269) depende del texto de `/privacy` (#271), que tiene conflictos desde el 21-11. Falta decidir en qué hueco de la 8.5 entra.
6. **El saneamiento** cerró la fase 12, pero la 10 (monitorización) sigue a medias: métricas base y errores de Sentry por semana.

### Calendario

| Fecha | Qué |
|---|---|
| ~24-12-2026 | Vercel reanuda. Se comprueba la producción y el consumo |
| 24-12 → 16-01-2027 | P-Uso de ficha, biblioteca y Descubrir (3 probadores, enlace de prueba, `f6-p-uso`) |
| antes del 16-01-2027 | Quitar las banderas `QUICK_ADD`, `WELCOME_RATE_FIRST` y `LIBRARY_QUICK_EDIT` (caducan): queda un solo camino |
| antes del 20-01-2027 | `SALA_FICHA` al 100 % y retirada de la ficha vieja y de `SalaButtonLazy`, o prórroga justificada en `banderas.json` |
| antes del 23-01-2027 | Lo mismo con `SALA_BIBLIOTECA` y `SALA_DESCUBRIR` |
| ~21-01-2027 | P-Números: 4 semanas después de la reanudación |

### Sin programar

- **Ficha:**
  - Da 404 cuando el proveedor tarda (§7).
- **Biblioteca:**
  - Orden «Actualizados hace menos» (toca servidor).
  - Gráficas de seguimiento (opcional).
- **Descubrir:**
  - Tráiler al pasar el ratón: necesita una preferencia o un cambio en `/privacy`.
- **Amigos:**
  - «Buscar amigo» sin etiqueta accesible (§11).
- **Supabase:**
  - Comprobar que la confirmación de correo sigue apagada en producción (§6).
- **Pruebas:**
  - Lector de pantalla real, Safari y Firefox (§7).
