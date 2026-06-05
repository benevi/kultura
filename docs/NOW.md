# NOW
> Una sola tarea activa.

## Estado

E67 → ✅ **CERRADA 2026-06-05** (commit código `6d30a42`). Test pollution fix: split del bloque parser de `tests/unit/ai/ai-recommendations.test.ts` a `tests/unit/ai/recommendations-parser.test.ts` (carga el módulo REAL, sin mock de `@/lib/claude/recommendations`), fixtures anidadas reales para `getLibraryContext`. tsc 0, lint 0, vitest **639 passed**, determinista en shuffle seeds 12345 (antes 5 fail) y 99999.

E62/E63/E64 → ✅ **CERRADAS 2026-06-05** (commit código `47becaf`). Tres fixes de deuda: E62 `res.ok` en las 3 mutaciones de `ListDetail` (cerrada completa, era el único archivo afectado según Fase 0), E63 `useState` muerto en `ListsClient` + `router.refresh()` en `CreateListModal`, E64 tokens DS en `RecommendModal`. tsc 0, lint 0, vitest 639 passed.

E45 → ✅ **CERRADO COMPLETO 2026-06-04** (a✅ b✅ c✅ d✅). E45-d cerrado: d.1 backend (commit 410340c) + d.2 UI (commit d96e40f). Invitaciones a grupos funcionando end-to-end: owner invita amigos vía modal, invitee acepta/rechaza desde notificaciones, trigger da el alta. vitest 639 passed, i18n paridad 465=465.

## Tarea activa

**(ninguna)** — esperando confirmación del usuario para elegir la siguiente del BACKLOG.

Nota: smoke test manual de la ruta crítica E45-d se saltó por decisión del usuario (requería 2 cuentas logueadas + verificación del trigger en Supabase prod). Pendiente como validación funcional post-deploy (regla #11 CLAUDE.md) si se quiere confirmar en prod.
