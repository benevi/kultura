# Skills de Claude para la fase 8

Revisión del 17-11-2026: se leyeron todas las skills instaladas (403 `SKILL.md`) y se puntuaron por campo según su calidad y su encaje con este plan. Manda el plan: si una skill contradice a `PLAN_FASE8.md`, gana el plan.

## Qué skill usar

| Campo | Principal | Apoyo | Fase |
|---|---|---|---|
| Dirección de arte, biblia | `taste-skill` (inventario, idea, prueba del competidor) | `impeccable` (init, new-work) | 8A.0–8A.1 |
| Tokens, sistema de diseño | `impeccable` (document/extract) | `design-superpowers` ds-make, solo escalas OKLCH | 8A.3 |
| Tipografía | `impeccable` (typeset, craft-floor) | `taste-skill` (type) | 8A.0, 8A.3 |
| Color, contraste | `design-superpowers` creative (OKLCH + tabla WCAG) | `impeccable` colorize | 8A.3 |
| Pulido de pantallas | `impeccable` (polish, audit, critique) | `emil-design-eng` | 8A.4–8A.5 |
| Contra lo «hecho por IA» | `frontend-design` | `vectorlab-ux-skills` anti-slop | todas |
| Construir movimiento | `animate` | `design-motion-principles` (solo modo creación) | 8A.3–8A.5 |
| Revisar movimiento y su rendimiento | `review-animations`, `animation-performance` | `improve-animations` | 8A.4–8A.5 |
| Movimiento reducido | `vectorlab-ux-skills` reduced-motion | — | 8A.3+ |
| Accesibilidad | `advocate-a11y-audit` + criterios nuevos de WCAG 2.2 a mano (2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8) | `vectorlab-ux-skills` keyboard | todas |
| Usabilidad, 9 flujos | `ux-audit` + `usability-audit` + `audit-cuj` | `design:design-critique` (panel) | 8A.1, 8A.4 |
| Investigación con usuarios | `product-management:synthesize-research` | — | 8A.1, 8A.4 |
| Textos de interfaz | `vectorlab-ux-skills` errors/labels/verbs/empty-states | `design:ux-copy` | 8A.3+ |
| i18n | `advocate-i18n-review` | `break-ui` | 8A.3+ |
| Casos límite | `break-ui` | — | 8A.3+ |
| Términos de proveedores | `legal:review-contract` (con baremo «uso personal sin ánimo de lucro») | `legal:legal-risk-assessment`; correos con `legal:legal-response` solo como borrador | 8A.0 |
| Privacidad (RGPD) | `guardian-compliance-review` | `legal:compliance-check` (corregir: plazo de derechos 1 mes + 2, art. 12.3; añadir LOPDGDD, AEPD, LSSI) | 8A.0, 8A.2 |
| SQL y métricas | `data:write-query` (+ `data:sql-queries`) | `data:validate-data` | 8A.2, 8A.6 |
| Puertas G0–G6 | `product-management:metrics-review` (solo agregados) | `grilling` | todas |
| Revisión de código | `code-review` (integrada; invocarla por nombre) | `vercel:react-best-practices` | cada PR |
| Tests, Playwright | `craftsman-e2e-testing` | `break-ui` | 8A.2+ |
| Rendimiento web | agente `vercel:performance-optimizer` | `tuner-performance-audit` | 8A.2+ |
| Verificar en navegador | `vercel:verification` | `run` | cada PR de UI |
| Deuda técnica | `simplify` → `code-review` | `engineering:tech-debt` | 8A.3b |

## Evitar

- `superdesign`: `npx @latest` sin versión fija y sube diseños a su nube.
- `product-tracking-skills:*` y el esquema de eventos de `strategist-analytics-design`: usan `user_id`/`identify` y SDK de terceros (el plan pide agregados sin `user_id`).
- `browser-fix`: desfasada (Next 14, ruta antigua), lanza build y arregla sin preguntar.
- `remove-animations` y el modo auditoría de `design-motion-principles` (escribe `motion-audits/`), salvo a propósito en una rama.
- `vercel:next-cache-components` (solo Next 16); de `vercel:nextjs`, ignorar lo que sea de Next 16.
- `d2c-*` (flujo Figma, bloqueos rígidos), `apple-design`, `animate-expo`, `chrome-extension-builder-*`, `langfuse`.
- `design:accessibility-review` (WCAG 2.1; presenta 2.5.5 como AA), `design:user-research`, `operations:risk-assessment`, `guardian-audit-trail-design`.
- `legal:vendor-check`, `legal:brief`, `legal:signature-request`: dependen de conectores sin autenticar.
- `vectorlab-ux-skills` typography como regla dura (una familia, ≤ 3 pesos) y `vectorlab ux-audit` sin perfil propio (estética Stripe por defecto).

## Huecos sin skill (se escriben en el plan)

- Vista 3D (three.js): `frameloop` bajo demanda, pausa con pestaña oculta o fuera de vista, `dpr` limitado, `dispose`, pérdida de contexto, presupuesto por fotograma; con movimiento reducido, vista fija o 2D.
- Destellos A11Y-07 (WCAG 2.3.1) y control de pausa del movimiento ambiental (2.2.2).
- Storybook test-runner y addon-a11y.
- Guion, consentimiento y adaptación a lector de pantalla de las rondas R1/R2.

## Pendiente de Víctor

| # | Decisión | Propuesta |
|---|---|---|
| S1 | Fuente única de tokens: JSON DTCG del plan o DESIGN.md de impeccable | DTCG como fuente; DESIGN.md derivado |
| S2 | La estética «Archivo» coincide con señales que `frontend-design` e `impeccable` marcan como «IA» (crema + serif, mono en etiquetas, rótulo sobre el título) | Justificarlas en la biblia; la mono solo para datos reales (signatura, fechas, cifras) |
| S3 | Zona táctil mínima | 24 px (WCAG 2.2 AA, 2.5.8) o 44 px |
| S4 | Archivos que generan las skills (`.ux/`, `motion-audits/`) | `.gitignore` (el repo es público) |
| S5 | `impeccable` descarga un binario (con checksum) al primer uso; `taste-skill` busca imágenes en red | Autorizar o no |
