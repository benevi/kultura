## NOW — Sprint B3.5: auditoría funcional UI/UX

B3 cerrado y desplegado. Antes de B4 (Producción real) hay que hacer una
auditoría funcional de la app, porque la UI está más incompleta de lo que
reflejaba la auditoría inicial estática.
Detalles del sprint pendientes de definir en próxima sesión de planificación.

---

## Aparcado para B4

Bloque 4 cierra los bloqueantes de producción restantes tras B3. Candidatos priorizados del BACKLOG:

- **C3** — Rate limiting distribuido con Vercel KV (reemplaza Map en memoria).
- **C1** — Sentry integrado (errores de Route Handlers + componentes cliente).
- **C2 / E18** — Logger estructurado (`src/lib/logger.ts`) + migración de los 17 `console.error`.
- **E24** — Validación de env vars al startup con Zod (`src/lib/env.ts` + import en `app/layout.tsx`).
