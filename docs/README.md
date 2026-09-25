# Documentación de Kultura

> Documentación completa del proyecto: **qué es, cómo está construido y cómo se ha
> construido**. Escrita para un programador júnior que quiere entender todo lo que se
> ha hecho, sin dar nada por sabido.

## Estado

| Fase | Qué es | Estado |
|---|---|---|
| **A. Extracción** | Inventario de todo lo que hay que documentar → [`_trazabilidad.md`](./_trazabilidad.md) | ✅ hecha |
| **B. Redacción** | Un capítulo por commit, en el orden de abajo | ⏳ pendiente |
| **C. Cobertura** | Script que comprueba que cada fila de la matriz aparece en algún capítulo | ⏳ pendiente |
| **D. Contraste** | Lo que los docs antiguos dicen y el código contradice → capítulo 13 | ⏳ pendiente |
| **E. Mantenimiento** | Regla en `CLAUDE.md`: cada feature/fix actualiza su capítulo | ⏳ pendiente |

## Reglas de la documentación

1. **Manda el código.** Si un doc antiguo dice una cosa y el código otra, gana el código y
   la discrepancia se apunta en el capítulo 13. (Por eso se borraron los docs antiguos en
   `ab8eb4e`: habían dejado de coincidir con el código.)
2. **Cada afirmación lleva su fuente**: `src/lib/foo.ts:42`, commit `abc1234`, migración
   `supabase/migrations/…sql`, o doc antiguo `git show ab8eb4e^:docs/X.md`.
   Lo que no se pueda verificar se marca `⚠️ NO VERIFICADO`.
3. **Tono didáctico.** Cada capítulo empieza con *"qué es esto y por qué importa"* y explica
   cada concepto técnico (RLS, middleware, SSR…) la primera vez que aparece, con enlace al
   glosario.
4. **Nada se pierde.** Todo elemento de `_trazabilidad.md` tiene que acabar citado en algún
   capítulo. La Fase C lo comprueba automáticamente.

## Capítulos (previstos)

| # | Capítulo | De qué trata |
|---|---|---|
| 00 | Resumen ejecutivo | Qué es Kultura y en qué estado está, en 2 páginas |
| 01 | Visión y producto | Cada funcionalidad, una a una, tal como la ve el usuario |
| 02 | Arquitectura | Next.js + Supabase + APIs externas + Claude: cómo encajan; vida de una petición |
| 03 | Estructura del código | Árbol de carpetas comentado; cómo añadir una feature |
| 04 | Modelo de datos | Las 18 tablas, relaciones, RLS, las 13 migraciones |
| 05 | Seguridad | Auth, RLS, CSP, rate limit, secretos, legal (privacidad, borrar/exportar cuenta) |
| 06 | Integraciones externas | TMDB, Jikan, RAWG, ComicVine, Open Library, MangaDex, Claude; filtros de Descubrir |
| 06b | API interna | Los 25 endpoints: qué hacen, quién puede llamarlos, errores |
| 07 | Diseño y UI | Sistema F0, componentes, las 17 pantallas |
| 08 | Calidad y tests | Unit / integración / contrato / E2E: qué cubre cada uno y cómo ejecutarlos |
| 09 | Infra y despliegue | Vercel, CI, Sentry, variables de entorno |
| 10 | Guía de arranque | De cero a la app corriendo en tu máquina |
| 11 | Historia del proyecto | Cronología completa: SPEC-001 → bloques A–G → épicas E## → rediseño F0 |
| 12 | Metodología | Agentes, NOW/BACKLOG/DONE, principios de depuración, cómo se trabaja con IA |
| 13 | Estado y deuda | Qué funciona hoy, qué falta, riesgos, contradicciones encontradas |
| 14 | Glosario | Cada término técnico explicado en llano |
| 15 | Registro de decisiones | Cada decisión importante: contexto, opciones, qué se eligió y por qué |
| — | Anexo: índice de épicas | Cada ID (E59, B3.5f…) → qué fue, commits, capítulo donde se explica |

## Ruta de lectura recomendada (para aprender)

1. **00** Resumen → **14** Glosario (hojéalo, vuelve a él cuando lo necesites)
2. **10** Guía de arranque: pon la app en marcha antes de leer teoría
3. **01** Producto → **02** Arquitectura → **03** Estructura del código
4. **04** Datos → **05** Seguridad → **06/06b** APIs
5. **07** Diseño → **08** Tests → **09** Infra
6. **11** Historia → **15** Decisiones → **12** Metodología → **13** Estado

## Orden de redacción

Primero los que dependen de los docs borrados (**11**, **15**, anexo de épicas); después los
técnicos que salen del código (**04, 05, 06, 06b**); luego **01, 02, 03, 07, 08, 09, 10**; y
al final **00, 12, 13, 14**, que resumen todo lo demás.

## Fuentes

- Código, migraciones y tests del repo (fuente de verdad).
- Historial git completo (386 commits, 2026-04-12 → hoy).
- Docs de proceso borrados en `ab8eb4e`, recuperables con
  `git show ab8eb4e^:<ruta>` (lista completa en `_trazabilidad.md` §C).
- PRs `benevi/kultura#1`…`#5`.
- Canvas de diseño "Kultura Editorial" y "Kultura — Diseño completo" (ver `CLAUDE.md`).

**Límite conocido:** las conversaciones con Claude de cada sesión no son accesibles; de ellas
solo quedan los enlaces `Claude-Session:` en los commits. El "porqué" sale de los mensajes de
commit, de los docs antiguos o de preguntarle al autor.

## Regenerar la matriz

```bash
python3 scripts/docs/build-trazabilidad.py
```
