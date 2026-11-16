# KULTURA

Biblioteca personal de cultura: películas, series, anime, manga, libros, cómics y videojuegos en un solo sitio, con listas, valoraciones, progreso, amistades, chat y grupos. Web con PWA, en español e inglés.

- Producto y público: [`PRODUCT.md`](PRODUCT.md).
- Reglas para trabajar en el repo: [`CLAUDE.md`](CLAUDE.md).
- Plan en curso: [`docs/PLAN_SANEAMIENTO.md`](docs/PLAN_SANEAMIENTO.md).
- Decisiones de arquitectura: [`docs/adr/`](docs/adr/).

## Arquitectura

| Pieza | Qué es |
|---|---|
| Next.js (App Router) + React | Páginas en `src/app/[locale]/` y API en `src/app/api/`. Idiomas con next-intl (`messages/es.json` y `messages/en.json`). |
| Supabase | Postgres con RLS, Auth y realtime. El esquema son las migraciones de `supabase/migrations/` ([`supabase/README.md`](supabase/README.md)). |
| Vercel | Despliegue: cada fusión a `master` va a producción. Las funciones corren en `fra1`, junto a la base (Frankfurt). Hay un cron diario (`/api/cron/daily`). |
| Proveedores | TMDB, RAWG, Steam, AniList, Jikan, MangaDex, Open Library, Google Books, Comic Vine y Wikidata. Hay un adaptador por familia y un circuito por proveedor ([ADR 0001](docs/adr/0001-catalogo-adaptadores-por-familia-y-circuito-por-proveedor.md)). |
| Upstash Redis | Límite de peticiones compartido entre instancias (`src/lib/rate-limit.ts`). |
| Sentry | Errores de cliente y servidor (`sentry.*.config.ts`, `src/lib/logger.ts`). |
| Anthropic | Recomendaciones y traducción de sinopsis, con un tope diario (`src/lib/claude/`). |

Dónde está cada cosa:

```
src/app/[locale]/    páginas (servidor por defecto)
src/app/api/         rutas: validan, autentican y llaman al servicio del módulo
src/lib/<módulo>/    lógica por módulo (library, lists, friends, chat, groups, account…)
src/lib/api/         clientes de proveedores, contratos (contracts/), errores y cliente tipado
src/components/      componentes compartidos
supabase/migrations/ esquema de la base, en orden
tests/               unit (Vitest), integration (contra kultura-test), e2e (Playwright)
docs/                plan, decisiones, banderas y operación
```

## Arrancar en local

Hace falta Node 24.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

En `.env.local` hay que rellenar, como mínimo, las variables del bloque 1:

- las tres de Supabase, con los valores de **`kultura-test`** y nunca los de producción;
- `TMDB_API_KEY`;
- `RAWG_API_KEY`.

Las demás son opcionales: cada una dice en `.env.example` qué pasa si falta. Las variables se validan al arrancar (`src/lib/env.server.ts` y `src/lib/env.public.ts`): si falta una obligatoria, el servidor no arranca y dice cuál.

Para tener una base propia en lugar de `kultura-test`, levantar Supabase en local con Docker. Los pasos están en [`supabase/README.md`](supabase/README.md).

Comprobaciones (las mismas que el CI):

```bash
npm run type-check
npm run lint
npm test
npm run build
```

Otras suites:

- `npm run test:integration`: RLS y base contra `kultura-test`; necesita las variables `SUPABASE_TEST_*`.
- `npm run test:cuj`: recorridos con Playwright contra una base real.
- `npm run test:a11y`: accesibilidad.

## Convenciones

### Contrato de la API

Una ruta saneada responde `{ data }` o `{ error: { code, message?, field? } }`. Los `code` salen del catálogo de `src/lib/api/errors.ts`.

La ruta sigue siempre los mismos pasos, con los ayudantes de `src/lib/api/route.ts`:

1. autentica (`requireUser`);
2. aplica el límite de peticiones (`rateLimit`);
3. valida con el esquema de `src/lib/api/contracts/` (`parseBody` o `parseQuery`);
4. llama al servicio del módulo (`src/lib/<módulo>/service.ts`);
5. responde (`respond`).

Las rutas que aún no están saneadas conservan su formato hasta que les toque (Q26).

### Forma de pedir datos

- **Lectura inicial:** en componentes de servidor, con Supabase.
- **Escrituras desde el navegador:** siempre `fetch` a `/api/*` a través de `apiFetch` (`src/lib/api/client.ts`). Lanza `ApiError` con el `code`.
- **Supabase en el navegador:** solo para `auth` y realtime.

### Migraciones

- Un cambio que rompe se reparte en tres PRs: **expandir, usar y contraer**. Las reglas exactas están en [`CLAUDE.md`](CLAUDE.md).
- Nunca se edita una migración ya aplicada.
- La fecha de una migración nueva va después de la última de `master` ([ADR 0006](docs/adr/0006-migraciones-con-fecha-futura.md)).
- Toda migración se aplica primero en `kultura-test`. En producción se aplica a mano, después de una copia y con un «sí» del dueño para cada una.
- `src/types/supabase.ts` va al día con las migraciones.

### Entornos

| Entorno de Vercel | Supabase |
|---|---|
| Production | producción (`zfrbyphzvfuvejdwjfea`) |
| Preview (cada PR) | `kultura-test` (`xqvicvypoxxfbezqnkwr`) |
| Development (local) | `kultura-test` (`xqvicvypoxxfbezqnkwr`) |

En el CI, la integración también corre contra `kultura-test`, y los CUJ contra un Supabase local del runner.

### Banderas

Cada bandera de entorno está en [`docs/banderas.json`](docs/banderas.json), con dueño y fecha. El CI falla si una bandera del código no está ahí, o si pasa de 60 días sin ser permanente. Al retirar una bandera, el código se queda con un solo camino.

### Otros

- Un PR pequeño por cambio: o arreglo o función, nunca las dos cosas.
- Un PR que cambia servidor y cliente a la vez sube `VERSION` en `public/sw.js`.
- El repo es público: nunca imprimir secretos ni filas de datos en logs ni en workflows.
- Los tests intermitentes se apuntan en [`docs/tests-intermitentes.md`](docs/tests-intermitentes.md).
