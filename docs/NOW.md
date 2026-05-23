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
B3.5f-2g → ✅ CERRADO (Profile migrado al DS, loading skeleton, i18n ReportButton, 506 tests green, commits 87beaf0…c4c227e)
B3.5f-2g-2 → ✅ CERRADO (fila Pendientes + empty state propio/ajeno, 506 tests green, commit 19a82af)

## Tarea activa

**Ninguna. Pendiente verificación visual de B3.5f-2g-2 por el usuario (Regla 11).**

## Qué se hizo en B3.5f-2g

- **ProfileBio:** `bg-accent`/`ring-accent`/`hover:text-accent` → tokens accent-positive. Botón Guardar → `KButton primary`. Botón Cancelar → `KButton secondary`.
- **ProfileHeader:** `bg-surface` → `bg-surface-default` + `border border-surface-border` + `rounded-card`. `text-text` → `text-text-primary`. `text-muted` → `text-text-tertiary`. `border-border` → `border-surface-border`.
- **ProfileStats:** `bg-surface2` → `bg-surface-elevated` + `border border-surface-border`. `text-text` → `text-text-primary`. `text-muted` → `text-text-secondary/tertiary`.
- **ProfileGenres:** `bg-surface2` → `bg-surface-elevated` + `border border-surface-border`. `text-muted` → `text-text-secondary`.
- **page.tsx:** Link "Editar perfil" (anchor legacy) → `KButton asChild variant="secondary"`.
- **FriendshipButton:** `Button` legacy (bg-accent) → `KButton`. `hover:text-red-400` → `hover:text-accent-danger` (semántico destructivo: quitar amigo).
- **ReportButton:** `Button` legacy → `KButton`. `bg-bg` → `bg-surface-base`. `ring-accent` → `ring-accent-positive`. `red-400` → `accent-danger` (error semántico). Prop `label` eliminada. Strings hardcoded en ES → `useTranslations('report')`.
- **loading.tsx:** Skeleton completo para `/profile/[username]`: card header (avatar + texto + stats row), 2 filas de portadas (aspect-2/3), stats grid 2×4, chips de géneros.
- **i18n:** Namespace `report` añadido a `es.json` + `en.json` con paridad: label, prompt, placeholder, error, cancel, submit, sent.
- **Test:** `ProfileGenres.test.tsx` — aserción de clase actualizada de `bg-surface2` → `bg-surface-elevated`.

## Hallazgos de verificación visual

- 0 elementos con `bg-accent` legacy (E82020) en la página.
- 0 elementos con `bg-surface2` legacy.
- 3 elementos con `bg-surface-default` (card header + stats section + page containers).
- 0 elementos con computed color `rgb(232, 32, 32)` en backgrounds.
- FriendshipButton y ReportButton: `KButton` confirmados. Report dialog textarea con `bg-surface-base`.
- Not-found: página 404 de marca correcta.

## Siguiente tarea disponible

Ver BACKLOG. Próxima pantalla pendiente en B3.5f o cierre del sprint con B3.5f-CLOSE.
