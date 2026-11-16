# ADR 0006 · Migraciones con fecha futura: no se renombran

- **Estado**: aceptada (Q13).
- **Fecha**: 2026-11-10.
- **Código**: `scripts/check-migration-order.mjs`, que corre en el paso «Orden de las migraciones» de `ci.yml`.

## Contexto

Ocho migraciones tenían en el nombre una fecha de diciembre de 2026 (`202612xx…`) que todavía no había llegado. Ya estaban aplicadas en producción, y Supabase guarda en `schema_migrations` la versión con el nombre exacto.

Una migración nueva con la fecha real (noviembre) quedaría **por delante** de ellas en el orden. `supabase db push` y la aplicación a mano se la saltan sin avisar.

## Decisión

- **Las migraciones ya aplicadas no se renombran.** Renombrarlas descuadra el historial de `schema_migrations` en producción.
- Las migraciones nuevas se numeran después de la última que existe (`20261230000001`, `…02`, …), hasta que el calendario alcance esas fechas.
- El CI falla si una migración nueva tiene una fecha anterior a la última de `master`.

## Consecuencias

- La fecha del nombre de una migración no indica cuándo se escribió: solo marca el orden.
- La regla «fecha posterior a la última de `master`» está en `CLAUDE.md` y el CI la comprueba.
- Cuando el calendario pase de las fechas usadas, se vuelve a numerar con la fecha real sin cambiar nada más.
