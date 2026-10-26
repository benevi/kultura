# ADR 0001 · Catálogo: un adaptador por familia y un circuito por proveedor

- **Estado**: aceptada (en `master` desde el PR #53, F-32; la capa HTTP desde F-07 y F-13).
- **Fecha**: 2026-10-26.
- **Código**: `src/lib/api/families/*`, `src/lib/api/discover.ts`, `src/lib/api/aggregate.ts`, `src/lib/api/http.ts`.

## Contexto

KULTURA enseña siete familias de títulos (cine, series, anime, manga, libros, cómic y videojuegos) que salen de nueve proveedores externos: TMDB, RAWG, Steam, AniList, Jikan, MangaDex, Open Library, Google Books y Comic Vine, y Wikidata para las adaptaciones de la ficha.

Antes del refactor, `discover.ts` tenía 560 líneas con una rama por familia, tres `as unknown as` y la lógica común (tope de páginas, NSFW, errores, total fiable o no) repetida en cada rama. Cada cliente hacía su propio `fetch → if (!ok) throw → res.json() as T`, sin plazo, sin validar la respuesta y sin memoria de fallos. En producción se vio lo que eso cuesta:

- un proveedor colgado tenía la función ocupada hasta que Vercel la cortaba;
- RAWG dejó de mandar un campo y la respuesta "válida" se guardaba una hora sin que nadie se enterase;
- con AniList devolviendo 403 durante días, cada petición de anime lo volvía a intentar antes de ir al respaldo.

## Decisión

### 1. Un adaptador por familia (`src/lib/api/families/`)

Cada familia implementa la misma interfaz (`FamilyAdapter`, en `families/types.ts`):

```ts
interface FamilyAdapter {
  maxPages?: number;                       // techo de páginas (por defecto DISCOVER_MAX_PAGES)
  discover(page, filters, locale): Promise<FamilyPage>; // una página; lanza si el proveedor falla
  hasActivePostFilter(filters): boolean;   // ¿el total del proveedor ya no es fiable?
}
```

- `FAMILY_ADAPTERS` (`families/index.ts`) asocia cada `MediaType` con su adaptador; un tipo desconocido cae a cine.
- El adaptador decide su proveedor y su **respaldo**. El de anime pide a AniList y, si falla, a TMDB; si el respaldo tampoco da nada, propaga el error **original** (un 429 de AniList se sigue presentando como «limitado, reintenta»).
- Lo propio de cada proveedor (ventanas de Open Library y Comic Vine, recorte de años futuros, portada obligatoria) vive en su adaptador, junto al comentario que lo explica.
- `discover.ts` (menos de 150 líneas) solo elige el adaptador y aplica lo común: tope de páginas, modo búsqueda, filtro NSFW, `totalPages: null` si hay post-filtro activo y la presentación de errores (`families/errors.ts`).
- `aggregate.ts` (`type=all`) reparte la petición entre las siete familias con el mismo `fetchDiscoverData`, mezcla y ordena. Si falla alguna familia, el resultado lleva `partial: true` y `/api/discover` responde `Cache-Control: no-store`: una página a medias nunca se queda en el CDN.

Añadir una familia o cambiar de proveedor es un archivo nuevo en `families/` y una línea en el registro; el resto del catálogo no se toca.

### 2. Un circuito por proveedor (`src/lib/api/http.ts`)

Todas las llamadas a proveedores pasan por `providerFetch(provider, url, opciones)`:

1. **Plazo**: 6 s por intento (8 s como máximo) y 8 s en total con el reintento. `AbortController` y carrera con un temporizador: aunque el proveedor ignore la señal, la petición termina.
2. **Reintento** solo ante 5xx, solo si el cliente lo pide y solo si queda presupuesto.
3. **Contrato** con Zod, siempre permisivo (`looseObject`). Con `PROVIDER_CONTRACT_MODE=log` (por defecto) una respuesta que no cumple se avisa y se sirve; con `enforce`, se rechaza y no se guarda en caché.
4. **Errores dentro del cuerpo** (`status_code` de Comic Vine, `errors[]` de AniList con HTTP 200): se lanzan y no se cachean.
5. **Circuit breaker por proveedor** (`PROVIDER_IDS`): 5 fallos en 5 minutos lo abren 10 minutos. Abierto, la petición falla al instante, sin llamar al proveedor, y el adaptador salta a su respaldo. Pasado el plazo queda medio abierto: una sola petición de prueba decide si se cierra o vuelve a abrirse. Una prueba **cancelada** (el usuario cambió de página) solo libera el turno; no cuenta como acierto. Al abrirse se avisa a Sentry con la etiqueta `provider`.
6. **Caché**: `unstable_cache` envuelve todo lo anterior, así que solo se guarda lo que ha pasado las comprobaciones.
7. **User-Agent** con la URL real del proyecto y `PROVIDER_CONTACT`.
8. **Cupos**: cada petición real suma en un contador por proveedor (RAWG 20.000 al mes, Comic Vine 200 por hora y recurso), compartido entre instancias si hay Upstash, con aviso al 80 % y al 100 %. Por encima del 80 % de Comic Vine, `type=all` deja fuera el cómic (D-17).

El estado del circuito vive en la memoria de cada instancia. Una instancia caliente de Vercel atiende muchas peticiones seguidas, que es justo el caso que importa (una ráfaga contra un proveedor caído).

### 3. Observabilidad

`/api/health?deep=1` lanza una sonda barata por proveedor (también Wikidata) con el mismo `providerFetch`, sin caché de datos, y guarda el informe una hora. Devuelve el estado del circuito de cada uno, el tipo de fallo y el código HTTP, nunca la URL ni la clave. UptimeRobot vigila `"ok":true`.

## Alternativas descartadas

- **Seguir con una rama por familia en `discover.ts`**: cada cambio común se repetía siete veces y los casts escondían diferencias reales entre proveedores.
- **Un circuito global o por familia**: una familia puede tener dos proveedores (anime: AniList y TMDB). Abrir el circuito de la familia cortaría también el respaldo que sí funciona.
- **Circuito compartido entre instancias en Redis**: cuesta una ida y vuelta por petición. Se puede añadir sin cambiar la API de `providerFetch` si algún día hace falta.
- **Librería externa de resiliencia**: el comportamiento que se necesita cabe en un archivo probado y sin dependencias nuevas.

## Consecuencias

- Un proveedor caído cuesta como mucho 5 peticiones lentas por instancia cada 10 minutos; el resto salta a su respaldo o recibe un error claro al instante.
- Un cambio de forma en un proveedor se ve en los logs y en Sentry desde la primera respuesta, sin tirar el catálogo.
- Los tests de cada adaptador se escriben contra su interfaz (`tests/unit/catalogo`, `tests/unit/discover`) y los de la capa HTTP contra `providerFetch` (`tests/unit/providers`).
- El circuito por instancia significa que una instancia nueva vuelve a probar un proveedor caído: aceptado a cambio de no depender de Redis en cada petición.
