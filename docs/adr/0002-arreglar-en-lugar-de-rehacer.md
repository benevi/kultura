# ADR 0002 · Arreglar en lugar de rehacer

- **Estado**: aceptada.
- **Fecha**: 2026-11-10 (auditoría y preguntas Q1–Q33 de `docs/PLAN_SANEAMIENTO.md`).
- **Alcance**: todo el repositorio. El plan de ejecución es `docs/PLAN_SANEAMIENTO.md`.

## Contexto

La auditoría del 10-11-2026 revisó el código, la base de producción (solo lectura), la web pública, la cuenta demo, las variables de Vercel y el CI. Encontró problemas serios:

- pérdida de datos posible;
- políticas de RLS demasiado abiertas;
- falta de restricciones únicas;
- errores que no se registraban;
- datos duplicados en dos sitios (puntuación y progreso);
- muchas banderas a medio retirar.

Había dos salidas: reescribir la app desde cero o sanearla por partes.

## Decisión

**Sanear la app por fases sobre el código y el modelo de datos actuales.** No se reescribe.

- La app ya tiene usuarios y datos reales: 8 usuarios, 4 activos en los últimos 30 días. Una reescritura obligaría a migrar esos datos a un modelo nuevo y a mantener dos apps a la vez.
- El modelo de datos es salvable. Los problemas se arreglan con migraciones pequeñas que siguen el patrón expandir, usar y contraer (`CLAUDE.md`).
- Mientras dura el saneamiento no entran funciones nuevas (Q1). Cada PR es o un arreglo o una función, nunca las dos cosas.
- El rediseño de la interfaz (fase 8) es aparte: tiene su propio plan y va después de sanear los datos y la API.

## Consecuencias

- Cada cambio es un PR pequeño que se puede revertir solo, y cada fusión a `master` se despliega. Por eso las migraciones se aplican en `kultura-test` antes del PR, y en producción solo después de una copia y del «sí» del dueño.
- Las banderas que había en producción se retiraron una a una, dejando un solo camino en el código (fase 11.4). Antes, se hizo una prueba de restauración y se reforzó el CI (fase 12).
- Hay deuda que no se toca hasta la fase 8, porque es de interfaz: los `style={{}}` y los componentes grandes.
