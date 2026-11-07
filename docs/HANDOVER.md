# HANDOVER — última sesión (2026-11-07)

**Fase:** F2, paso 4 de §6.1 (style tiles), ronda 3 de 3. Cuña A provisional (D-F1c/D-F1d). **Rama:** `docs/f2-style-tiles` (desde `master` 345cbf2), PR #86 abierto sin fusionar.

## Rondas
- **Ronda 1:** `A.html` «Encuadre», `B.html` «Marcador», `C.html` «Escena». Víctor (D-F2d): paleta de A, logo de B, C descartado, el acento no es fijo.
- **Ronda 2:** `A2.html` «Encuadre con pista» (https://claude.ai/artifact/3bSSJt3aKQQURxQ8Vxuggs). Revisores 4·4·4·4; **Víctor: 3** (falla la legibilidad móvil; falta profundidad/3D) → D-F2e.
- **Ronda 3 (actual):** `A3.html` «Encuadre en profundidad» (https://claude.ai/artifact/TtWXN7RnwijpACzUt7ZP6R).
  - Escena en 3 planos sin WebGL: fondo 16:9 lejano, Los 100 y Sherlock en Z, póster delante con la pista K8 y la etiqueta «El último reino / T2 E5 / te quedan 4 episodios».
  - La escena reposa girada (rotateX 2°, rotateY −7°); B1 suma ±6° con puntero fino.
  - A 390: titular → escena → «Crear cuenta» → entradilla. CTA visible a 390×844 y 320×640.
  - Tramos pendientes de la pista en #6b6b6b (3,7:1).
  - Pruebas: axe 0 en 8 combinaciones, sin desbordes, B2 correcto. Revisores en 2 pasadas: **4·4·4·4 los dos** (`04_DECISIONES` §4).

## Estado de la puerta
- Falta la **nota 1–4 de Víctor** a A3. Es la última ronda: si no pasa → **R3/D6** (persona humana).
- Para el paso 5 (si pasa):
  - en móvil la etiqueta tapa el tramo actual de la pista;
  - «te quedan 4 episodios» ocupa 2 líneas a 390;
  - confirmar si el fondo 16:9 cuenta como portada (K6; el póster solo es el 25 % a 390);
  - pack P1 en el paso 6;
  - probar un acento frío (X11);
  - P3 con pistas largas;
  - verde frente a `--ok` (K5).

## Pendiente / ojo
- **No empezar el paso 5** hasta el «sí» de Víctor.
- Sin probar: VoiceOver iOS, NVDA, Safari real.
- Fuera de git a propósito: `prototipos/login/`, capturas PNG, `.playwright-mcp/`, `PLAN_ESTRATEGICO.md`, `docs/auditoria/`.
- `.claude/launch.json` tiene la entrada local `f2-tiles` (servidor estático en el scratchpad); no se versiona.
- Deuda paso 5: `landing.css:60` y `:84`; decidir Figtree (X21).
- Sigue en pie: prueba de humo F1, backup del lunes (R10), rotar contraseña de la base, R9.
- Squash-merge solo con el OK de Víctor.
