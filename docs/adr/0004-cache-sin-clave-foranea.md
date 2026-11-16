# ADR 0004 · Tablas de caché sin clave foránea a `media`

- **Estado**: aceptada (Q15). En producción desde el 11-11-2026 (fase 3).
- **Fecha**: 2026-11-10.
- **Código**: `media_translations` y `media_adaptations`. La nota está en `supabase/migrations/20261231000001_integrity_and_indexes.sql`.

## Contexto

En la fase 3 se añadieron claves foráneas e índices allí donde faltaban. Las tablas `media_translations` (sinopsis traducidas) y `media_adaptations` (adaptaciones que vienen de Wikidata) guardan datos por **id de proveedor**, por ejemplo `tmdb:123`. No los guardan por la fila de `media`.

Una ficha se puede ver, y su sinopsis se puede traducir, aunque nadie haya guardado el título en su biblioteca. En ese caso no existe ninguna fila en `media`.

## Decisión

Las dos tablas son **cachés compartidas por id de proveedor** y no llevan clave foránea a `media`.

- Las claves no apuntan a ninguna fila de la base:
  - en `media_adaptations`, la clave es el id del título en el proveedor, en texto;
  - en `media_translations`, es un `cache_key` que incluye el hash del texto original. Si el proveedor cambia la sinopsis, la entrada vieja deja de coincidir y el texto se vuelve a traducir.
- Solo el servidor (service role) lee y escribe. Tienen RLS activo y ninguna política.

## Consecuencias

- Una entrada puede quedar huérfana si el título desaparece del proveedor. Es una caché: se ignora o se vuelve a calcular, y no rompe nada.
- Se renuevan por tiempo o por contenido, no por cascada. `media_adaptations` tiene `expires_at`, y las traducciones cambian de clave cuando cambia el texto original.
- Una tabla nueva que dependa de `media` sí debe llevar clave foránea. Esta excepción vale solo para las cachés por id de proveedor.
