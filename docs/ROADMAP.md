# ROADMAP — KULTURA

> **Qué es esto.** Una vista por **prioridad e impacto** hacia el objetivo final: producción real con usuarios pagando. Ordena el trabajo por *lo que de verdad bloquea el lanzamiento*, no por número de tarea.
>
> **Qué NO es.** No sustituye a `BACKLOG.md`. El BACKLOG es la fuente de verdad del **orden de ejecución** (bloques A→F, se trabaja de arriba a abajo) y del **detalle** de cada tarea con su criterio de "hecho". Este documento es el mapa estratégico; el BACKLOG es el plan de obra.
>
> **Fuente del estado.** Derivado de `BACKLOG.md`. La **tarea activa** vive en `NOW.md`. Si hay conflicto, mandan `BACKLOG.md` y `NOW.md` del repo, no este resumen.

---

## Dónde estamos

| Fase | Estado | Resumen |
|------|--------|---------|
| **A — Parar el sangrado** | ✅ 5/6 | Solo queda A6 (auditoría repo vs disco), no bloqueante. |
| **B — Base reproducible** | ✅ casi | Solo queda B2-VERIFY (`db reset` local), bloqueado por Docker, no crítico. |
| **B3.5 — Diagnóstico + diseño pre-producción** | 🟡 muy avanzado | Auditorías UI/estructural/RLS y movimiento cerrados. Sprint visual (B3.5f) casi completo. |
| **C — Observabilidad** | 🔴 1/8 | Solo C4 (rate-limit) hecho. El resto pendiente. |
| **D — Legal mínimo** | 🔴 0/3 | Nada hecho. **Bloqueante para usuarios EU.** |
| **E — Mejoras de calidad** | 🟡 parcial | Mezcla de cerradas y pendientes. Opcional para MVP. |
| **F — Monetización** | 🔴 0/5 | No se toca hasta cerrar A–D. |

La base (A, B) está sólida. El diseño (B3.5) está casi rematado. **Lo que falta para lanzar de verdad no es pulido: es observabilidad, legalidad, y apagar los fuegos funcionales que ya están en producción.**

---

## El camino crítico hacia "usuarios pagando"

Ordenado por lo que bloquea el lanzamiento. Cada peldaño asume el anterior.

### 1. 🔥 Apagar fuegos funcionales — *app publicada pero parcialmente rota*

Hay funcionalidad en producción que no funciona. Esto va **primero**: añadir observabilidad o cobrar sobre una app rota es construir sobre arena. Es el camino que se está recorriendo ahora.

- **E47 — Listas: añadir/quitar título.** *En curso.* Backend completo; faltaba toda la UI. Implementada, pendiente de fix (test + filtrado por tipo) y verificación visual.
- **E45 — Grupos rotos.** El join falla con 500 para no-miembros (RLS bloquea el self-INSERT). Módulo inaccesible como producto. Requiere diagnóstico cuidadoso (toca RLS). Sub-piezas E45-a..d.
- **`/api/ai-recommendations` 400.** Sin diagnosticar. Degrada con elegancia en Home, pero está roto.
- **E61 — Seguridad en lists DELETE.** Un colaborador puede borrar items ajenos (bypass de RLS con service-role). Riesgo de seguridad real.

### 2. ⚙️ Observabilidad — *dejar de operar a ciegas (Bloque C)*

Sin esto, cuando algo se rompa con usuarios reales no te enterarás. Es el requisito para operar en producción con responsabilidad.

- **C1** Sentry · **C2** Logger estructurado · **C3** Rate-limit a Vercel KV (distribuido; de paso mitiga el rate-limit de Jikan).
- **C5–C8** Endurecimiento CSP/HSTS (C7 nonces → C5 enforce sin `unsafe-inline`; C6 allowlist `img-src`; C8 verificación HSTS).
- *Nota:* C2 desbloquea E18 (migración de `console.error`).

### 3. ⚖️ Legal mínimo — *BLOQUEANTE para usuarios EU (Bloque D)*

No es opcional si quieres usuarios europeos pagando. Es requisito legal, no técnico.

- **D1** Privacidad + términos · **D2** Eliminación de cuenta · **D3** Exportación de datos.

### 4. 💳 Monetización — *el final del túnel (Bloque F)*

No se toca hasta cerrar A–D **y** validar con usuarios reales que hay demanda. Antes de eso es optimización prematura.

- **F1** Modelo freemium/premium · **F2** Schema `subscriptions`+`usage_logs` · **F3** Stripe · **F4** Middleware de plan en endpoints IA · **F5** Dashboard admin.

---

## Carriles paralelos

No bloquean el camino crítico. Se intercalan cuando hay holgura o cuando ya se está tocando el área.

### 🎨 Deuda visual (cierre del sprint de diseño)
- **E46** MediaCard al DS (compartido) · **E58** RecommendModal + Toast · **E59** FilterBar chips (compartido) · **E64** colores hardcodeados de RecommendModal *(pendiente de registrar al cerrar E47)*.
- **f-claro** (modo claro completo) — sprint propio, largo.
- Salida de modales (animan entrada pero no salida) — deuda menor.

### 🐛 Bugs conocidos no bloqueantes
- **E62** mutaciones optimistas sin verificar `res.ok` (transversal) · **E63** setter de `useState` descartado en ListsClient · **E50** estado no-leído efímero · **E51** validación en SuggestionsForm · **E52** silent fail en Chat · **E53** string sin i18n en Chat.

### 🔧 Deuda técnica y decisiones aplazadas
- **A6** coherencia repo vs disco · **B2-VERIFY** `db reset` local · **E24** Zod env (cruza con C) · **E54** cifrado E2E del chat (decisión de arquitectura, no antes de D) · **E60** scope de idioma en Books.
- Housekeeping: 5 `.txt` sueltos a `.gitignore`, rotar password de la BD de producción (pendiente desde hace tiempo), `docs/RLS_AUDIT.md` existe pero estaba mal referenciado en notas previas.

---

## Mapa de dependencias (lo que no se puede saltar)

- **C7** (nonces) → **C5** (CSP enforce). No tiene sentido C5 sin C7.
- **C2** (logger) → **E18** (migrar `console.error`).
- **E17** (tipos, ✅) → **E19** (limpiar casts).
- **E12** (casing flag) → **E13** (auditoría de colisiones).
- **D** (legal) → cualquier planteamiento serio de **E54** (E2EE) y de **F** (cobrar).
- **A–D completos** → **F** (monetización). Regla dura del proyecto.

---

## Principio rector

El orden por defecto del BACKLOG es A→B→C→D→E→F. Cuando algo "parece más urgente" y rompe ese orden —como atacar fuegos funcionales (E45/E47) antes de cerrar C— **es una decisión consciente que se discute, no un salto silencioso** (regla maestra del BACKLOG). Este roadmap existe para hacer esas decisiones con la foto completa delante.
