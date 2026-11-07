# HANDOVER — última sesión (2026-11-07)

**Fase:** F1 (`PLAN_ESTRATEGICO.md` §7.3; D-F1: se cierra con la prueba de humo y una decisión escrita). **Rama:** `feat/f1-humo-cunas` (PR abierto, sin fusionar).

## Hecho en esta sesión: prueba de humo de F1
- `/es/series` y `/es/anime` (también `/en/…`): una promesa, una portada real y el CTA «Crear cuenta».
  - Usan la landing v2 (`landing.css`), sin WebGL. Son estáticas para el CDN (`STATIC_CSP_ROUTES`) y llevan `noindex`.
  - JS inicial: 120 kB (la portada `/es`, 124 kB).
  - Código: `src/components/landing/{WedgeLanding,WedgeCta,wedge-page}.tsx` y `src/lib/landing/wedge.ts`.
- Atribución por cuña: `wedge` en `parseAttribution` llega a `user_metadata.attribution` y a `signup_completed.props`, por correo y con Google, sin tablas nuevas. La isla del CTA copia los `utm_*` de la visita.
- Medición y criterio: `docs/F1_PRUEBA_DE_HUMO.md`, con los enlaces UTM, 2 consultas SQL y la regla de §7.3 + D-F1.
  - Altas: `signup_completed`.
  - Activación (3 títulos en 24 h): `user_media`, porque las importaciones no emiten `library_add`.
  - Desempate aprobado (D-F1b): más altas activadas en número absoluto; si empatan, más altas.
- Verificado en local:
  - `tsc` y `next lint` limpios.
  - `vitest`: 16 fallos, los mismos que `origin/master` en un worktree (Windows: CRLF y `\`).
  - axe: 26/26 públicas a 390 y 1440, con reflow y Tab.
  - Capturas con reduced-motion en `docs/capturas/f1/`. El CTA lleva la UTM y no hay errores de consola salvo `/_vercel/*`, que no existe en local.
- En CI: el CUJ `tests/e2e/cuj/cuna.spec.ts` (aquí no hay Docker) y Lighthouse.
- Revisión independiente: `04_DECISIONES` §4, con 1 grave y 3 menores, todos corregidos.
- Entorno (petición de Víctor):
  - Instalado Chromium de Playwright (1217).
  - Las skills de `Escritorio\diseños` ya estaban todas; 3 solo se lanzan con `/nombre`.
  - MCP caídos: activecampaign necesita la URL de la cuenta (`/plugin manage`); browser-use y definite fallan en el servidor del proveedor.

## Pendiente / ojo
- Squash-merge del PR solo con el OK de Víctor.
- Víctor:
  - Publicar 2 mensajes en 3 comunidades por cuña con los enlaces UTM del documento.
  - En la primera visita, mirar si el panel de Web Analytics (Hobby) enseña UTM y el evento `cta_click`, y anotarlo. La API de consulta responde 404 para el proyecto.
- Cerrar F1: registrar los resultados en el documento y escribir la decisión en `04_DECISIONES`. Con < 30 altas en ambas cuñas, la cuña es A (D-F1). Después, retirar o rehacer las dos rutas en F2/F3.
- En local hay un `next start` viejo en el 3187, y los tests de a11y lo reutilizan: usa `A11Y_BASE_URL` con un servidor nuevo. En Windows, un puerto recién liberado puede seguir sirviendo el build anterior: cambia de puerto.
- Siguen en pie de F0: el backup programado del lunes (R10), rotar la contraseña de la base y R9 (no lanzar `db push` contra producción).
- `PLAN_ESTRATEGICO.md` y `docs/auditoria/` siguen fuera de git: hacer `git add` solo con rutas explícitas.
