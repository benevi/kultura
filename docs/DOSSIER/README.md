# DOSSIER TÉCNICO — KULTURA

> Documento multi-capítulo que explica qué es Kultura, por qué existe, cómo está construido, cómo se ha construido y cómo se opera. Dirigido a: programadores júnior que se incorporan, audiencias mixtas (técnico/no técnico) en presentaciones, y como material de aprendizaje.

## Estado

**Fase 1 — esqueleto.** Los capítulos están vacíos, pendientes de redacción (Fase 2). Este aviso se retirará cuando todos estén redactados y verificados.

## Cómo leerlo

- **No técnico / con prisa:** capítulo 00 y las secciones "Resumen en 5 líneas" de cada capítulo.
- **Júnior incorporándose:** 00 → 10 (arranque) → 02 → 03 → 04 → 05, y el resto según necesidad.
- **Presentación del proyecto:** 00 → 01 → 11 → 13.

Cada afirmación técnica lleva referencia a fichero:línea, migración, commit o doc. Lo no verificado está marcado `⚠️ NO VERIFICADO`.

## Índice

| Capítulo | Contenido |
|---|---|
| [00 — Resumen ejecutivo](./00-RESUMEN-EJECUTIVO.md) | Qué es Kultura, problema que resuelve, estado actual. Legible por no técnicos |
| [01 — Visión y producto](./01-VISION-Y-PRODUCTO.md) | Funcionalidades reales una a una, alcance construido vs no construido |
| [02 — Arquitectura](./02-ARQUITECTURA.md) | Diagramas C4, stack con versiones y porqués, vida de una petición |
| [03 — Estructura del código](./03-ESTRUCTURA-DEL-CODIGO.md) | Árbol comentado, convenciones, cómo añadir una feature |
| [04 — Modelo de datos](./04-MODELO-DE-DATOS.md) | ER completo, 18 tablas, funciones, triggers, historial de migraciones |
| [05 — Seguridad](./05-SEGURIDAD.md) | Auth, RLS policy a policy, secretos, rate limiting, headers/CSP |
| [06 — Integraciones externas](./06-INTEGRACIONES-EXTERNAS.md) | Las 7 APIs externas, normalizer, caché, manejo de errores |
| [06b — API interna](./06b-API-INTERNA.md) | Los 23 route handlers: método, auth, validación, rate limit, errores |
| [07 — Diseño y UI](./07-DISENO-Y-UI.md) | Sistema de diseño, componentes DS vs legacy, capturas |
| [08 — Calidad y tests](./08-CALIDAD-Y-TESTS.md) | Estrategia de 4 niveles, cómo ejecutar, gaps honestos |
| [09 — Infra y despliegue](./09-INFRA-Y-DESPLIEGUE.md) | Entornos, variables de entorno, deploy, rollback |
| [10 — Guía de arranque](./10-GUIA-DE-ARRANQUE.md) | De cero a app corriendo en local, paso a paso |
| [11 — Historia del proyecto](./11-HISTORIA-DEL-PROYECTO.md) | Cronología por bloques A→F, decisiones y lecciones |
| [12 — Metodología](./12-METODOLOGIA.md) | NOW/BACKLOG/DONE, principios de depuración, rol de la IA |
| [13 — Estado y deuda](./13-ESTADO-Y-DEUDA.md) | Estado real hoy, deuda priorizada, riesgos |
| [14 — Glosario](./14-GLOSARIO.md) | Todo término técnico, definido en llano |
| [99 — Capturas pendientes](./99-PENDIENTE-CAPTURAS.md) | Lista consolidada de capturas que debe aportar el usuario |

## Convenciones del dossier

- Fuentes citadas como `src/lib/foo.ts:42`, `supabase/migrations/2026...sql`, commit `abc1234` o `docs/X.md §Y`.
- Diagramas en Mermaid embebido (renderizan en GitHub), cada uno con su lectura en prosa.
- Capturas pendientes: placeholder `![Pendiente: ...](./img/<id>.png)` + bloque `<!-- CAPTURA PENDIENTE -->`, consolidadas en el capítulo 99.
- Si la documentación del repo (`BACKLOG.md`, `NOW.md`, `DONE.md`, `CLAUDE.md`) contradice al código, manda el código; la contradicción queda registrada en el capítulo 13.
