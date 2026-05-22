# NOW
> Una sola tarea activa.

## Estado

B3.5f-2b → ✅ CERRADO (Library migrada, 500 tests green, commits d2ca0c2 + FIX 1f46636 7458dd0 d98152f)
B3.5f-2c → ✅ CERRADO (Login/Auth migrada, 500 tests green, commits 476d279 31aaf5c)
B3.5f-2d → 🔄 ACTIVO (Settings — rediseño visual al sistema de diseño)

## Tarea activa

**B3.5f-2d — Rediseño completo de Settings al sistema de diseño**

### Qué cambia
- Botón guardar: `Button` legacy → `KButton` con `loading` prop
- Input username: `Input` legacy → `KInput`
- Tabs de idioma (Español/English): `bg-accent` rojo → `bg-accent-positive` activo
- Sección "Zona de peligro": `bg-red-950/20 border-red-900/30` hardcoded → tokens semánticos neutros (es un stub sin lógica destructiva)
- Botón "Cambiar contraseña": `Button variant="outline"` → `KButton variant="secondary"`
- Superficies secciones: tokens (`bg-surface-default`, `rounded-modal`, `border-surface-border`)

### Cómo sé que funciona
- npm run lint → 0 errores (2 warnings pre-existentes SearchResults.tsx)
- npx tsc --noEmit → limpio
- npx vitest run → 500+ tests passed (todos los de settings incluidos)
- npm run dev + /settings carga sin errores de consola

### Archivos que toco
- `src/app/[locale]/(app)/settings/SettingsForm.tsx`
- `tests/unit/components/ui/KButton.test.tsx` (chore: test loading)
- `docs/NOW.md`, `docs/DONE.md`

### Cuándo paro
Tras commits [B3.5f-2d] + verificación visual del usuario.

## Nota

Chrome global (AuthHeader, BottomNav, Avatar) → CERRADO. No re-tocar.
Library → CERRADO. Login → CERRADO.
Discover → NO es 2d. Está roto y se rediseña+arregla en f-4.
Verde de marca = `--accent-positive`. FilterChip y KButton son los componentes canónicos.
