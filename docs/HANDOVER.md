# HANDOVER — última sesión (2026-11-06)

**Fase:** F0 (`PLAN_ESTRATEGICO.md` §7.3). **Rama:** `feat/f0-interruptor-ui-v2` (PR abierto, sin merge).

## Hecho en esta sesión
- PR #67 (decisiones §12 + `FUNCIONES_V2.md`) y PR #68 (test intermitente de optin) fusionados en `master`.
- Entregable: **interruptor de UI `ui_v2` probado en `/es/lists`**.
  - `src/lib/ui-v2.ts`: `resolveUiV2` (cookie `ui_v2` 1/0 > `UI_V2_DEFAULT=1` > vieja) e `isUiV2Enabled()`.
  - `GET /api/ui-v2?v=1|0&next=/es/lists`: pone la cookie (httpOnly, Lax, 30 días) y vuelve con 303; `next` saneado y nunca `/api`; sin sesión, al login; rate limit 20/min por IP.
  - `src/v2/lists/ListsScreen.tsx`: pantalla marcador (no es diseño), mismos datos que la vieja; `page.tsx` es solo un `if`.
  - `tailwind.config.ts` incluye `src/v2/**`; textos en `messages/*` namespace `uiV2`.
  - Tests: `tests/unit/ui-v2/` (17): prioridad, ruta, conmutador, y que ninguna ruta cacheable use el interruptor.
- Revisión independiente hecha (`04_DECISIONES` §4): sin graves; 5 menores corregidos.

## Verificación
- `tsc` sin errores fuera de `.next/` (tipos viejos de otra rama); `npm run lint` limpio.
- Suite completa en Windows: los mismos 16 fallos que `master` (10 ficheros: rutas con `\`, CRLF, tiempos); ninguno nuevo. CI (Linux) es la referencia.
- Navegador (dev, con sesión, contra `kultura-test`): v1 → `/api/ui-v2?v=1` → v2 → enlace «Volver» → v1, todo en `/es/lists` sin cambiar de URL; cookie no visible desde JS. Capturas 390 (margen 16 px, sin scroll horizontal) y 1440 (alineado con la cabecera, 176 px). Corregido: la pantalla v2 ahora usa `page-grid` como la vieja. Consola sin errores nuevos (hidratación de `#main` y CSP de Vercel Analytics en dev ya existían).

## Pendiente de Víctor
- Hecho el 2026-11-06 (con tu OK): `kultura-test` puesto al día con `supabase db push` (16 migraciones; historial reparado para `20260913220000`/`20260914090000`, que estaban con otra versión). 35 tablas, todas con RLS, 182 políticas. El asesor de seguridad solo da avisos (funciones SECURITY DEFINER de ayuda, `search_path` en `set_updated_at` e `is_demo_session`, protección de contraseñas filtradas desactivada).
- La CLI queda enlazada a `kultura-test` (`supabase/.temp/`, ignorado en git): antes de un `db push` a producción, volver a enlazar.
- `.env.development.local` no sustituye `SUPABASE_SERVICE_ROLE_KEY`: el dev usa la de producción contra `kultura-test` (`Invalid API key` en el log). Añadir la `service_role` de `kultura-test`.
- Probar: entrar y abrir `/api/ui-v2?v=1&next=/es/lists`; volver con el enlace de la pantalla.
- Paneles de F0 de siempre (D3/D4/D8, Web Analytics, clave `age`).

## Siguiente entregable propuesto (uno)
Red de pruebas con BD real: 8 CUJ con Playwright contra Supabase local en CI (`b3_5e_safety_net/` como base). Modelo: Fable 5.1 / Opus 5.5.
