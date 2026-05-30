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
B3.5f-2g → ✅ CERRADO (Profile migrado al DS, loading skeleton, i18n ReportButton, 506 tests green)
B3.5f-2g-2 → ✅ CERRADO (fila Pendientes + empty state propio/ajeno, 506 tests green, commit 19a82af)
B3.5f-2h-AMIGOS → ✅ CERRADO (Amigos migrada al DS, 506 tests green, commit 6eccb5a)
B3.5f-2h-LISTAS → ✅ CERRADO (Listas migrada al DS, 506 tests green, commit 535e726)
B3.5f-2h-NOTIF → ✅ CERRADO (Notificaciones migrada al DS, 506 tests green, commit b40c518)
B3.5f-2h-SUGERENCIAS → ✅ CERRADO (Sugerencias migrada al DS, 506 tests green, commit 388c8fc)
B3.5f-2h-CHAT → ✅ CERRADO (Chat migrada al DS, 506 tests green, commit 8af552f)
B3.5f-3 (nivel mínimo) → ✅ CERRADO (tokens movimiento, prefers-reduced-motion, FilterBar normalizada, DS §8, 506/57 green, commits 17d7186 + 63e76be)
B3.5f-3 (nivel medio) → ✅ CERRADO (modales fade+scale, loading.tsx home/discover/library E56, toast slide-in/out, FilterChip scale, 506/57 green, commits 714ffb6 + c537376 + 4cabe88)
B3.5f-4 + E29 → ✅ CERRADO (JikanError+guards+catch 429+i18n rateLimit, fetchDiscoverData extraída, 521/58 green, commits 389d99f+445dcc3+93db7c5+fe4f3f1; Fase B visual: banner accent-danger + DiscoverClient accent-info + MediaGrid ya migrado, commits 94d9870+38cd520)
E47 → ✅ CERRADO (Listas: añadir/quitar título, alcance ampliado, 530/59 green, commits b64680c+7e77796+6d8d8d1+5bf789b+049c061+540d0e7+bec8bc4; hallazgos previos en 59701e7)
E-AI-GEMINI → ✅ CERRADO (Recomendaciones IA migradas de Anthropic/Claude a Google Gemini `gemini-2.5-flash` free tier, 530/59 green, commit 241d4fe)

## Tarea activa

**SIN TAREA ACTIVA** — E-AI-GEMINI cerrado el 2026-05-30. Pendiente confirmación del usuario para la siguiente tarea.

Motivo: coste. Anthropic de pago; Gemini free tier suficiente para el motor de recomendaciones.

### Qué cambia

- `package.json`: quitar `@anthropic-ai/sdk`, añadir `@google/genai`.
- `src/lib/claude/recommendations.ts`: import, init de cliente y llamada (`messages.create` → `models.generateContent`), extracción de texto de respuesta, comentario de cabecera (Claude→AI, ANTHROPIC→GEMINI). Resto intacto (caché, tipos, buildPrompt, getLibraryContext, validación JSON, exports, firma pública).
- `src/app/api/ai-recommendations/route.ts`: comentario de cabecera (ANTHROPIC→GEMINI).
- Tests `tests/unit/claude/recommendations.test.ts` y `tests/unit/ai/ai-recommendations.test.ts`: re-mockear `@google/genai` con forma de respuesta Gemini (`messages.create`→`models.generateContent`, `content[0].text`→`response.text`), env `ANTHROPIC_API_KEY`→`GEMINI_API_KEY`.
- `.env.local`: añadir `GEMINI_API_KEY=` (vacío, lo rellena el usuario). No al repo.
- `CLAUDE.md`: Stack, tabla APIs, Env vars, Reglas 1 y 1b → Gemini.

Modelo objetivo: `gemini-2.5-flash`. SDK: `@google/genai`.

### Cómo sé que funciona

- `npx tsc --noEmit` → EXIT 0
- `npm run lint` → 0 errores
- `npx vitest run` → 530 passed / 59 files

### Archivos que toco
package.json · package-lock.json · src/lib/claude/recommendations.ts · src/app/api/ai-recommendations/route.ts · tests/unit/claude/recommendations.test.ts · tests/unit/ai/ai-recommendations.test.ts · CLAUDE.md · .env.local (no-git)

### Cuándo paro
Tras los 3 checks verdes y el commit. No empezar siguiente tarea sin confirmación.
