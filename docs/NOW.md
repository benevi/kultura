# NOW

> Una sola tarea activa. Si no aparece aquí, no se trabaja en ello.

---

## B3.5g-AUDIT-RLS-1 — Inventario y clasificación de policies RLS

Primera fase del bloque B3.5g (auditoría sistemática de RLS). Solo inventario y clasificación. El refactor de policies recursivas es una tarea posterior (B3.5g-AUDIT-RLS-2), a planificar con los datos en mano.

Contexto: B3.5c-3 destapó 3 capas de RLS rotas en `conversation_members` que emergieron secuencialmente. Antes de B4 (producción real con Sentry/logger/Vercel KV) hay que confirmar que no hay más recursiones latentes en las 17 tablas. Detalle completo en E27 del BACKLOG.

### Qué cambia

1. Crear `docs/RLS_AUDIT.md` con un inventario completo de las 49 policies RLS de producción.
2. Para cada policy: nombre, tabla, comando (SELECT/INSERT/UPDATE/DELETE), `qual` y `with_check` literales, y clasificación.
3. Tres clasificaciones posibles:
   - **🟢 Segura** — no consulta la propia tabla, no riesgo de recursión.
   - **🟡 Dudosa** — consulta otras tablas con RLS pero sin self-reference; revisar caso por caso.
   - **🔴 Recursiva** — `qual` o `with_check` consulta directa o indirectamente la propia tabla. Requiere refactor con SECURITY DEFINER function (patrón usado en FIX2).
4. Tabla resumen al inicio con el conteo por categoría y por tabla.
5. Lista priorizada de policies a refactorizar en B3.5g-AUDIT-RLS-2.

NO refactorizar nada todavía. NO escribir migraciones. Solo lectura + documentación.

### Cómo sé que funciona

- Existe `docs/RLS_AUDIT.md` con las 49 policies inventariadas (verificar con SQL: `SELECT count(*) FROM pg_policies WHERE schemaname = 'public'` en producción debe coincidir con el número documentado).
- Cada policy tiene clasificación 🟢/🟡/🔴 razonada en una frase.
- Tabla resumen muestra el desglose por color y por tabla.
- Existe sección "Plan de refactor para B3.5g-AUDIT-RLS-2" con las policies 🔴 listadas por prioridad.
- Hay commit `[B3.5g-AUDIT-RLS-1] docs: inventario RLS completo (49 policies clasificadas)`.

### Archivos que toco

- Crear: `docs/RLS_AUDIT.md`.
- Lectura (SQL queries vía Supabase Dashboard o CLI): tablas `pg_policies`, `pg_class`, `pg_proc` del proyecto de producción `zfrbyphzvfuvejdwjfea`.
- NO toco: ninguna policy en producción. NO se escriben migraciones en esta fase.

### Cuándo paro

PARA y reporta inmediatamente si:

- El número total de policies devuelto por `pg_policies` ≠ 49 (algo cambió respecto al snapshot de B2; investigar antes de seguir).
- Hay alguna policy con sintaxis que no entiendo bien (las funciones SECURITY DEFINER de FIX2/FIX3 ya están en el schema — esas se documentan pero no se reauditan).
- Detecto otra recursión clara (🔴) en una tabla crítica antes de terminar el inventario completo — anotarla y seguir, no romper el flujo del inventario.
- El inventario produce más de ~15 policies 🔴 — eso indicaría que B3.5g-AUDIT-RLS-2 es mucho más grande de lo previsto y conviene replantear el alcance antes de empezar el refactor.
