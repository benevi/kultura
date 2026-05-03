# Plan de despliegue B3 — Hardening de seguridad

**Fecha de preparación:** 2026-05-03
**Bloque:** B3 — Hardening de seguridad básico pre-producción

---

## HSTS — gestionado por Vercel (verificado 2026-05-03)

**Vercel añade automáticamente `Strict-Transport-Security: max-age=63072000`** en este proyecto. Confirmado en producción el 2026-05-03.

**NO añadir HSTS en `next.config.mjs`** — produciría header duplicado con valores conflictivos. Si en el futuro Vercel deja de gestionarlo (cambio de plan, migración, etc.), reactivar con `max-age=63072000; includeSubDomains; preload` (alineado con lo que Vercel hacía).

---

## Cambios que llegan a producción

### Rate-limit añadido (6 endpoints)
| Endpoint | Límite |
|---|---|
| `POST /api/chat` (crear conversación) | 10/hora por usuario |
| `POST /api/chat/[id]` (enviar mensaje) | 10/min por usuario |
| `GET /api/chat/[id]` (leer mensajes) | 60/min por usuario |
| `POST /api/groups` (crear grupo) | 5/hora por usuario |
| `POST /api/suggestions` (sugerencia) | 3/hora por usuario |
| `GET /api/users/search` | 30/min por usuario |

Todos devuelven HTTP 429 + header `Retry-After` al superar el límite.
Sistema en memoria (`Map`): efectivo en single-instance. Multi-instancia → C3 (Vercel KV).

### Headers de seguridad añadidos (`next.config.mjs`)
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`

### Headers ya existentes (sin cambios)
- `Content-Security-Policy` (enforce) con `'unsafe-inline'` en script-src (ver C7 en BACKLOG)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Headers gestionados por Vercel (no en código)
- `Strict-Transport-Security: max-age=63072000` — Vercel lo añade automáticamente

---

## Pre-deploy checklist (usuario)

- [x] Zip `kultura-backup-2026-05-01.zip` borrado
- [x] `npm run build` local: ✅
- [x] `npm run dev` + DevTools headers visibles: ✅
- [x] Login + chat funciona en local: ✅
- [x] HSTS verificado en producción: gestionado por Vercel ✅

---

## Deploy

```bash
git push origin main
```

Vercel detecta el push y despliega automáticamente (~2-3 min).

---

## Post-deploy verificación

1. Abrir el dominio de producción.
2. DevTools → Network → primera request → Response Headers. Verificar:
   - [ ] `Strict-Transport-Security` presente (gestionado por Vercel, ya existía)
   - [ ] `Permissions-Policy` presente ← NUEVO
   - [ ] `Content-Security-Policy` presente (ya existía)
3. DevTools → Console → buscar errores/warnings de CSP. Si aparece alguno sobre un dominio externo no listado, anotarlo y abrir issue.
4. Test funcional manual:
   - [ ] Login funciona
   - [ ] Feed carga
   - [ ] Abrir un grupo
   - [ ] Mandar un mensaje en chat
5. Test rate-limit en producción (opcional):
   - Enviar 11 mensajes seguidos en chat en menos de 1 minuto.
   - El mensaje 11 debe devolver 429 (visible en DevTools → Network → Status 429).

---

## Rollback

Si algo se rompe en producción tras el deploy:

```bash
git revert <hash_commit_b3>
git push origin main
```

Vercel hace redeploy automático con la versión anterior. Tiempo estimado: ~3 min.

Alternativamente: Vercel Dashboard → Deployments → deploy anterior → "Promote to Production" (instantáneo, sin nuevo build).

---

## Notas adicionales

- **CSP `'unsafe-inline'`:** se mantiene en esta versión. Eliminarlo requiere nonces (tarea C7 en BACKLOG). No bloquear el deploy por esto.
- **Rate-limit en memoria:** no persiste entre instancias de Vercel ni entre deploys. Mejor que nada, pero no es la solución final. La solución distribuida es C3 (Vercel KV).
