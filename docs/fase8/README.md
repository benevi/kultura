# Fase 8 · Paquete de arranque

Fuente de verdad: [`../PLAN_FASE8.md`](../PLAN_FASE8.md) (v3). Este paquete **no cambia el plan**: lo convierte en listas de trabajo. Si algo de aquí contradice al plan, manda el plan; si el plan no lo dice, aquí pone «pendiente: …».

## Cuándo se usa
El día que termine el saneamiento (`PLAN_SANEAMIENTO.md`, orden `… → 9 → 10 → 12 → 8 → 11`). 8A.0 y 8A.1 pueden ir en paralelo a la cola del saneamiento porque no tocan código de producto (salvo el PR legal 8A.0-P).

## Orden de lectura
1. [`00-arranque.md`](00-arranque.md) — checklist del día 1.
2. [`decisiones-pendientes.md`](decisiones-pendientes.md) — lo que Víctor tiene que confirmar antes o durante 8A.0.
3. [`puertas.md`](puertas.md) — G0–G6: métrica, umbral, quién decide, evidencia.
4. Tarjetas de fase, en orden: [`8A.0`](8A.0.md) · [`8A.1`](8A.1.md) · [`8A.2`](8A.2.md) · [`8A.3`](8A.3.md) · [`8A.3b`](8A.3b.md) · [`8A.4`](8A.4.md) · [`8A.5`](8A.5.md) · [`8A.6`](8A.6.md) · (condicional) [`8B.1`](8B.1.md) · [`8B.2`](8B.2.md) · [`8B.3`](8B.3.md) · [`8B.4`](8B.4.md) · [`8B.5`](8B.5.md).
5. [`plantillas/`](plantillas/) — actas y correos listos para copiar.

## Convenciones
- Numeración válida: solo **8A.0–8A.6** (incluida **8A.3b**) y **8B.1–8B.5**.
- Responsable en cada tarea: **Víctor** o **Claude (agente)**. Decide siempre Víctor.
- Casillas `- [ ]`: se marcan en el PR que cierra la tarea. La tarjeta se actualiza; el plan no.
- Estimaciones en semanas de dedicación, **orientativas** (plan §4). Sin fechas límite: manda el orden de las puertas.
- Ningún gasto sin «sí» propio de Víctor (plan §2.7, §10).
- Rutas de código: comprobadas el 2026-11-13. Las que el plan crea y aún no existen van marcadas «(nuevo)».

## Dónde se guardan los artefactos
| Artefacto | Ruta |
|---|---|
| Actas del panel visual | `docs/design/panel-YYYY-MM.md` (nuevo; plantilla en `plantillas/`) |
| Biblia | `docs/design/BIBLIA.md` (nuevo) |
| Spikes | `docs/spikes/S*.md` (nuevo) |
| Investigación | `docs/research/R1.md`, `R2.md` (nuevo) |
| Revisiones de puerta | `docs/gates/Gx-revision.md` (nuevo) |
| Legal | `docs/legal/` (nuevo) |
| Operación | `docs/ops/vercel-plan.md` (nuevo) |
| Métricas | `docs/metricas-fase8.sql` (nuevo, 8A.2) |
