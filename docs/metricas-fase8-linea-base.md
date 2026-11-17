# Fase 8 · Línea base de métricas

Medida con [`metricas-fase8.sql`](metricas-fase8.sql) en producción, antes de tocar nada de la fase 8.2. Solo agregados; las definiciones (entrada, activo, alta, origen) están en la cabecera del SQL.

**Fecha de corte:** 2026-11-17 12:03 UTC.

## Cifras

| Métrica | 7 días | 30 días | Total |
|---|---|---|---|
| Usuarios activos | 0 | 1 | — |
| Entradas | 0 | 1 | — |
| Entradas por usuario activo (media / mediana) | — | 1,00 / 1,00 | — |
| Entradas de biblioteca / de diario | 0 / 0 | 1 / 0 | — |
| Altas | 0 | 1 | 4 |
| Altas confirmadas | 0 | 1 | 4 |

**Altas por semana** (lunes UTC, últimas 12 semanas): una en la semana del 2026-10-05 y una en la del 2026-11-02; el resto, cero.

**Origen de las altas:** 3 de las 4 cuentas son anteriores a la atribución (migración `20261115170001_analytics`) y salen «sin dato». Los desgloses por canal, fuente y proveedor quedan por debajo del umbral de 3 cuentas y no se detallan. Las visitas anónimas no están en la base: salen de Vercel Web Analytics.

No se cuenta la cuenta demo. Las cuentas del equipo cuentan como cualquier otra.

## Cómo leerla

- **Meta de referencia:** ≥ 12 activos a 30 días (`PLAN_FASE8.md` §6). Hoy: 1.
- Con cuatro cuentas, una diferencia de 1 o 2 activos es ruido. Para **P-Números** («no bajan respecto a la línea base») esta línea base es casi el suelo: lo que se mira es la tendencia de altas y de activos, no los decimales.
- El freno hoy es que **llega poca gente**, no que registrar sea lento: las entradas por activo no se pueden mover mientras no haya activos.
- Los activos de un corte pasado no se pueden recalcular con exactitud (`updated_at` solo guarda la última modificación). Por eso esta tabla se guarda y no se regenera.

## Repetir la medición

Cambiar la línea marcada `-- CORTE` del SQL (o dejar `now()`), ejecutar en el SQL Editor de Supabase y añadir aquí una sección nueva con su fecha. No se pega la salida en bruto de los desgloses con menos de 3 cuentas.
