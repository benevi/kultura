## NOW — B3.5e-2: Script de seed automatizado para kultura-test

### Qué cambia

Crear un script de seed que, dado el proyecto `kultura-test` vacío con schema aplicado, crea los usuarios de test necesarios para los tests de integración. Los usuarios deben existir tanto en `auth.users` (Supabase Auth) como en `public.users` (via trigger `handle_new_user`).

Usuarios mínimos necesarios (detectados en B3.5e-1):
- `test-user-a@example.com` / password conocida
- `test-user-b@example.com` / password conocida

El script usa `SUPABASE_TEST_SERVICE_ROLE_KEY` para llamar a la Admin Auth API (crear usuarios sin email confirmation). Solo se ejecuta contra el proyecto de test, nunca contra producción.

### Contexto (hallazgo B3.5e-1)

Supabase rechaza el dominio `@kultura.test` con `email_address_invalid`. Usar `@example.com` en su lugar. Si el proyecto de test tiene restricción de dominios, configurarlo para aceptar cualquier dominio (Settings → Auth → Email).

### Cómo sé que funciona

```bash
node scripts/seed-test.mjs
# → "Created 2 users: test-user-a@example.com, test-user-b@example.com"
npx vitest run -c vitest.integration.config.ts
# → supabase-clients: 4/4 ✓, trigger: 3/3 ✓ (o más tests en verde)
```

### Archivos que toco

- `scripts/seed-test.mjs` (nuevo)
- `docs/B3_5e_TEST_ENV.md` (actualizar sección "Tests verificados")
- `docs/DONE.md` + `docs/NOW.md`

### Cuándo paro

Cuando `npx vitest run -c vitest.integration.config.ts` muestra más tests verdes que antes de B3.5e-2, y el script de seed es idempotente (re-ejecutable sin errores).
