# HANDOVER — última sesión (2026-11-06)

**Fase:** F0 (`PLAN_ESTRATEGICO.md` §7.3). **Rama:** `test/f0-cuj-bd-real` → PR #70 (abierto, sin merge).

## Hecho en esta sesión
- Entregable: **red de pruebas CUJ con BD real**. Los 8 CUJ de `FUNCIONES_V2.md` §6 están en `tests/e2e/cuj/`, uno por archivo: registro, entrar, buscar y añadir, estado y progreso, lista y compartir, perfil público, importar CSV y exportar. Registro y entrar se prueban también a 390 px.
- `supabase/config.toml` nuevo, solo para `supabase start`. Postgres 17, como producción. Confirmación por correo desactivada. Límite de altas e inicios de sesión subido a 1000.
- La app se construye y arranca con `next build` + `next start` contra Supabase local. TMDB responde con datos fijos y la búsqueda filtra por la consulta (`tests/e2e/cuj/offline-fetch.cjs`); el resto de proveedores devuelve 503. `env.cjs` aborta si la URL no es local.
- `bypassCSP` solo en el navegador de los tests: la CSP de producción no deja hablar con `http://127.0.0.1:54321`.
- Banderas encendidas en los CUJ: `PROGRESS_V2=1` y `RATING_SCALE_10=1`. Se prueba el camino con las migraciones aplicadas.
- Job `cuj` en `ci.yml`, en cada PR: `supabase start` con todas las migraciones, `scripts/seed-test.mjs`, build y Playwright. Sin secretos.
- `b3_5e` no se borra. Descubrir e idioma corren también en el job, con el usuario de `seed-test.mjs`. Los de Descubrir simulan `/api/discover`: prueban la UI y el i18n, no la BD.
- Revisión independiente registrada en `04_DECISIONES` §4: 3 graves y 9 menores corregidos.

## Verificación
- Local (Windows, sin Docker): `tsc` y lint limpios; Playwright reconoce los 17 CUJ (8 recorridos en 1440 y 390) y, con el usuario del seed, los 10 de `b3_5e`.
- 1.ª ejecución en CI: las migraciones se aplican limpias en Supabase vacío y 7 de los 8 CUJ pasan. Fallaron «perfil público» (G1) y los `b3_5e` (G2), ambos ya corregidos. **El estado final del job está en el PR #70**: se da por hecho solo si está en verde.
- Aviso no bloqueante en el log: `library/progress` no encuentra la temporada de TMDB (el fixture no tiene `/3/tv/:id/season/:n`).

## Pendiente de Víctor
- OK para el squash-merge del PR #70.
- GitHub → Settings → Branches: marcar `CUJ con BD real` como check obligatorio en `master`.
- Lo de la sesión anterior sigue igual: `service_role` de `kultura-test` en `.env.development.local`, CLI enlazada a `kultura-test` y los paneles de F0 (D3/D4/D8, Web Analytics, clave `age`).

## Siguiente entregable propuesto (uno)
PR de rescate de F0: mover los 11 `.ts` de `app/[locale]` a `src/lib/` y extraer `useAuthFlow` y `useAccountSettings`. Sin cambios de comportamiento; los CUJ hacen de red. Modelo: Sonnet 5.5 (mecánico, con plan aprobado).
