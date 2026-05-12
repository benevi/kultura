# NOW

> Una sola tarea activa. Si no aparece aquí, no se trabaja en ello.

---

## B3.5g-AUDIT-RLS-2 — Refactor de policies 🟡

Segunda fase del bloque B3.5g. AUDIT-1 cerrado: 0 rojas, 3 amarillas, 46 verdes.
Detalle en `docs/RLS_AUDIT.md` sección 5.

### Qué cambia

1. Eliminar policy duplicada `users can update own profile` (dejar `users_update_own`).
   Migration: `supabase migration new dedupe_users_update_policies`
2. Evaluar y documentar `conversations` INSERT `WITH CHECK: true`:
   opción (a) añadir comentario SQL justificando la decisión, o
   opción (b) restringir a `WITH CHECK (auth.uid() IS NOT NULL)`.
   **Decisión previa requerida del usuario** antes de aplicar.

### Cómo sé que funciona

- `pg_policies WHERE tablename='users' AND cmd='UPDATE'` devuelve exactamente 1 fila.
- `npm run lint && tsc --noEmit && vitest run` pasan (493 tests).
- La política de `conversations` INSERT tiene o una restricción más estricta o un comentario SQL explicando por qué `true` es intencional.
- Commits: `[B3.5g-AUDIT-RLS-2] fix: deduplicar policies UPDATE en users` + (si se elige b) `[B3.5g-AUDIT-RLS-2] fix: harden conversations INSERT policy`.

### Archivos que toco

- `supabase/migrations/` — nueva migration para dedup users.
- `supabase/migrations/` — opcional, migration conversations INSERT.
- `docs/NOW.md`, `docs/BACKLOG.md`, `docs/DONE.md` al cerrar.

### Cuándo paro

PARA si:
- La migration de dedup rompe algún test E2E de auth/settings.
- El usuario decide no hacer cambio en conversations INSERT (solo documentar en sección 6 de RLS_AUDIT.md).
