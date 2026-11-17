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

### Riesgos que Víctor asume (escritos para que consten)

Detalle en [`legal/terminos/README.md`](legal/terminos/README.md).

- **AniList** prohíbe su API en servicios de listas de anime y manga. KULTURA lo es en parte.
- **MangaDex** no permite enlazar sus imágenes directamente: pasan por el optimizador de Vercel (copia temporal).
- **Imágenes para compartir (OG)** con portada: varios proveedores prohíben derivados.
- **Sin respuesta escrita de ningún proveedor** mientras no se envíen los correos.
- Si un proveedor pide retirar algo, se retira en 7 días (canal de `/legal`, #179). Eso manda sobre «portadas obligatorias».

## 2. Principios

1. **La portada manda.** El diseño se construye alrededor de la portada real.
2. **2D primero.** Todo se puede hacer sin 3D. El 3D es una capa que puede faltar sin perder texto, acción ni enlace.
3. **El HTML del servidor es la fuente de verdad.** Ningún texto dentro del 3D.
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
| **8.2 Crecer** | Ver §6 | Línea base medida; acciones rápidas en producción | 3–5 |
| **8.3 Dirección visual y prototipo 3D** | Ver §7 | **P-Gusto** y **P-3D** | 2–4 |
| **8.4 Sistema y deuda de interfaz** | Tokens, tipografía y componentes de la dirección elegida; Storybook como guía interna; deuda heredada (antes 8A.3b de la v3) | Componentes con estados y sin fallos graves de accesibilidad | 4–7 |
| **8.5 Pantallas** | Rediseño pantalla a pantalla, empezando por las más usadas (ficha, biblioteca, buscar). Cada una detrás de una bandera; **P-Uso** antes del 100 %. El 3D de la ficha entra aquí si pasó P-3D | Todas las pantallas con el diseño nuevo | 5–9 |
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

Con el diseño actual, sin esperar al rediseño.

1. **Medir.** `docs/metricas-fase8.sql` (solo lectura, solo agregados): entradas por usuario activo, activos a 7 y 30 días, altas, de dónde vienen. Línea base antes de tocar nada.
2. **Registrar más rápido.** Añadir una obra en dos toques desde la búsqueda; cambiar estado y nota sin entrar en la ficha; deshacer.
3. **Volver.** Lista densa de «en curso»; continuar donde se dejó.
4. **Invitar.** Páginas públicas que se comparten bien (perfil y lista, con su imagen de enlace); invitación con un enlace.
5. **Llegar.** Qué necesita un visitante nuevo para registrarse: landing, alta y primera obra en menos de un minuto.

Cada punto es un PR o pocos, detrás de bandera si cambia una pantalla. Privacidad: medición agregada, sin `user_id`.

**Meta de referencia:** ≥ 12 activos a 30 días. No bloquea nada (decisión del 17-11-2026).

## 7. Fase 8.3 · Dirección visual y prototipo 3D

- **Tres direcciones distintas** de la ficha, en código (rama desechable), con obras reales y sus portadas: día y noche, móvil y escritorio, tres formatos y un título en escritura no latina.
- Cada dirección trae paleta, tipografía (fuentes libres, comprobadas) y trato de la portada.
- Antes de empezar, Víctor da **2 o 3 referencias** de webs o apps que le gusten. **[P]**
- **Prototipo 3D de la ficha** sobre la dirección que vaya ganando: la portada real como objeto. Se prueba en los dispositivos de Víctor.
- **Portadas en el 3D** (decisión del 17-11-2026). WebGL solo puede usar imágenes que el servidor de origen permita. Carga directa donde se pueda; MangaDex, ComicVine y Steam, por el optimizador de Vercel, que ya hace esa misma copia temporal en 2D (no es un uso nuevo). `/privacy` ya lo cuenta (#173); se revisa el texto si el 3D llega a producción.
- Sale: `docs/design/BIBLIA.md` con la dirección elegida y firmada (**P-Gusto**) y `docs/spikes/3d-ficha.md` con el veredicto (**P-3D**).
- El borrador de biblia «Archivo» (PR #214) queda descartado. Las tres direcciones parten de cero.

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
- Copia propia de portadas, KTX2 y mapas de profundidad: siguen **bloqueados** (son usos nuevos, no «lo que ya ocurre»).

## 10. Pendiente de Víctor

1. ~~Ids antiguos de Jikan que no se puedan convertir~~. Resuelto en 8.1: no había ninguno en producción (§5).
2. Referencias visuales, antes de empezar 8.3 (§7).
