# SUPABASE_TEST_SETUP — Configuración del proyecto kultura-test

> Config que vive solo en el Dashboard de Supabase y no está versionada en el repo.
> Actualizar este archivo cuando se cambie algo en el Dashboard.

---

## Proyecto

- **Nombre:** kultura-test
- **Ref:** `xqvicvypoxxfbezqnkwr`
- **Plan:** Free tier
- **Uso:** Exclusivo para tests E2E (Playwright) y de integración (Vitest).

---

## Configuración activa

### Authentication → Sign In / Providers → Email

| Setting | Valor en kultura-test | Valor en producción | Motivo de diferencia |
|---|---|---|---|
| Enable Email Provider | ✅ activado | ✅ activado | igual |
| **Confirm email** | ❌ **desactivado** | ✅ activado | Tests E2E necesitan auto-login inmediato. Sin auto-confirm, signUp emite email y el test queda bloqueado esperando confirmación que nunca llega. |
| Secure email change | — | ✅ activado | no verificado en test |

**Cambiado en:** B3.5h-AUDIT-E2E-5 (2026-05-14) por el humano.  
**Efecto:** `supabase.auth.signUp()` devuelve `data.session` no-nulo → el componente redirige a `/home` sin pasar por la rama "Revisa tu correo".

---

## Rate limits del plan free (inamovibles)

Estos límites son tope duro del plan free de Supabase. No se pueden aumentar sin cambiar de plan.

| Recurso | Límite |
|---|---|
| Emails enviados | 2 / hora (global por proyecto) |
| signUp requests | Aplica rate-limit global por IP/proyecto en suite paralela |

**Implicación para tests:** Los tests que hacen `signUp` real contra kultura-test deben evitar disparar el rate-limit. Con "Confirm email" desactivado, el signUp no emite email → el límite de 2 emails/h no aplica para los tests de validación (que fallan antes del signUp por validación client-side). El test de registro exitoso usa un email único por ejecución.

---

## Schema

Baseline aplicada: `supabase/migrations/20260502233945_remote_schema.sql`  
17 tablas / 49 RLS policies / 4 funciones trigger — idéntico a producción.

---

## Variables de entorno asociadas (no en git)

Definidas en `.env.test.local` (cubierto por `.env*.local` en `.gitignore`):

```
NEXT_PUBLIC_SUPABASE_URL=     # URL de kultura-test
NEXT_PUBLIC_SUPABASE_ANON_KEY= # anon key de kultura-test
SUPABASE_TEST_URL=            # igual a NEXT_PUBLIC_SUPABASE_URL
SUPABASE_TEST_ANON_KEY=       # igual a NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_TEST_SERVICE_ROLE_KEY= # service_role de kultura-test (solo seed/migraciones)
```

`playwright.config.ts` sobreescribe `NEXT_PUBLIC_SUPABASE_*` con los valores de kultura-test en `webServer.env` para que el dev server de Playwright apunte a kultura-test en vez de producción.
