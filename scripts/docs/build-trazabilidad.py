#!/usr/bin/env python3
"""Genera docs/_trazabilidad.md: inventario de TODO lo que la documentación
debe cubrir (tareas, commits, docs antiguos, código). Fase A del plan de
documentación. Reejecutable: `python3 scripts/docs/build-trazabilidad.py`."""
import re, subprocess, collections, pathlib, os

ROOT = pathlib.Path(__file__).resolve().parents[2]
OLD_REV = "ab8eb4e^"  # último commit con los docs de proceso antes de borrarlos
git = lambda *a: subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True, check=True).stdout
old = lambda p: git("show", f"{OLD_REV}:{p}")

def root_id(i):
    i = i.strip().lstrip("﻿")
    m = re.match(r"(SPEC-\d+|B\d+\.\d+[a-z]?|[A-Z]+\d+[a-z]?)", i)
    return m.group(1) if m else i

# ---------- 1. Tareas: BACKLOG + DONE + NOW + commits ----------
tasks = collections.OrderedDict()
def T(i):
    r = root_id(i)
    return tasks.setdefault(r, {"titulo": "", "estado": set(), "fuentes": set(), "commits": [], "subids": set()})

backlog = old("docs/BACKLOG.md")
for m in re.finditer(r"^\s*- \[([ x])\] \*\*([A-Z][\w.\-/+]*?)[.*:]\*?\*?\s*(.*)$", backlog, re.M):
    t = T(m.group(2)); t["subids"].add(m.group(2)); t["fuentes"].add("BACKLOG")
    t["estado"].add("hecha" if m.group(1) == "x" else "pendiente")
    t["titulo"] = t["titulo"] or re.sub(r"[*✅]|\(cerrada.*", "", m.group(3)).strip()[:90]
for m in re.finditer(r"^20\d\d-\d\d-\d\d \| ([^|]+) \| ([^|]*) \|\s*(.*)$", old("docs/DONE.md"), re.M):
    for i in re.split(r"[+/]", m.group(1).strip()):
        if not i.strip(): continue
        t = T(i); t["subids"].add(m.group(1).strip()); t["fuentes"].add("DONE"); t["estado"].add("hecha")
        b = re.search(r"\*\*(.+?)\*\*", m.group(3))
        t["titulo"] = t["titulo"] or (b.group(1) if b else m.group(3))[:90]
for m in re.finditer(r"^([A-Z][\w.\-/ ()]*?) → ", old("docs/NOW.md"), re.M):
    for i in re.split(r"[+/ ]", m.group(1)):
        if re.match(r"[A-Z]+\d", i): T(i)["fuentes"].add("NOW")

commits = [l.split("|", 3) for l in git("log", "--reverse", "--format=%h|%ad|%an|%s", "--date=short").splitlines()]
sin_id = []
for h, d, a, s in commits:
    s2 = s.lstrip("﻿")
    ids = re.findall(r"\[([^\]]+)\]", s2) + re.findall(r"(SPEC-\d+)", s2)
    ids = [i for i in ids if re.match(r"(SPEC-\d+|[A-Z]+\d)", i)]
    if not ids:
        sin_id.append((h, d, a, s2)); continue
    for i in {root_id(x) for x in ids}:
        t = T(i); t["commits"].append((h, d)); t["fuentes"].add("git")
        t["titulo"] = t["titulo"] or re.sub(r"\[[^\]]+\]\s*", "", s2)[:90]

def capitulo(i, titulo):
    s = (i + " " + titulo).lower()
    rules = [(r"\b(rls|polic\w*|seguridad|security|csp|rate[- ]?limit\w*|credencial\w*|redirect|hsts|headers?|sec-fix)\b", "05"),
             (r"\b(migraci\w+|schema|tablas?|rpc|sql|baseline|trigger)\b", "04"),
             (r"\b(tmdb|jikan|rawg|comicvine|open library|openlibrary|mangadex|google books|nsfw|filtros?|discover|descubrir|paginaci\w+|libros)\b", "06"),
             (r"\b(tests?|e2e|vitest|playwright)\b", "08"),
             (r"\b(ci|deploy|vercel|sentry|env|logger|zod|gitignore)\b", "09"),
             (r"\b(diseño|visual|f0|ui|tokens?|nav\w*|pills?|badge|layout|design)\b", "07"),
             (r"\b(legal|privacidad|términos|eliminación de cuenta|exportación)\b", "05"),
             (r"\b(ia|ai|claude|gemini|recomendaci\w+|match)\b", "06"),
             (r"\b(chat|amig\w+|grupos?|listas?|notif\w*|social|dms?|biblioteca|library|perfil)\b", "01")]
    for rx, c in rules:
        if re.search(rx, s): return c
    return "?"

# ---------- 2. Docs antiguos ----------
old_docs = [p for p in git("ls-tree", "-r", "--name-only", OLD_REV).splitlines()
            if p.endswith(".md") and (p.startswith("docs/") or "/" not in p)]
doc_map = [(r"RLS_AUDIT|SCHEMA|db-agent", "04, 05"), (r"E2E|TEST|SUPABASE_TEST|B3_5e", "08"),
           (r"DESIGN|UI_AUDIT|ui-agent|layout-agent", "07"), (r"E59|APIS|api-agent", "06, 06b"),
           (r"DEPLOY", "09"), (r"DEBUG|CHECKLISTS|gate-keeper|PHASES|orchestrator/DECISIONS", "12, 15"),
           (r"FASE-\d|orchestrator|agents-old|SESSION|AUDIT_2026|ESTADO|ROADMAP", "11"),
           (r"BACKLOG|DONE|NOW|BLOCKERS", "11, 13, anexo"), (r"STRUCTURAL", "03, 13"),
           (r"B3_5c_BUGS|AUDIT\.md", "13"), (r"ai-agent", "06"), (r"auth-agent", "05"),
           (r"i18n", "03"), (r"social|library", "01"), (r"DOSSIER", "estructura (se reaprovecha)"),
           (r"CLAUDE", "07, 12")]
def doc_cap(p):
    for rx, c in doc_map:
        if re.search(rx, p): return c
    return "⚠️ sin asignar"

# ---------- 3. Código ----------
def files(glob): return sorted(str(p.relative_to(ROOT)) for p in ROOT.glob(glob))
routes = files("src/app/api/**/route.ts")
pages = files("src/app/[[]locale]/**/page.tsx")
migs = files("supabase/migrations/*.sql")
libs = files("src/lib/**/*.ts")
comps = files("src/components/**/*.tsx")
tests = files("tests/**/*.test.ts*") + files("tests/**/*.spec.ts")
tables = sorted(set(re.findall(r'create table (?:if not exists )?"?public"?\."?(\w+)"?',
                "\n".join((ROOT / m).read_text() for m in migs), re.I)))

# ---------- Salida ----------
o = []; w = o.append
w("# Matriz de trazabilidad (Fase A)\n")
w("> **Qué es esto.** El inventario de TODO lo que la documentación debe explicar. Cada fila es un")
w("> elemento que tiene que aparecer en algún capítulo. En la Fase C, un script comprobará que no")
w("> queda ninguna fila huérfana: así garantizamos que no se pierde información.")
w(">\n> Generado por `scripts/docs/build-trazabilidad.py` — no editar a mano; reejecutar el script.")
w("> La columna *Capítulo* es una **propuesta automática** (por palabras clave); se revisa en la Fase B.")
w("> `11 + ?` = va seguro al capítulo 11 (historia); el capítulo temático está por asignar.\n")
w("## Resumen de fuentes\n")
w("| Fuente | Cantidad |\n|---|---|")
w(f"| Commits en git | {len(commits)} ({commits[0][1]} → {commits[-1][1]}) |")
w(f"| Commits con ID de tarea | {len(commits)-len(sin_id)} |")
w(f"| Commits sin ID (merges, docs sueltos…) | {len(sin_id)} |")
w(f"| Tareas / épicas distintas (ID raíz) | {len(tasks)} |")
w(f"| Docs de proceso borrados en `ab8eb4e` (recuperables) | {len(old_docs)} |")
w(f"| Endpoints de API (`route.ts`) | {len(routes)} |\n| Páginas (`page.tsx`) | {len(pages)} |")
w(f"| Migraciones SQL | {len(migs)} |\n| Tablas creadas en migraciones | {len(tables)} |")
w(f"| Módulos `src/lib` | {len(libs)} |\n| Componentes `src/components` | {len(comps)} |\n| Ficheros de test | {len(tests)} |\n")
w("**Hueco conocido:** entre el 2026-04-12 (SPEC-001…007) y el 2026-05-02 casi no hay commits; ese")
w("periodo solo está contado en `ESTADO_PROYECTO.md`, `_archive/AUDIT_2026-04-23.md` y los")
w("`agents-old/` — el capítulo 11 debe reconstruirlo desde ahí.\n")

w("## A. Tareas y épicas\n")
w("Estado: según BACKLOG/DONE antiguos. *Fuentes*: dónde aparece. *Commits*: nº y rango de fechas.\n")
w("| ID | Título | Estado | Fuentes | Commits | Fechas | Capítulo |\n|---|---|---|---|---|---|---|")
def key(i):
    m = re.match(r"([A-Z]+)-?(\d+)(.*)", i); return (m.group(1), int(m.group(2)), m.group(3)) if m else (i, 0, "")
for i in sorted(tasks, key=key):
    t = tasks[i]; c = t["commits"]
    est = "hecha" if "hecha" in t["estado"] else ("pendiente" if t["estado"] else "—")
    fechas = f"{c[0][1]} → {c[-1][1]}" if c else "—"
    tit = t["titulo"].replace("|", "\\|").replace("`", "")
    w(f"| {i} | {tit} | {est} | {', '.join(sorted(t['fuentes']))} | {len(c)} | {fechas} | 11 + {capitulo(i, t['titulo'])} |")

w("\n## B. Commits sin ID de tarea\n")
w("Se cubren en el capítulo 11 (historia) por fecha. Los merges de PR marcan hitos.\n")
w("| Commit | Fecha | Autor | Mensaje |\n|---|---|---|---|")
for h, d, a, s in sin_id:
    w(f"| `{h}` | {d} | {a} | {s[:110].replace('|', '/')} |")

w("\n## C. Documentación de proceso borrada (fuente, recuperable con `git show ab8eb4e^:<ruta>`)\n")
w("| Fichero | Líneas | Capítulo(s) |\n|---|---|---|")
for p in old_docs:
    n = old(p).count("\n")
    w(f"| `{p}` | {n} | {doc_cap(p)} |")

w("\n## D. Código\n")
w("### D1. Endpoints de API → capítulo 06b\n")
w("| Ruta | Fichero |\n|---|---|")
for r in routes:
    w(f"| `/{r[len('src/app/'):-len('/route.ts')]}` | `{r}` |")
w("\n### D2. Páginas → capítulos 01 y 07\n")
w("| Ruta | Fichero |\n|---|---|")
for p in pages:
    ruta = re.sub(r"/\([^)]+\)", "", p[len("src/app/"):-len("/page.tsx")] if p.count("/") > 3 else "[locale]")
    w(f"| `/{ruta}` | `{p}` |")
w("\n### D3. Migraciones → capítulo 04\n")
for m in migs: w(f"- `{m}`")
w("\n### D4. Tablas (creadas en migraciones) → capítulo 04\n")
w(", ".join(f"`{t}`" for t in tables))
w("\n\n### D5. Módulos `src/lib` → capítulos 02, 03, 06\n")
for l in libs: w(f"- `{l}`")
w("\n### D6. Componentes → capítulo 07\n")
for c in comps: w(f"- `{c}`")
w("\n### D7. Tests → capítulo 08\n")
by = collections.Counter("/".join(t.split("/")[:3]) for t in tests)
w("| Carpeta | Ficheros |\n|---|---|")
for k, v in sorted(by.items()): w(f"| `{k}` | {v} |")

out = ROOT / "docs" / "_trazabilidad.md"
out.parent.mkdir(exist_ok=True)
out.write_text("\n".join(o) + "\n")
print(f"OK {out}: {len(tasks)} tareas, {len(sin_id)} commits sin ID, {len(old_docs)} docs, "
      f"{len(routes)} rutas, {len(pages)} páginas, {len(tables)} tablas")
