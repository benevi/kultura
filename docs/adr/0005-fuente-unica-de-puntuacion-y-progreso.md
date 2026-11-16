# ADR 0005 · Una sola fuente para la puntuación y el progreso

- **Estado**: aceptada (Q23). En producción desde el 12-11-2026.
- **Fecha**: 2026-11-10.
- **Código**: migraciones `20261231000004` (fuera `score`) y `20261231000005` (fuera `episode_progress`), y los PRs #135 a #140.

## Contexto

`user_media` guardaba dos datos por partida doble:

- **La puntuación**, en `score` (escala antigua) y en `rating10` (de 1 a 10, bandera `RATING_SCALE_10`).
- **El progreso**, en el JSON `episode_progress` y en las columnas `progress_*` (bandera `PROGRESS_V2`). Un disparador, `user_media_sync_progress`, intentaba mantener las dos versiones iguales.

Las dos copias podían quedar distintas, y cada lectura tenía que elegir una.

## Decisión

Para cada pareja de datos queda **una sola fuente**:

- `rating10` sustituye a `score`;
- las columnas `progress_*` sustituyen a `episode_progress`, y desaparecen también `progress_updated_at` y el disparador.

Cada cambio se hizo en tres PRs, siguiendo `CLAUDE.md`:

1. el código lee solo de la columna nueva;
2. el código deja de escribir en la vieja;
3. una migración borra la vieja, con copia antes y cuando el paso 2 ya estaba desplegado.

## Consecuencias

- La API sigue aceptando y devolviendo `episodeProgress` para los clientes que tengan el código en caché. Por dentro, se traduce a las columnas.
- Las banderas `RATING_SCALE_10` y `PROGRESS_V2` se retiraron después, encendidas, y el código quedó con un solo camino (fase 11.4).
- No se puede volver a la escala antigua sin una migración.
