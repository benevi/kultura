# HANDOVER — última sesión (2026-11-06)

**Fase:** **F0 cerrada** el 2026-11-06 (`PLAN_ESTRATEGICO.md` §7.2–7.3). Siguiente: F1 (validar la cuña) y F2 (identidad). **Rama:** `master`.

## Puerta de F0 (§7.2)
| Condición | Estado | Evidencia |
|---|---|---|
| Evento emitido y visto en Web Analytics y en `analytics_events` | ✔ | `library_add` en `analytics_events` de producción, 2026-11-06 20:58:50 UTC. Vercel `/v9/projects/kultura`: `webAnalytics.hasData = true` (activo desde 2026-10-10); Speed Insights con datos desde 2026-11-06 20:57 UTC (#77). |
| CUJ en verde contra Supabase real | ✔ | Job `cuj`, Playwright contra Supabase local en CI (#70), obligatorio en `master` (D-G1). |
| Interruptor probado en una ruta | ✔ | `ui_v2` en `/es/lists` (#69). |
| `CLAUDE.md` | ✔ | En el repo. |
| Dominio principal con 308 y Search Console | fuera de F0 | D3 actualizada: se compra con la app al 100 %, pasa a F4. |

## Hecho en F0 (PRs)
#67 inventario `FUNCIONES_V2.md` · #68 test inestable · #69 interruptor `ui_v2` · #70 red CUJ con BD real · #71 margen de JS en `/best` · #72 rescate a `src/lib` · #73 limpieza · #74 portada sin rankings (D-R1) · #75 protección de `master` · #76–#81 pasos de Víctor, Speed Insights, medición, R9, backups (R10) y proyecto claude.ai.
- R9: historial de migraciones de producción reparado (29 de 31; faltan las 2 de push, sin aplicar).
- R10: los backups no habían funcionado nunca; arreglados y simulacro de restauración OK (`supabase/README.md`).
- Proyecto «KULTURA 2.0» creado en claude.ai con instrucciones, `HANDOVER`, `04_DECISIONES` y `F0_PASOS_VICTOR`.

## Pendiente de Víctor (no bloquea la fase)
- Subir al proyecto «KULTURA 2.0» `docs/PLAN_ESTRATEGICO.md` y `docs/auditoria/*.md`: no están en el repo público y el navegador de la app no sube archivos.
- Rotar la contraseña de la base de producción (se pegó en el chat) y actualizar el secreto `SUPABASE_DB_URL` con la nueva.
- Copiar `C:\Users\victo\kultura-backup.key` fuera de este equipo. Sin ella, los backups no se pueden descifrar.
- Lunes 2026-11-09: comprobar que el backup programado sale en verde.

## Ojo
- Un `supabase db push` contra producción aplicaría las 2 migraciones de push: no lanzarlo sin decidirlo y probarlas.
- La CLI de Supabase está enlazada a `kultura-test`. La de Vercel tiene la sesión de Víctor (Hobby: solo 1 h de registros).
- En Windows fallan unos 16 tests de unidad que ya fallaban igual en `master` (rutas con `\`, CRLF): no son regresiones.
- `master` protegida: 4 checks obligatorios y auto-merge. Squash-merge solo con OK de Víctor.
- Siguiente paso de F1: guion de entrevistas (Mom test) y mini-landings `/es/series` y `/es/anime` (§7.3).
