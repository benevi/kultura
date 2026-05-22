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

## Tarea activa

**Ninguna. Pendiente verificación visual de B3.5f-2f por el usuario (Regla 11).**

## Qué se hizo en B3.5f-2f

- `src/components/layout/ErrorState.tsx` — componente unificado con KButton secondary (verde, no rojo)
- 11 `error.tsx` → wrappers finos que importan ErrorState. [locale]/error.tsx conserva min-h-[60vh].
- `src/app/[locale]/not-found.tsx` — página 404 con chrome de Kultura, tokens, KButton primary → /home, i18n es/en.
- `src/app/global-error.tsx` — root fallback autosuficiente con html/body propio e inline styles con tokens de marca.
- i18n: `errors.notFoundTitle`, `errors.notFoundDescription`, `errors.goHome` añadidos en es.json y en.json.
- `--primary` NO tocada en globals.css.

## Siguiente tarea disponible

Ver BACKLOG. B3.5f-sprint de migración visual continúa con pantallas pendientes o cerrando con B3.5f-CLOSE.
