# SKILLS_AND_TOOLS — qué se ha usado y para qué

## Skills principales (deciden el diseño)

Las instalé desde sus repos públicos en `.claude/skills/` del proyecto. Antes de usarlas revisé todo su contenido: scripts, red y escritura. Ningún script accede a credenciales ni ejecuta órdenes remotas. Las únicas peticiones de red son las de `taste-skill/scripts/assets.mjs`, que se activan a petición y consultan colecciones abiertas (Openverse, Wikimedia, AIC, Met, Archive.org, NASA).

| Skill | Origen (commit) | Licencia | Qué ha decidido |
|---|---|---|---|
| **UI UX Pro Max** | `nextlevelbuilder/ui-ux-pro-max-skill@ccce51c` | MIT | Patrones de estilo (Editorial Grid, Exaggerated Minimalism, Immersive/Interactive, 3D), prioridades de calidad (accesibilidad, táctil, rendimiento), preset GSAP de transición de página y checklist previa a la entrega. |
| **Taste Skill** (`design-taste-frontend`) | `Leonxlnx/taste-skill@12af471` | MIT | La dirección de arte: `sentence-as-layout`, la tipografía (Big Shoulders / Public Sans), la paleta «Cobalto sobre arena», los planos de cada sección, el movimiento firma, el estilo de la app `accent-ladder` (y `true-black-flat` para el oscuro) y las reglas de la casa, con `lint.mjs` / `inspect.mjs` como puerta de calidad. |
| **Awesome Claude Design** | `VoltAgent/awesome-claude-design@8f746b5` + los DESIGN.md de `VoltAgent/awesome-design-md@fcc7028` | MIT | Referencias estudiadas: Spotify (las portadas ponen el color), WIRED y The Verge (display solo en momentos grandes). También el formato token + regla + motivo que sigue `DISENO.md` v3. |
| **Design Motion Principles** | `kylezantos/design-motion-principles@4a9ca87` | MIT | La ponderación Jakub/Jhey/Emil, la puerta de frecuencia, las curvas y duraciones, la reducción de movimiento obligatoria y, más adelante, la auditoría del movimiento. |

Notas de instalación:
- **UI UX Pro Max**: copié solo `.claude/skills/ui-ux-pro-max` (datos, referencias y scripts, sin sus tests). Su repo trae además otras skills (`brand`, `slides`, `banner-design`…) que no instalé porque este trabajo no las necesita.
- **Awesome Claude Design**: el repo es solo un catálogo de enlaces. Le añadí un `SKILL.md` envoltorio y los 70 DESIGN.md locales para poder usarla sin red.

## Skills de apoyo (verifican, no deciden)

| Skill | Uso |
|---|---|
| `frontend-design` | Contraste con su criterio anti-plantilla. |
| `vectorlab-ux-skills` (typography, colour-palette, motion, reduced-motion, forms, errors, empty-states, loaders, viewports, keyboard, anti-slop) | Revisión por pantalla en las PR 4–6. |
| `design:accessibility-review`, `design:design-critique`, `design:design-system` | Revisión de cada PR. |
| `engineering:testing-strategy` | La reescritura de los tests de guarda. |
| `run`, `code-review`, `simplify` | Arrancar la app y revisar cada PR antes de subirla. |

## Herramientas

- **Playwright** (Chromium preinstalado) para capturas a 320/390/768/1024/1440/1920 y para el `inspect.mjs` de Taste.
- **Vitest, ESLint y Lighthouse CI** del propio repo.
- **Agentes**: Explore (auditoría), Artisan / Advocate / Tuner / Skeptic (revisión por fases).

## Registro de uso

| Fecha | Skill | Paso | Resultado |
|---|---|---|---|
| 2026-11-04 | UI UX Pro Max | `--design-system` y búsquedas por dominio (product, style, typography, color, landing) | El primer `--design-system` mezcló demasiadas palabras y devolvió Noto JP. Se repitió con consultas estrechas, como pide la propia skill. Resultado: Editorial + Immersive y paleta por categorías (descartada después por Taste). |
| 2026-11-04 | Taste Skill | `draw.mjs --options 3` → `--direction sentence-as-layout` | La hoja de dirección (`.taste-skill/direction.json`). |
| 2026-11-04 | Taste Skill | `draw.mjs --app --kind community --keep palette,type` → `--style accent-ladder` | La hoja de la app (`.taste-skill/app/direction.json`). |
| 2026-11-04 | Awesome Claude Design | Lectura de theverge, wired y spotify | Principios trasladables (sección 3 de `docs/redesign/DIRECCION.md`). |
| 2026-11-04 | Design Motion Principles | Modo Create, paso 1 | La ponderación por contexto (sección 7 de `DIRECCION.md`). |
