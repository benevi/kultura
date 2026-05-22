# NOW
> Una sola tarea activa.

## Estado

B3.5f-2b → ✅ CERRADO (Library migrada, 506 tests green)
B3.5f-2c → ✅ CERRADO (Login/Auth migrada)
B3.5f-2d → ✅ CERRADO (Settings migrada)
B3.5f-2e → ✅ CERRADO (Landing pública + header público migrados, 506 tests green, commit 9b6c70e)
B3.5f-DEBUG-DOC → ✅ CERRADO (docs/DEBUG_PRINCIPLES.md + Regla 12 en CLAUDE.md, commit 5d6443a)
B3.5f-PUBLIC-AUDIT → ✅ CERRADO (auditoría sin código de pantallas públicas/borde; ver reporte en DONE)
B3.5f-2f → ✅ CERRADO (error boundaries + páginas de error, 506 tests green)
B3.5f-2f-FIX → ✅ CERRADO (wiring not-found para rutas desconocidas, 506 tests green)

## Tarea activa

**Ninguna. Pendiente verificación visual de B3.5f-2f-FIX por el usuario (Regla 11).**

## Qué se hizo en B3.5f-2f-FIX

- **Causa raíz:** `[locale]/not-found.tsx` nunca se disparaba para rutas inexistentes. Next.js App Router busca `not-found.tsx` en el segmento raíz de `app/`; como no existía, caía al default de Next.js.
- `src/app/[locale]/[...rest]/page.tsx` — catch-all nuevo, llama `notFound()`. Captura `/es/asdfgh` y dispara `[locale]/not-found.tsx` con i18n completo.
- `src/app/not-found.tsx` — not-found raíz para `/asdfgh` (sin locale). Hardcoded español (locale por defecto). Usa `NotFoundContent` compartido.
- `src/components/ui/NotFoundContent.tsx` — componente compartido con props, sin dependencia de next-intl. Reutilizado por ambos not-found.
- `src/app/layout.tsx` — añadido `import './globals.css'` para que Tailwind aplique en root not-found.
- `[locale]/not-found.tsx` — actualizado para usar `NotFoundContent` (markup idéntico al de 2f).

## Siguiente tarea disponible

Ver BACKLOG. Próximo en sprint B3.5f o cierre del sprint con B3.5f-CLOSE.
