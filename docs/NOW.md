# NOW

> Una sola tarea activa. Si no aparece aquí, no se trabaja en ello.

---

## Tarea activa: B3.5f-1 — Sistema de diseño base

**Estado:** 🔄 EN CURSO

### Qué cambia

- Tokens CSS semánticos (modo oscuro) en `globals.css` — todos los `--surface-*`, `--text-*`, `--accent-*`.
- Fuentes: Space Grotesk (500, 700) + Inter (400, 500, 600) vía `next/font/google`, expuestas como variables CSS, mapeadas en Tailwind.
- 4 componentes core en `src/components/ui/`: `ContentCard`, `KButton`, `FilterChip`, `KInput`.
- Página `/dev` (solo desarrollo) para verificación visual de tokens y componentes.
- Las pantallas existentes (Home, Discover, etc.) **no se tocan** — eso es B3.5f-2.

### Alcance estricto (NO expandir)

- NO aplicar sistema a pantallas reales existentes.
- NO implementar modo claro (tokens nombrados semánticamente para soportarlo después sin reescritura).
- NO hardcodear hex en componentes — todo pasa por token CSS.

### Cómo sé que funciona

1. `npm run lint` → 0 errores.
2. `tsc --noEmit` → 0 errores.
3. `vitest run` → 499 passed (+ los 2 rojos pre-existentes de library/route y settings/route que NO son de este bloque).
4. Navegando `/dev` en local: swatches de color con nombre de token, todos los componentes en sus variantes/estados.

### Archivos que toco

- `docs/NOW.md` (este)
- `docs/DONE.md` (añadir fix /api/chat 500 / E36)
- `src/app/globals.css` — tokens semánticos
- `src/app/[locale]/layout.tsx` — fuentes Space Grotesk + Inter
- `tailwind.config.ts` — mapeo de tokens
- `src/components/ui/ContentCard.tsx` — nuevo
- `src/components/ui/KButton.tsx` — nuevo
- `src/components/ui/FilterChip.tsx` — nuevo
- `src/components/ui/KInput.tsx` — nuevo
- `src/app/[locale]/(dev)/page.tsx` — nuevo (ruta /dev)

### Cuándo paro

Cuando el humano apruebe la verificación visual de `/dev`. No aplicar a pantallas reales sin confirmación.

---

## Contexto: 2 rojos pre-existentes

`library/route` y `settings/route` fallan por timeout (5s) — son pre-existentes, no causados por B3.5f-1. Si SOLO fallan esos dos, es lo esperado. Si falla algo más, parar y reportar.
