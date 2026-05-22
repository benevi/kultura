# NOW
> Una sola tarea activa.

## Estado

B3.5f-2b → ✅ CERRADO (Library migrada al sistema de diseño, 500 tests green)
  Commits: d2ca0c2 (Library), 1f46636 (docs), 7458dd0 (FIX chrome rojo residual), d98152f (docs)

B3.5f-2c → 🔄 ACTIVO (Login/Auth — rediseño visual al sistema de diseño)

## Tarea activa

**B3.5f-2c — Rediseño completo de Login/Auth al sistema de diseño**

### Qué cambia
- Wordmark KULTURA: `text-accent` (rojo legacy) → `text-accent-positive` (verde de marca)
- Botón submit: `Button` legacy → `KButton` (con `loading` prop añadida)
- Inputs: `<input>` nativo ad-hoc → `KInput`
- Tabs login/registro: botones nativos con `bg-accent` → tokens de sistema
- Link "¿Olvidaste tu contraseña?": `text-accent` rojo → `text-text-secondary`
- Errores de campo: `border-red-500 / text-red-500` hardcoded → `--accent-danger` vía token
- Errores globales: `bg-red-500/10 text-red-500` → `bg-accent-danger/10 text-accent-danger`
- Superficies: tokens `bg-surface-base`, `rounded-modal`, `border-surface-border`

### Cómo sé que funciona
- npm run lint → 0 errores (solo 2 warnings pre-existentes en SearchResults.tsx)
- npx tsc --noEmit → limpio
- npx vitest run → 500+ tests passed (todos los de auth incluidos)
- npm run dev + /login carga sin errores de consola en los tres modos

### Archivos que toco
- `src/app/[locale]/login/LoginPage.tsx`
- `src/components/ui/KButton.tsx` (añadir `loading` prop)
- `docs/NOW.md`, `docs/DONE.md`

### Cuándo paro
Tras commit [B3.5f-2c] + verificación visual del usuario.

## Nota

Chrome global (AuthHeader, BottomNav, Avatar) → CERRADO. No re-tocar.
Library (LibraryClient, LibraryAction, LibraryStatusModal, EpisodeProgress) → CERRADO. No re-tocar salvo bug.
Discover → NO es 2c. Está roto (paginación + anime/comics/manga sin resultados) y se rediseña+arregla en f-4.
Verde de marca = `--accent-positive`. FilterChip y KButton son los componentes canónicos.
