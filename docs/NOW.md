## Tarea activa: B2 — Migraciones SQL versionadas

Iniciada: pendiente
Bloqueante de: que un dev nuevo pueda levantar el schema desde cero

### Qué cambia
`supabase db pull` contra el proyecto actual. Commitear `supabase/migrations/*.sql` incluyendo RLS policies. README en `supabase/` explicando cómo aplicar en entorno nuevo.

### Cómo sé que funciona
Un dev nuevo puede levantar un Supabase local desde cero con `supabase db reset` y el schema queda idéntico al de producción.

### Archivos que toco
`supabase/migrations/*.sql` (nuevos o actualizados), `supabase/README.md` (nuevo).

### Cuándo paro
Cuando `supabase/migrations/` contiene el schema completo con RLS policies commitado en git.
