# DONE

Log de tareas cerradas. Formato: `fecha | id | commit corto | nota si aplica`.

No se edita a mano durante el día. Solo se añade una línea al terminar cada tarea.

---

2026-05-01 | A1 | (sin commit, trabajo de dashboards) | Migración a sistema nuevo de Supabase API keys (`sb_publishable_*` + `sb_secret_*`). Legacy JWT keys deshabilitadas. App verificada en local + Vercel actualizado.

---

2026-05-01 | A2 | (sin commit, verificación) | .gitignore ya contenía `.claude/` (línea 42). 4 checks pasan: .claude/ ignorado, no trackeado, sin secretos en archivos trackeados, sin tokens en historial git.

---

2026-05-01 | A3 | (sin commit, dashboards externos) | Rotadas claves de Anthropic, TMDB, RAWG, Google Books y ComicVine. Valores nuevos en .env.local + Vercel. App verificada con npm run dev: TMDB/RAWG/Books/Anthropic OK.

---

2026-05-01 | A4 | (sin commit, verificación) | Diagnóstico: código y .env.local ya estaban unificados sin NEXT_PUBLIC_ para claves server-only (4/4 leídas correctamente: TMDB, RAWG, GOOGLE_BOOKS, ANTHROPIC). COMICVINE_KEY existe en env pero no se lee en src/ porque la integración no está implementada (E6).

---

 2026-05-01 | B1-A | a519684 | Limpiar tests huérfanos (3 tests sobre componentes 
       inexistentes borrados, 1 test de @/lib/env movido a _pending) + sincronizar 
       mock de queries.test.ts con .order(). Descubierto: 4 tests pre-existentes 
       fallando en register-form (no relacionados con B1-A).

---

