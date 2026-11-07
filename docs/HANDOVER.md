# HANDOVER — última sesión (2026-11-07)

**Fase:** F2, paso 5 de §6.1 (sistema de diseño). Cuña A provisional (D-F1c/D-F1d). **Rama:** `docs/f2-design-system` (desde `master` 88717a0), PR abierto sin fusionar.

## Hecho
- `docs/03_DESIGN_SYSTEM.md` v1.0, aprobado (D-F2o). Sustituye a `DISENO.md` para la v2; el viejo queda marcado como superado y no se borra (regla 3).
- Contenido: tokens (color, espacio, chaflán, capas), escala fluida K1 (tracking interpolado: −3,3 % a 52 px y −5 % desde 96 px), motion con reduced-motion, profundidad con WebGL opcional, 12 componentes con estados y foco, presupuesto y accesibilidad.
- Demo viva (D1): `prototipos/f2-sistema/tokens.css` (pasa a `src/v2/styles/tokens.css` en F3) y `muestra.html`. Capturas JPEG en `capturas/`; las PNG se quedan en local.
- Pruebas: axe 0 en 8 combinaciones (390/1440/320/1024 × reduced-motion), también con `contrast: more`; sin WebGL; sin desbordes a 320; 0 objetivos < 44 px.
- Revisión: Artisan y Advocate, 2 pasadas → **pasa** (`04_DECISIONES` §4).

## Deuda D-F2h cerrada (D-F2i…n, aprobadas: D-F2o)
- `--rail-todo` #6b6b6b, nunca sobre s3; con más contraste, los vistos pasan a tinta.
- P3, pistas largas: discreta ≤ 18, por bloques, continua o sin pista.
- Verde frente a `--ok`: el éxito no tiene color (tinta + icono).
- Acento frío (El caballero oscuro, H266): girar a H245, alternativa A de 3.
- Figtree sale de la v2 (−20 KB).
- `src/v2` sin Tailwind (CSS + tokens).
- `landing.css:60` y `:84`: la ruta real es `src/components/landing/landing.css`. Se sustituye en F3, no se parchea.
- 13 tests `design|visual` (§12): 4 se adaptan y 8 se aparcan hasta `v1-ui`; se crean 8 tests v2 en el primer PR de F3.

## Siguiente
- **Puerta del paso 5 aprobada** (Víctor: «Sí, apruebo», D-F2o). Siguiente: paso 6, prototipo vivo de Inicio con sesión con el pack P1. Antes, squash-merge de #87 con el OK de Víctor.
- Condición del paso 6: VoiceOver en iOS y NVDA (Claude prepara un guion de 10 min) y Safari real.

## Ojo
- `tests/unit/visual/scales.test.ts:108` falla en `master`: `Header.tsx` y `AuthHeader.tsx` sin `page-grid`. Es anterior a esta rama, que no toca `src/`.
- JS inicial de `/es` (v1): 149.793 B de 153.600 (Lighthouse del 2026-11-06). Sin margen.
- Fuera de git a propósito: `prototipos/login/`, las PNG, `.playwright-mcp/`, `.lighthouseci/`, `PLAN_ESTRATEGICO.md` y `docs/auditoria/`.
- Sigue en pie: prueba de humo F1, backup del lunes (R10), rotar la contraseña de la base y R9.
- Squash-merge solo con el OK de Víctor.
