## Tarea activa: pendiente de aprobación — Bloque 4 (Producción real)

Iniciada: pendiente de aprobación
Bloqueante de: observabilidad en producción, rate-limit distribuido, startup seguro

### Qué cambia
Bloque 4 cierra los bloqueantes de producción restantes tras B3. Candidatos priorizados del BACKLOG:
- **C3** — Rate limiting distribuido con Vercel KV (reemplaza Map en memoria).
- **C1** — Sentry integrado (errores de Route Handlers + componentes cliente).
- **C2 / E18** — Logger estructurado (`src/lib/logger.ts`) + migración de los 17 `console.error`.
- **E24** — Validación de env vars al startup con Zod (`src/lib/env.ts` + import en `app/layout.tsx`).

### Cómo sé que funciona
A definir en el prompt del Bloque 4.

### Archivos que toco
A definir en el prompt del Bloque 4.

### Cuándo paro
Hasta que el usuario apruebe el alcance del Bloque 4.
