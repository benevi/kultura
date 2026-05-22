# NOW
> Una sola tarea activa.

## Estado

B3.5f-2b → ✅ CERRADO (Library migrada, 506 tests green)
B3.5f-2c → ✅ CERRADO (Login/Auth migrada)
B3.5f-2d → ✅ CERRADO (Settings migrada)
B3.5f-2e → ✅ CERRADO (Landing pública + header público migrados, 506 tests green, commit 9b6c70e)
B3.5f-DEBUG-DOC → ✅ CERRADO (docs/DEBUG_PRINCIPLES.md + Regla 12 en CLAUDE.md, commit 5d6443a)
B3.5f-PUBLIC-AUDIT → ✅ CERRADO (auditoría sin código de pantallas públicas/borde; ver reporte en NOW)

## Tarea activa

**Ninguna. Pendiente verificación visual de B3.5f-2e por el usuario (Regla 11).**

## Hallazgos de B3.5f-PUBLIC-AUDIT

**404 / not-found:** NO EXISTE ningún `not-found.tsx` en el repo. Next.js usa su pantalla por defecto.

**Error boundaries:** 11 archivos `error.tsx` existen (2 a nivel locale, 9 en rutas de `(app)/`). Todos idénticos, todos usan `bg-primary text-primary-foreground`. `--primary: 0 79% 51%` en globals.css = rojo legacy (#E82020). El botón "Intentar de nuevo" en todos los error boundaries es **rojo legacy** — no usa KButton ni design system.

**global-error.tsx:** NO EXISTE.

**loading.tsx:** NO EXISTE en ningún nivel.

**Auth callback:** Solo existe `src/app/api/auth/callback/route.ts` — Route Handler puro (no hay página visual). Redirige a `/login?error=auth_callback_error` en fallo. No hay pantalla de confirmación de email dedicada.

**Reset / forgot password:** NO EXISTE pantalla propia. El login maneja el flujo de forgot en el mismo `LoginPage.tsx`.

**Términos / privacidad / legal:** NO EXISTEN como páginas.

**`/dev`:** Existe como sandbox de diseño (`src/app/dev/page.tsx`). No indexada, no linkada, sin sesión requerida. Limpia — usa tokens del design system (CSS vars inline, no Tailwind legacy).

## Pantallas que merecen bloque de rediseño

1. **Error boundaries** — todos los `error.tsx` (11 archivos) usan botón con `bg-primary` = rojo legacy. Candidatos a unificarse en un solo componente `ErrorBoundaryUI` usando KButton secondary. Merecen bloque propio (B3.5f-2f o similar).
2. **404 not-found** — no existe. Crear `not-found.tsx` con chrome del sistema es tarea pequeña pero visible para cualquier URL rota.
3. **global-error.tsx** — no existe. Debería existir para errores de layout que rompen el layout raíz.

## Siguiente tarea disponible

Ver BACKLOG. Propuesta: B3.5f-2f = error boundaries (11 archivos → 1 componente + KButton).
