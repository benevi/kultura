# HANDOVER — última sesión (2026-11-07)

**Fase:** F2, paso 4 de §6.1 (style tiles), ronda 2 de 3. Cuña A provisional (D-F1c/D-F1d). **Rama:** `docs/f2-style-tiles` (desde `master` 345cbf2), PR abierto sin fusionar.

## Ronda 1 (hecha)
- `prototipos/f2-tiles/A.html` «Encuadre», `B.html` «Marcador», `C.html` «Escena». Ninguno llegó a 4 en Carácter según los revisores.
- Artifacts: A https://claude.ai/artifact/Lyh1swKbsMjRm3tcvpaYrw · B https://claude.ai/artifact/VqnKzjWxeDWARBwavsTzTN · C https://claude.ai/artifact/KjTku74WJKpSuRvJhp6K9x
- Feedback de Víctor (D-F2d): paleta de A, logo de B, C descartado, el acento no es fijo (K5 sin cambios).

## Ronda 2: A2 «Encuadre con pista» (hecha)
- `prototipos/f2-tiles/A2.html`: paleta de A + monograma de B (color de la escena; fijo en tinta como icono) + pista de episodios como lado izquierdo del marco del póster, con «El último reino / T2 E5 / te quedan 4 episodios» colgado del tramo actual, igual a 390 y a 1440.
- «Seguir viendo»: cada fila con el acento de su portada (ocre, verde, verde agua); el acento solo llena la pista; botones en s2.
- Póster en w780 (`img/lastkingdom_780.jpg`). Capturas `capturas/A2-390.jpg` y `A2-1440.jpg`.
- Artifact privado: https://claude.ai/artifact/3bSSJt3aKQQURxQ8Vxuggs
- Pruebas: axe 0 en 8 combinaciones, consola limpia, sin WebGL, sin solapes, portadas 45–52 %, B2 con ratón y teclado.
- Revisión Artisan + Advocate, 2 pasadas (`04_DECISIONES` §4): 3·3·3·4 y 4·4·4·4 → **4·4·4·4 los dos: pasa la puerta.**

## Estado de la puerta
- Falta la **nota 1–4 de Víctor** y su «sí» a A2. Si difiere ≥ 2 de la del revisor, vale la más baja. Si no pasa: ronda 3 y, después, R3/D6.
- Condiciones de los revisores: pack P1 (7 formatos) en el prototipo de portada (paso 6); probar un acento frío (riesgo X11); P3 con pistas largas (anime, 112 caps.) sin resolver.
- Pregunta para Víctor: ¿se excluyen de K5 los verdes cercanos a `--ok` (el verde de Los 100 se lee como «hecho»)?

## Pendiente / ojo
- **No empezar el paso 5** hasta el «sí» de Víctor a A2.
- Sin probar: VoiceOver iOS, NVDA, Safari real.
- Fuera de git a propósito: `prototipos/login/`, capturas PNG, `.playwright-mcp/`, `PLAN_ESTRATEGICO.md`, `docs/auditoria/`.
- `.claude/launch.json` tiene una entrada local `f2-tiles` (servidor estático en el scratchpad); no se versiona.
- Deuda paso 5: `landing.css:60` y `:84`; decidir Figtree (X21).
- Sigue en pie: prueba de humo F1, backup del lunes (R10), rotar contraseña de la base, R9.
- Squash-merge solo con el OK de Víctor.
