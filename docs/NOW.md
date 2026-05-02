## Tarea activa: B1-B — CI básico en GitHub Actions

Iniciada: pendiente
Bloqueante de: que el repo tenga checks automáticos en cada push

### Qué cambia
Workflow GitHub Actions con typecheck (tsc --noEmit) + tests unit (vitest run) + build (next build) en cada push y PR contra master.

### Cómo sé que funciona
Hacer un push trivial y comprobar que el workflow corre verde en https://github.com/benevi/kultura/actions

### Archivos que toco
.github/workflows/ci.yml (nuevo).

### Cuándo paro
Cuando un push a master dispara el workflow y termina verde.