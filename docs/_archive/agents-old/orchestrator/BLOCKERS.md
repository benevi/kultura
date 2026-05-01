# Orchestrator — BLOCKERS

Registro de problemas bloqueantes activos. Un bloqueante impide que una tarea avance.

---

## Bloqueantes activos

### BLOQ-001 — Tests de integración Supabase pendientes de entorno real

**Fecha:** 2026-04-12
**Afecta a:** auth-agent, db-agent / Fase 2 → Fase 6
**Descripción:** Los tests de integración (RLS policies, trigger `handle_new_user`, clientes Supabase SSR) están escritos pero no pueden ejecutarse sin una variable `SUPABASE_TEST_URL` apuntando a un proyecto Supabase de test real. Sin este entorno, los tests se saltan automáticamente. No bloquea el desarrollo normal pero sí la validación completa de RLS.

**Opciones:**

- Crear proyecto Supabase "kultura-test" y añadir `SUPABASE_TEST_URL` + `SUPABASE_TEST_ANON_KEY` al entorno CI
- Usar Supabase local CLI (`supabase start`) para tests locales

**Resolución:** (pendiente)
**Resuelto:** No

---

### BLOQ-002 — Tests de contrato de APIs externas — fixtures congelados

**Fecha:** 2026-04-12
**Afecta a:** api-agent / Fase 6
**Descripción:** Los 72 tests del normalizer usan fixtures hardcodeados con el formato de respuesta actual de las APIs externas. Si TMDB, Jikan, Google Books o RAWG cambian el contrato de sus respuestas, los tests siguen pasando (los fixtures tienen el formato antiguo) pero la app falla en producción. No bloquea desarrollo pero es deuda de calidad que crece con el tiempo.

**Opciones:**

- Tests de contrato con Pact (consumer-driven contract testing)
- Tests de integración ligeros: una llamada real a cada API en CI que valide la forma de la respuesta contra el schema TypeScript esperado

**Resolución:** (pendiente)
**Resuelto:** No

---

### BLOQ-003 — CSP ausente — iframe YouTube sin restricción de frame-src

**Fecha:** 2026-04-12
**Afecta a:** ui-agent / Fase 6 (antes de deploy a producción con usuarios reales)
**Descripción:** `TrailerEmbed` embebe un `<iframe>` de `youtube-nocookie.com`. Sin `Content-Security-Policy` con `frame-src https://www.youtube-nocookie.com`, el iframe puede ser bloqueado en entornos corporativos y no existe protección contra XSS vía iframes inyectados. La ausencia de CSP es una vulnerabilidad de seguridad web básica.

**Solución:**

Añadir en `next.config.mjs` via `headers()`:

```javascript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",   // next-intl + Next.js inline scripts
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://image.tmdb.org https://covers.openlibrary.org https://uploads.mangadex.org https://books.google.com data:",
    "frame-src https://www.youtube-nocookie.com",
    "connect-src 'self'",
  ].join('; ')
}
```

**Resolución:** (pendiente)
**Resuelto:** No

---

## Formato de entrada

```
## BLOQ-NNN — Título corto
**Fecha:** YYYY-MM-DD
**Afecta a:** agente/tarea
**Descripción:** Qué está bloqueado y por qué
**Opciones:** Posibles soluciones
**Resolución:** (se rellena cuando se resuelve)
**Resuelto:** Sí/No
```

---

## Bloqueantes resueltos

*(vacío al inicio)*
