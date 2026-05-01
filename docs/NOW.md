# NOW

> La ÚNICA tarea en la que estás trabajando ahora mismo.
> Cuando esté hecha: mover entrada a `DONE.md`, marcar en `BACKLOG.md`, y poner aquí la siguiente.


## Progreso de A5
 
**Sesión 1 (2026-05-01) — completada:**
- ✅ A5.1 — `[c845fc6]` types/library + supabase.ts
- ✅ A5.2 — `[52b9037]` APIs externas (9 archivos)
- ✅ A5.2-bis — `[45b99b0]` rate-limit.ts
- ✅ A5.3 — `[<HASH-DEL-COMMIT-A5.3>]` library completa (queries, actions, stats, componentes, tests)

**Sesión 2 (2026-05-01) — completada:**
- ✅ A5.4 — `dcc40a4` social (26 archivos: lib/social, components/social, components/profile, tests/unit/social, tests/integration/db/friends)
- ✅ A5.5 — `9124c48` ai (Claude adapter + 3 route handlers + 2 tests)
- ✅ A5.6 — `83c439e` api-routes (15 route handlers restantes)

**Sesión 3 (2026-05-01) — completada:**
- ✅ A5.7  — `9778ced` ui (28 archivos: home, layout, search, media-detail, ui ampliados, hook useToast, avatarColors)
- ✅ A5.8  — `6a4c520` app (45 archivos: rutas (app)/* + error boundaries + 5 modificados de bootstrap)
- ✅ A5.9  — `ba6dc28` i18n (es.json + en.json, +362 líneas c/u)
- ✅ A5.10 — `2938140` config + deps + refactor cn (12 archivos, incluye Button/MediaCard/MediaGrid migrados al nuevo cn)

**Próxima sesión (sesión 4):** A5.11 (tests update + nuevos), A5.12 (docs), A5.13 (borrados), A5.14 (push GitHub). Cierra A5.


**Decisiones tomadas durante la ejecución:**
- `src/lib/utils/index.ts` (modificación cn → clsx+tailwind-merge) → va en A5.10 con package.json
- `src/lib/constants/avatarColors.ts` → va en A5.7 con UI
- `src/lib/rate-limit.ts` → su propio commit A5.2-bis (no agrupar con APIs)
- `src/lib/library/queries.ts` no estaba commiteado pese a estar referenciado por B1-A. Incluido en A5.3.
**Próxima sesión (sesión 2):** A5.4 (social), A5.5 (AI), A5.6 (route handlers).
 
**Hallazgo a registrar al cerrar A5:** B1-A introdujo `queries.test.ts` referenciando `queries.ts` que no estaba commiteado. Crear A6 — Auditoría de coherencia repo vs disco — al cerrar A5.
 

**Decisión sesión 3 (A5.7 / A5.10):** Los 3 componentes modificados Button.tsx, MediaCard.tsx, MediaGrid.tsx se agruparon con A5.10 (en lugar de A5.7) por acoplamiento al refactor de src/lib/utils/index.ts (cn → clsx + tailwind-merge). A5.10 absorbe utils + 3 consumidores para mantener atomicidad del cambio. Bisect-friendly.

- A5.10 absorbe Button.tsx + MediaCard.tsx + MediaGrid.tsx (originalmente esperados en A5.7 o A5.11) por acoplamiento con el refactor cn → clsx + tailwind-merge. Atomicidad sobre granularidad.
---
 
---

## Tarea activa: A5 — Versionar el estado actual del proyecto

**Iniciada:** (mañana)
**Bloqueante de:** B1-B (CI), B1-C (arreglar register-form), B2 (migraciones SQL), y todo lo demás.

### Contexto descubierto durante B1-A (2026-05-01)

El repo `kultura/` tiene 9 commits totales. Los 8 anteriores a B1-A corresponden a la Fase 1 (Fundación) del flujo spec-driven viejo. Después se paró de versionar y todo el trabajo de Fases 2-5 (APIs externas, biblioteca, social, IA, listas, grupos, chat) está en disco sin commitear. Tampoco hay remoto en GitHub. Si el disco falla, se pierden ~4 meses de código.

`git status --short` actual: ~25 archivos modificados/borrados respecto al último commit + ~80 carpetas/archivos sin trackear.

### Qué cambia (1 frase)
Se hacen commits temáticos que reflejen las fases ya construidas (en orden lógico) y se sube el repo a un remoto en GitHub.

### Cómo sé que funciona
```powershell
cd "E:\app movies\kultura"

# 1. git status debe quedar limpio
git status --short
# Debe devolver vacío (todo commiteado, .env.local ignorado correctamente).

# 2. Hay al menos 5-7 commits temáticos nuevos sobre B1-A
git log --oneline a519684..HEAD | wc -l
# Debe devolver >= 5.

# 3. Existe remoto y push hecho
git remote -v
# Debe mostrar origin con URL de GitHub.

git status -sb
# Debe mostrar "## master...origin/master" (o similar) sin "[ahead N]".

# 4. La app sigue funcionando después de todo el versionado
npm run dev
# /es/discover y /es/home cargan sin errores.
```

### Plan de commits temáticos (orden propuesto)

Hacer en este orden, ejecutando `git status --short` entre cada uno para confirmar que solo queda lo que aún no toca:

1. **`[A5.1] feat(types): tipos compartidos para library y list`**
   `src/types/library.ts`, modificaciones a `src/types/supabase.ts`.

2. **`[A5.2] feat(api): integraciones APIs externas (TMDB, Jikan, Books, MangaDex, RAWG, ComicVine)`**
   `src/lib/api/*` completo, `src/lib/rate-limit.ts`, `src/lib/constants/`.

3. **`[A5.3] feat(library): biblioteca personal — actions, queries, stats`**
   `src/lib/library/*`, `src/components/library/*`, `tests/unit/library/*` (actions, route, stats), `tests/integration/db/library-upsert.test.ts`.

4. **`[A5.4] feat(social): amigos, listas, recomendaciones, feed, notificaciones`**
   `src/lib/social/*`, `src/components/social/*`, `src/components/profile/*`, `tests/integration/db/friends.test.ts`, `tests/unit/social/`.

5. **`[A5.5] feat(ai): recomendaciones Claude server-side`**
   `src/lib/claude/*`, `src/app/api/ai-recommendations/`, `src/app/api/recommendations/`, `src/app/api/genre-news/`, `tests/unit/ai/`, `tests/unit/claude/`.

6. **`[A5.6] feat(api-routes): route handlers (library, lists, friends, chat, groups, notifications, search, settings, suggestions, users, reports)`**
   El resto de `src/app/api/*` que no esté ya commiteado.

7. **`[A5.7] feat(ui): componentes adicionales (home, layout, search, media-detail, ui ampliados)`**
   `src/components/home/*`, `src/components/layout/*`, `src/components/search/*`, `src/components/media/MediaDetail.tsx`, `src/components/media/StreamingProviders.tsx`, `src/components/media/SynopsisSection.tsx`, `src/components/media/TrailerEmbed.tsx`, los nuevos en `src/components/ui/*` (FilterBar, Pagination, Select, Toast, ToastProvider, input), `src/hooks/*`.

8. **`[A5.8] feat(app): rutas de aplicación bajo (app), error boundaries, error pages`**
   `src/app/[locale]/(app)/*`, `src/app/[locale]/error.tsx`, modificaciones de `layout.tsx`, `page.tsx`, `globals.css`, `LoginPage.tsx`.

9. **`[A5.9] feat(i18n): traducciones completas es/en para Fases 2-5`**
   Modificaciones a `messages/es.json` y `messages/en.json`.

10. **`[A5.10] chore(config): config y deps actualizadas`**
    Modificaciones a `package.json`, `package-lock.json`, `next.config.mjs`, `tailwind.config.ts`, `.gitignore`, `vercel.json`, `vitest.contract.config.ts`, `components.json`.

11. **`[A5.11] test(updates): actualización de tests existentes (button, media-card, media-grid) + nuevos (Toast, contract, e2e, etc.)`**
    Modificaciones a tests viejos + `tests/contract/*`, `tests/e2e/*`, `tests/unit/api/*`, `tests/unit/components/Toast.test.tsx`, etc.
    **Nota:** los tests rotos descubiertos (register-form, etc.) NO se arreglan aquí. Se commitean tal cual están y se arreglan en B1-C.

12. **`[A5.12] docs: AUDIT, CLAUDE.md, flujo NOW/BACKLOG/DONE`**
    `AUDIT.md`, `CLAUDE.md`, carpeta `docs/`. **Pero antes verificar que `.claude/` está en .gitignore y que `docs/_archive/` se commitea o no** (decisión: sí, queda como referencia histórica del flujo viejo).

13. **`[A5.13] chore: borra archivos obsoletos`**
    `.env.example` (borrado — usar `.env.local` real), `README.md` (borrado — se rehará), `src/components/media/index.ts` (borrado), `src/components/ui/index.ts` (borrado), `supabase/migrations/001_initial_schema.sql` (borrado — pendiente de B2 que regenera el schema completo).

14. **A5.14 — Crear remoto en GitHub:**
    - Crear repo `kultura` en https://github.com/new (privado, sin README, sin .gitignore, sin license — todo eso ya lo tienes).
    - `git remote add origin https://github.com/<usuario>/kultura.git`
    - `git push -u origin master`

### Archivos que toco
Casi todos. Pero el cambio NO es de contenido, es solo de versionado. Ningún archivo se modifica salvo posibles ajustes mínimos al `.gitignore` si descubrimos algún hueco.

### Cuándo paro
Cuando los 4 checks de "Cómo sé que funciona" pasan limpios.

### Fuera de alcance (NO hacer ahora)
- **No arreglar** los 4 tests fallando en register-form. Eso es **B1-C** (nueva tarea registrada en BACKLOG).
- **No crear** el workflow de CI. Eso es **B1-B**, después de A5.
- **No regenerar** las migraciones SQL. Eso es **B2**.
- **No tocar** código de la app salvo el .gitignore.
- **No commit hooks**, **no husky**, **no semantic-release**. Cero infra extra.

### Reglas operativas para A5
1. **Antes de empezar:** crear backup zip por si acaso.
   ```powershell
   cd "E:\app movies"
   Compress-Archive -Path kultura -DestinationPath "kultura-backup-2026-05-01.zip" -Force
   ```
2. **Cada commit es atómico.** Si entre commits, `git status --short` muestra archivos del commit anterior, pararse y entender por qué.
3. **Después de cada commit, ejecutar** `npx tsc --noEmit` (no es obligatorio que pase, ya sabemos que falla por register-form). El objetivo es que **no aparezcan errores nuevos** que no estaban antes.
4. **No aplastar commits a posteriori.** Si te sale mal, mejor un nuevo commit `[A5.X-FIX]` que un rebase.

---

## Instrucciones para Claude Code en esta tarea

A5 es **larga y delicada**. No la abordes en una sola sesión. Sugerencia:

```
Lee CLAUDE.md y docs/NOW.md. Vamos con A5.

Sesión 1 (hoy): commits A5.1, A5.2, A5.3 — solo eso. Verificar que
git status --short queda limpio para esos archivos. PARAR.

Sesión 2 (otra vez): A5.4, A5.5, A5.6.

Sesión 3: A5.7, A5.8, A5.9, A5.10.

Sesión 4: A5.11, A5.12, A5.13, A5.14 (push a GitHub).

Antes de cada commit, lista los archivos exactos que vas a stagear con
git add <ruta1> <ruta2> ... (NUNCA git add -A ni git add .). Pega el
output de git status --short antes y después de cada commit para que yo
verifique.
```