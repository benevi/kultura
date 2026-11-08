# HANDOVER — última sesión (2026-11-08)

**Fase:** F2 reiniciada desde el paso 1 de §6.1 (D-F2p). **Rama:** `docs/f2-reinicio` (desde `master` 4937408).

## Hecho
- Borrado todo F2 a petición de Víctor: `docs/02_DISEÑO_BRIEF.md`, `docs/03_DESIGN_SYSTEM.md`, `docs/VOZ.md`, `prototipos/` entero (también `login/` y las PNG locales, irrecuperables), `.impeccable/`, `.taste-skill/`, `PRODUCT.md` y 3 artifacts.
- PR #88, #65 y #66 cerrados sin fusionar. Sus ramas siguen en el remoto.
- D-F2a…o anuladas. `DISENO.md` y `VOZ.md` de la raíz se quedan: sirven a la v1 y a sus tests.
- Python 3.12 instalado con winget para el buscador de `ui-ux-pro-max`.

## Reglas del reinicio
- Solo son fijos los vetos de Víctor y la anti-lista. Se abren negro exacto, tipografía, chaflán, curvas, logo, titular y firma; sigue siendo oscuro.
- Las respuestas de producto se vuelven a preguntar.
- Skills por paso, comprobadas en la transcripción y registradas. La causa del fallo fue usar `taste-skill` solo para `lint` e `inspect`, sin `draw.mjs`, y `ui-ux-pro-max` sin buscador.

## Siguiente
Paso 1, plataforma de marca: `impeccable init` con las preguntas de producto a Víctor. No diseñar antes de responderlas.

## Ojo
- Choque con lo escrito: `CLAUDE.md` (Preferencias) y plan §6.4 siguen citando negro, fuentes y chaflán. Manda D-F2p; proponer a Víctor actualizar `CLAUDE.md`.
- Quedan artifacts privados de rondas anteriores (tiles, muestra): no se tocaron.
- Python: si la consola falla por codificación, usar `PYTHONIOENCODING=utf-8`. Ruta: `%LOCALAPPDATA%\Programs\Python\Python312\python.exe`; abrir terminal nueva para el PATH.
- `tests/unit/visual/scales.test.ts:108` falla en `master`: `Header.tsx` y `AuthHeader.tsx` sin `page-grid`. Anterior a esta rama.
- JS inicial de `/es` (v1): 149.793 B de 153.600. Sin margen.
- Fuera de git a propósito: `.playwright-mcp/`, `.lighthouseci/`, `PLAN_ESTRATEGICO.md` y `docs/auditoria/`.
- Sigue en pie: backup del lunes 2026-11-09 (R10), rotar la contraseña de la base, copia de `kultura-backup.key`, entrevistas de F1, R9.
- Squash-merge solo con el OK de Víctor.
