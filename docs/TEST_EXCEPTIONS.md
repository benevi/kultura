# TEST_EXCEPTIONS — Tests con limitaciones documentadas

> Tests que son legítimamente inestables en el entorno actual. No se skipean — se documentan con justificación.

---

## E40 — auth.spec.ts "successful registration flow" [ROJO LEGÍTIMO → RESUELTO]

> **RESUELTO en B3.5h-AUDIT-E2E-5** (hash: pendiente — ver DONE.md): "Confirm email" desactivado en Dashboard de kultura-test (Authentication → Sign In / Providers → Email). signUp auto-confirma → `data.session` no-nulo → redirect a `/home`. 34/34 verdes. El spec no necesitó cambios de código. Esta entrada se conserva como referencia histórica del problema y su solución.

**Fecha:** 2026-05-14  
**Bloque:** B3.5h-AUDIT-E2E-4  
**Estado:** ✅ RESUELTO en B3.5h-AUDIT-E2E-5 (2026-05-14)

### Qué hace el test

Navega a `/es/login?mode=register`, rellena formulario con email único, envía, y espera una de dos señales de éxito: redirect a `/home` (auto-login) o aparición de "Revisa tu correo" (email confirmation requerida).

### Por qué falla

Supabase kultura-test (proyecto `xqvicvypoxxfbezqnkwr`, plan free) aplica rate-limit global de signUps por IP/proyecto. La suite Playwright corre chromium + mobile en paralelo. Los tests de validación de formulario (`register with mismatched passwords`, `register with short password`) también hacen submit del form y pueden consumir cuota de la API de auth. Cuando llega el test de registro, Supabase responde con `over_email_send_rate_limit` → el componente muestra "Demasiados intentos. Espera un momento e inténtalo de nuevo" → ninguna rama de éxito → test rojo.

### Fixes aplicados (no suficientes)

1. Cambio de dominio `@kultura-test.dev` → `@example.com` (AUDIT-E2E-4): Supabase ya no rechaza el email por dominio inválido. El signUp llega a Supabase. ✓
2. Email único por ejecución del test de registro (`test_reg_${Date.now()}_${random}@example.com`): no resuelve el rate-limit global. El bloqueo no es por email sino por volumen de requests. ✓ (aplicado, correcto, no suficiente)

### Fix definitivo requerido (BACKLOG E40)

Opciones por orden de preferencia:
1. Serializar tests de auth y añadir cooldown entre tests que hacen signUp (`test.describe.configure({ mode: 'serial' })`). Incierto si el cooldown de Supabase permite ejecutar en el mismo minuto.
2. Aumentar el rate-limit de signUp en kultura-test Dashboard → Authentication → Rate Limits.
3. Mover tests de validación client-side (mismatched/short) a tests que no hagan submit del form — validar solo el mensaje de error inmediato sin click en submit.

### Declaración

Este test NO se skipea. Permanece en la suite como indicador de la limitación del entorno. El test es correcto — el comportamiento esperado es real. La inestabilidad es del entorno (Supabase free tier rate-limit), no del código de la app.
