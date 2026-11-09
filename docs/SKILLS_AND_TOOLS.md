# Skills y herramientas usadas en el rediseño v2 (2026-11-09)

Solo lo usado de verdad. El historial de cada invocación está en la transcripción de la sesión.

| Skill / herramienta | Qué se hizo con ella | Qué aportó |
|---|---|---|
| `impeccable` | `init` (genera `PRODUCT.md`), lectura de `craft-floor.md`, `visualize.md`, `ios.md`, `android.md`; `detect --json src/v2` | Contexto de producto y suelo de calidad. Detector: sin hallazgos |
| `taste-skill` | `draw.mjs` (dirección `loud-flat-poster`, en `.taste-skill/direction.json`); `concept-seed`; `inspect.mjs` sobre `/es` v2 | Hojas apiladas, cierre invertido, pie con letras en bloques. Inspector: hallazgos en `REDESIGN_AUDIT.md` §6 |
| `ui-ux-pro-max` | `--design-system` y búsquedas | Criterios de contraste, táctil y estados. No se adoptó su paleta |
| `emil-design-eng` | Criterio aplicado | Curvas propias, `scale(.97)` al pulsar, solo `transform`/`opacity` |
| `design-motion-principles` | Criterio aplicado | `prefers-reduced-motion`, ritmo del scroll |
| Abracadabrax (imágenes) | Se prepararon 2 borradores y se descartaron | 0 créditos gastados; no hay imágenes generadas en la web |
| Playwright + `@axe-core/playwright` | Script de QA (no está en el repo) | Datos de `REDESIGN_AUDIT.md` §6 |
| Lighthouse 12 | Una pasada local, móvil | Datos de `REDESIGN_AUDIT.md` §6 |
| Navegador del panel | Capturas del 3D en GPU real | Revisión visual |

## No usadas
GSAP y Three.js (presupuesto de JS), Taste `lint.mjs`, `d2c`, Figma. Tampoco se instaló nada nuevo en esta tanda.

## Atención
El visto bueno de estas herramientas no sustituye a la aprobación de Víctor: la dirección «Láminas» la eligió él como pin, pero no ha visto el resultado.

## Portada rehecha (2026-11-09)
| Herramienta | Uso | Qué cambió |
|---|---|---|
| `impeccable` | `critique` sobre la portada anterior, `craft-floor` antes de editar, brief de superficie en `.impeccable/surfaces/src-v2-portada.md` | Se retiró la pila de láminas y el pie con letras en bloque; una sola idea por pantalla |
| `taste-skill` | Generación de direcciones para las tres propuestas | Propuestas A, B y C; Víctor eligió B + A |
| Playwright + axe | Script de QA fuera del repo: 8 escenarios | Abanico roto en pantallas bajas y hueco en la sección de español, corregidos |
| `@lhci/cli` 0.15.1 | 3 pasadas móvil sobre `/es` con `ui_v2=1` | Imágenes de 2,5 MB a 1,3 MB con `srcset` por CDN |

## Inicio (2026-11-09)
| Herramienta | Uso | Qué cambió |
|---|---|---|
| `impeccable` | `context`, `craft-floor` y `operate` antes de editar; `detect src/v2/home` (solo regex: sin hallazgos) | Pantalla de trabajo: tipo fijo, filas densas y un solo gesto |
| `taste-skill` | `inspect.mjs --app` sobre el build, con un proxy local para la sesión simulada | Nada. **3 FAIL descartados:** `ui-wrapper` (confunde nuestro `data-ui`), `font-not-dealt` (compara con la dirección de la portada anterior) y `covered-text` (la barra inferior fija al desplazar). **4 WARN aceptados:** hueso (D-V2f), 48 % del texto bajo 13 px (pie legal y secciones heredadas, sin rehacer), secciones bajo el primer pantallazo y `h1` de 40 px |
| Playwright + axe | Script de QA fuera del repo | Datos de `REDESIGN_AUDIT.md` §10; destapó que los títulos salían en Arial (D-V2k) |

## Biblioteca (2026-11-09)

- **Impeccable** (`operate.md`, `craft-floor.md`): modo Operate. Cambió: tipo fijo en rem, esqueleto con la forma real, vacíos que dicen qué hacer, sin cajas ni iconos en ellos. Su detector solo corrió por expresiones regulares sobre `src/v2/library`: limpio, pero es un recuento parcial.
- **Taste** (`inspect.mjs --app`): subió el texto de 12 a 13 px. Avisa del título de 40 px: se mantiene igual que Inicio, para que las dos pantallas coincidan.
- **Emil / Design Motion:** la portada gira sobre su lomo a 200 ms y solo con ratón; color y foco, sin animación añadida.
