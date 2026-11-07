# HANDOVER — última sesión (2026-11-07)

**Fase:** F2, paso 4 de §6.1 (style tiles). Cuña A provisional (D-F1c/D-F1d). **Rama:** `docs/f2-style-tiles` (desde `master` 345cbf2), PR abierto sin fusionar.

## Hecho en esta sesión: 3 style tiles (ronda 1)
- `prototipos/f2-tiles/` con `A.html` «Encuadre», `B.html` «Marcador», `C.html` «Escena»; `README.md` con pruebas y notas; `fuentes/`, `img/` (portadas TMDB, `discover` es-ES) y 6 capturas JPEG (390 y 1440).
- Cada tile: logotipo, paleta (3 superficies, tinta, apagado, escena, reserva, error/éxito con icono), tipografía (KulturaDisplay 800 + Bricolage), forma (chaflán 14/18, foco fuera del recorte), imagen (2:3, 16:9, sin portada, carga), retícula 4/12, y fragmento de portada + Inicio/ficha con «Marcar visto» (B2).
- Artifacts privados: A https://claude.ai/artifact/Lyh1swKbsMjRm3tcvpaYrw · B https://claude.ai/artifact/VqnKzjWxeDWARBwavsTzTN · C https://claude.ai/artifact/KjTku74WJKpSuRvJhp6K9x
- Pruebas: axe 0 en 18 combinaciones (390/1440/320 × reduced-motion), consola limpia, sin WebGL, sin desbordes; portadas ≥ 40 % del 1.er pantallazo en los tres.
- Revisión independiente Artisan + Advocate, 2 rondas (`04_DECISIONES` §4). Todo lo grave, corregido.

## Estado de la puerta
- **Ningún tile pasa aún:** los revisores dejan el criterio 1 (Carácter) en 3 en los tres; C2–C4 en 4 (B: C4 3–4, botón a 699–751 px a 390).
- Se enseñan a Víctor como **ronda 1 de 3**. Necesita: su nota 1–4 por tile y feedback escrito contra la rúbrica. Si difiere ≥ 2 de la del revisor, vale la más baja.
- Sugerencias de los revisores para la ronda 2: C como base + la pista de B como K8 (Artisan); A es la mejor para el usuario (Advocate).
- Si tras 3 rondas ninguno pasa → R3/D6 (persona humana).

## Pendiente / ojo
- **No empezar el paso 5** hasta el «sí» de Víctor a UNA dirección.
- P1 (pack de 7 formatos) no aparece en los tiles: entra en el prototipo de portada (paso 6).
- Sin probar: VoiceOver iOS, NVDA, Safari real.
- Fuera de git a propósito: `prototipos/login/` (material viejo), capturas PNG, `.playwright-mcp/`, `PLAN_ESTRATEGICO.md`, `docs/auditoria/`.
- `.claude/launch.json` tiene una entrada local `f2-tiles` (servidor estático en el scratchpad); no se versiona.
- Deuda paso 5: `landing.css:60` y `:84`; decidir Figtree (X21).
- Sigue en pie: prueba de humo F1, backup del lunes (R10), rotar contraseña de la base, R9.
- Squash-merge solo con el OK de Víctor.
