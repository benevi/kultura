# KULTURA — reglas para trabajar en este repo

Responder y escribir en castellano. Un PR pequeño por cambio. El plan en curso es `docs/PLAN_SANEAMIENTO.md`.

## Cambios de esquema (base de datos)

Producción y el código desplegado nunca pueden quedar incompatibles. El código se despliega al fusionar en `master` (Vercel); las migraciones se aplican a mano en producción, después de fusionar, de una copia (`backup.yml`) y del visto bueno del dueño. Por eso un cambio que rompe se parte en **3 PRs**:

1. **Expandir.** Migración que solo añade: tabla, columna con valor por defecto o que admite `null`, función, índice. El código no la usa todavía. Se aplica en `kultura-test` antes del PR y en producción después de fusionar.
2. **Usar.** El código lee y escribe lo nuevo (y deja de usar lo viejo). Solo se fusiona cuando la migración del paso 1 **ya está en producción**.
3. **Contraer.** Migración que borra lo viejo (`drop column`, `drop table`, `drop function`). Solo cuando el código del paso 2 **ya está desplegado en producción**, y con copia antes. El CI falla si una función sigue usando la columna o si hay `CASCADE` (`scripts/check-dropped-columns.mjs`).

Cuándo se pueden juntar pasos:

- **1 + 2 en un PR** si el código nuevo no se ejecuta hasta que la migración esté en producción: detrás de una bandera apagada (registrada en `docs/banderas.json`), o si tolera que lo nuevo aún no exista. La bandera se enciende después de aplicar la migración.
- **Un solo PR** si el cambio es solo aditivo y nada lo usa todavía (un índice, una función nueva que nadie llama), o si solo endurece permisos o políticas y el código ya no dependía de lo que se quita (la integración contra `kultura-test` lo comprueba).
- **El paso 3 nunca** se junta con otro.

## Migraciones: reglas fijas

- Nunca editar una migración ya aplicada. Cualquier corrección, migración nueva.
- Fecha posterior a la última de `master` (el CI lo comprueba).
- Aplicada en `kultura-test` (`xqvicvypoxxfbezqnkwr`) antes de abrir el PR; la integración del CI corre contra esa base.
- En producción solo después de la copia manual y con un «sí» explícito para cada migración. `push` y `push_throttle` no se aplican en producción (Q14).
- `src/types/supabase.ts` al día con las migraciones (el CI lo regenera y compara).
- Cada migración concede sus permisos; las funciones `SECURITY DEFINER` llamables por la API van en `supabase/security-allowlist.json` con motivo.
- Más detalle: `supabase/migrations/README.md`.

## Otros

- Un PR que cambia servidor y cliente a la vez sube la versión del service worker (`public/sw.js`).
- Banderas con dueño y caducidad en `docs/banderas.json` (máximo 60 días; el CI lo comprueba).
- Tests intermitentes: `docs/tests-intermitentes.md`. Relanzar el CI no es arreglarlos.
- Nunca imprimir secretos ni filas de datos en los logs de los workflows (el repo es público).
