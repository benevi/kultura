# BLOCKERS — Dependencias bloqueantes

> Formato: fecha + tarea + qué falta + alternativa propuesta. Se cierra la entrada (no se borra) cuando se resuelve.

---

## C3 — Rate limiting → Vercel KV

**Fecha:** 2026-09-11
**Tarea:** `docs/BACKLOG.md` Bloque C, C3.
**Qué falta:** C3 requiere una instancia de Vercel KV (o Upstash Redis) con credenciales (`KV_REST_API_URL`, `KV_REST_API_TOKEN` o equivalentes) para reemplazar el `Map` en memoria de `src/lib/rate-limit.ts`. Esta sesión no tiene acceso a la cuenta de Vercel/Upstash del usuario para crear el recurso.
**Alternativa propuesta:** saltar a C7 (depende declarada de C5, es 100% código) mientras se resuelve. Cuando el usuario provisione KV y comparta las env vars, se retoma C3 sin más bloqueo.
**Estado:** ABIERTO.
