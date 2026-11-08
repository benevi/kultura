# HANDOVER — última sesión (2026-11-08)

**Fase:** F2 reabierta desde cero con las skills (D-F2p). **Rama:** `docs/f2-diseno-con-skills` (desde `master` 4937408), PR abierto sin fusionar.

## Hecho
- `PRODUCT.md`: verdad del producto con las respuestas de Víctor (D-F2q).
- 3 direcciones de Portada + Inicio en `prototipos/f2-direcciones/`: **Revelado**, **La balda** y **La tira** (D-F2r). Contrato, pruebas y pendientes en su `LEEME.md`.
- Artifacts privados: Revelado `7ZJEJN7niLBS3VZ3PfLaYa`, La balda `C7iVDknvmXNsigpFJJHcHt`, La tira `U9smJ598S5bv5yjfjoL1hj` (claude.ai/artifact/…). Se publican con las fuentes incrustadas, desde una copia.
- Skills invocadas y comprobadas en las transcripciones: impeccable, taste-skill, emil-design-eng, design-motion-principles, ui-ux-pro-max (sin buscador: no hay Python).
- Revisión: Artisan y Advocate, 2 pasadas (§4). 3,3 · 3,3 · 3,1. **Ninguna pasa la puerta del criterio 7**: faltan VoiceOver y NVDA. Graves nuevos corregidos después y medidos, sin repuntuar.

## Falta decidir (Víctor)
1. Qué dirección sigue, con nota y feedback contra la rúbrica. Advocate enseñaría Revelado; Artisan, La tira.
2. Cuña y titular: usuario multiformato frente a cuña A (D-F1d) y «Tus series, al día.» (D-F2a).
3. Deshacer: solo icono y sin caducar frente a B2.

## Siguiente
Tras elegir: `03_DESIGN_SYSTEM.md` y `DESIGN.md` desde el mundo elegido (A2b y D-F2i…o quedan sujetas), y paso 6.

## Ojo
- Pruebas de la entrega en el scratchpad de la sesión, no en el repo. Sin probar: lector de pantalla, táctil real, Safari, Firefox, Lighthouse.
- Impeccable v4.8.1 disponible; no actualizado. `.taste-skill/` queda fuera de git. Sin telemetría de la tirada.
- `tests/unit/visual/scales.test.ts:108` falla en `master`: `Header.tsx` y `AuthHeader.tsx` sin `page-grid`. Anterior a esta rama.
- JS inicial de `/es` (v1): 149.793 B de 153.600. Sin margen.
- Fuera de git a propósito: `prototipos/login/`, las PNG, `.playwright-mcp/`, `.lighthouseci/`, `PLAN_ESTRATEGICO.md` y `docs/auditoria/`.
- Sigue en pie: backup del lunes 2026-11-09 (R10), rotar la contraseña de la base (`SUPABASE_DB_URL`), copia de `kultura-backup.key`, entrevistas de F1, R9.
- Squash-merge solo con el OK de Víctor.
