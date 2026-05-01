# Análisis completo — Fase 5 KULTURA

**Fecha:** 2026-04-14
**Estado:** CERRADA ✅ — Fase 6 pendiente
**Tareas:** 5.0 – 5.2 (3/3)
**Tests:** 376 pasando (9 nuevos sobre 367), 0 failures
**Build:** limpio
**Archivos de producción nuevos:** 4 archivos
**Archivos de producción modificados:** 6 archivos
**Post-dictamen:** 2 correcciones de código + 5 tests nuevos + actualización doc

---

## Resumen ejecutivo

3 tareas completadas. La Fase 5 añadió la capa de inteligencia artificial a KULTURA: migración de BD para `updated_at` en `user_media` (deuda 🔴 arrastrada de Fase 4), implementación del módulo de recomendaciones via Claude API, y auditoría. La Fase 5 fue intencionalmente pequeña — una sola feature nueva (AI recommendations) sobre una base estabilizada. La auditoría inicial detectó 2 bugs en el componente cliente. La revisión externa detectó 4 puntos adicionales, 2 de los cuales requirieron correcciones de código: validación incompleta de campos `AiRec` y cobertura de tests insuficiente.

---

## 1. Migración `updated_at` en `user_media` (5.0 / SPEC-029)

**Deuda 🔴 resuelta antes de IA — decisión correcta:** La columna `updated_at` era necesaria para que el feed social mostrara actualizaciones de items (completar, puntuar) y para que `getLibraryContext` ordenara por actividad reciente. Sin esta migración, el contexto enviado a Claude habría sido la biblioteca tal como se añadió, no como se usa actualmente. El impacto directo en calidad de recomendaciones justificaba resolverla antes de implementar la feature de IA.

**Orden de la migración — ✅ CORRECTO:** El flujo `ADD COLUMN` → `UPDATE` (backfill) → `NOT NULL` → `DEFAULT` es el único orden que evita errores. Si `NOT NULL` se pusiera antes del `UPDATE`, el `ALTER` fallaría en tablas con rows existentes (NULL no permitido). El orden inverso, `DEFAULT` antes que `NOT NULL`, también sería válido pero semánticamente menos explícito.

**`CREATE OR REPLACE FUNCTION set_updated_at()` — reutilizable:** La función es genérica (`NEW.updated_at = now()`). Puede aplicarse a cualquier tabla futura con un trigger `BEFORE UPDATE` sin duplicar código PL/pgSQL. Decisión de diseño correcta para una herramienta de BD de uso frecuente.

**Backfill `created_at` → `updated_at` — correcto para datos existentes:** Los items pre-migración no tienen historial de actualizaciones, así que usar `created_at` como valor inicial es la aproximación más fiel disponible. No introduce datos inventados.

**`supabase.ts` — tipos sincronizados:** `DbUserMedia` incluye `updated_at: string`. Los tipos `Insert` y `Update` excluyen `updated_at` correctamente — el trigger gestiona el valor en UPDATE, y el DEFAULT en INSERT. Ningún código de aplicación necesita enviarlo.

---

## 2. Recomendaciones IA via Claude API (5.1 / SPEC-030)

### Arquitectura de seguridad — ✅ CORRECTO

`ANTHROPIC_API_KEY` solo se accede en el Route Handler server-side (`/api/ai-recommendations/route.ts`). El componente cliente (`AiRecommendations.tsx`) solo hace un `fetch` a `/api/ai-recommendations` — nunca importa ni usa el SDK de Anthropic. El tipo `AiRec` está exportado desde `lib/claude/recommendations.ts`, que el cliente puede importar sin que eso exponga el SDK (tree-shaking en producción). La clave nunca llega al bundle del cliente. Arquitectura correcta y alineada con la restricción del CLAUDE.md.

### `getLibraryContext` — filtro y ordenación correctos

```typescript
.or('status.eq.completed,score.gte.4')
.order('updated_at', { ascending: false })
.limit(15)
```

Filtra por `completed` OR `score >= 4`: cubre usuarios que puntúan sin marcar como completado y usuarios que marcan completado sin puntuar. Ordenar por `updated_at DESC` garantiza que lo más reciente llega primero al prompt — Claude tiene contexto fresco. El límite de 15 items equilibra contexto útil vs tokens del prompt.

**Estimación de tokens y coste (observación dictamen #2):** Con 15 items de biblioteca, cada línea del prompt ocupa ~40–60 tokens (título, tipo, año, puntuación). El system prompt añade ~50 tokens, las instrucciones finales ~80 tokens, géneros ~20 tokens. Total estimado: **800–1100 tokens de input** para el caso máximo. El modelo es `claude-sonnet-4-6`. La respuesta de 5 recomendaciones ocupa ~400 tokens de output. Sin cache (estado actual de Fase 5), cada pageload del home de un usuario activo genera una llamada. Con N usuarios activos en hora punta esto es coste real no trivial. **Deuda 🟠 de Fase 6: implementar cache con TTL ~1h por usuario.**

**Sin diversidad por tipo en contexto (observación dictamen #4):** `getLibraryContext` no limita por tipo de media. Si un usuario tiene 12 películas y 3 libros completados, el contexto enviado a Claude contiene 12 películas + 3 libros → Claude tenderá a recomendar mayoritariamente películas. La diversidad de recomendaciones depende de la diversidad de la biblioteca del usuario. No es un bug — es una limitación de diseño conocida. **Deuda 🟢 documentada: en Fase 6 evaluar limitar a top 3–4 items por tipo.**

**Mínimo 3 items antes de llamar a Claude:** Evita llamadas costosas y recomendaciones sin sentido para usuarios nuevos. El componente muestra el mensaje `needMoreItems` en este caso — UX correcto.

### `buildPrompt` — estructura del prompt

El prompt pide exactamente 5 recomendaciones en JSON estructurado con un schema explícito.

**Prompt hardcoded en español:** Claude entiende el prompt en español independientemente del locale del usuario, y devuelve títulos en su idioma original (correcto). Sin embargo, el campo `reason` siempre viene en español aunque el usuario tenga locale EN. Para Fase 6 se podría parametrizar el idioma del prompt. **Deuda 🟡 documentada.**

**System prompt instruye solo JSON:** La instrucción `Respondes ÚNICAMENTE con JSON válido` reduce pero no elimina el riesgo de que Claude añada texto introductorio. El parser ya mitiga esto extrayendo el primer `{...}` con regex — la doble defensa es correcta.

### Parser defensivo — ✅ CORRECTO con gap documentado

```typescript
const jsonMatch = rawText.match(/\{[\s\S]*\}/)
```

**Gap conocido (observación dictamen #3):** El regex extrae el primer bloque `{...}`. Si Claude respondiera con un array raíz (`[{...}, {...}]`) en lugar de un objeto, `jsonMatch` sería `null` → `[]`. El schema del prompt pide siempre `{ "recommendations": [...] }`, así que en la práctica es muy improbable. La defensa completa requeriría también intentar `rawText.match(/[\[{][\s\S]*[\]}]/)`. **Deuda 🟢 documentada.**

Después de parsear, filtra:

- `typeof r.title === 'string' && r.title.trim() !== ''` — título no vacío (**corregido post-dictamen**)
- `isValidType(r.type)` — guard contra tipos inventados (`podcast`, `music`, etc.)
- `typeof r.reason === 'string' && r.reason.trim() !== ''` — razón no vacía (**corregido post-dictamen**)
- `r.year > 1800 && r.year <= currentYear + 5` — año en rango razonable (**corregido post-dictamen**)
- `.slice(0, 5)` — cap de seguridad aunque Claude envíe más

### Route Handler — 200 siempre con log diferenciado (observación dictamen #1)

El Route Handler responde siempre 200 con `{ recommendations: [] }` ante cualquier fallo. Correcto para una feature auxiliar que no debe bloquear el home. Sin embargo, la invisibilidad operacional es real: si `ANTHROPIC_API_KEY` está revocada en producción, el componente mostrará "Añade al menos 3 títulos..." aunque el usuario tenga 50 items.

**Mitigación ya existente:** `getAiRecommendations` emite `console.error('ANTHROPIC_API_KEY not set')`, `console.error('Claude API error:', err)` y `console.error('Failed to parse Claude response:', rawText)` en cada caso de fallo. Los logs del servidor de Vercel/producción capturan estos errores. El caso legítimo de biblioteca pequeña (`items.length < 3`) no emite ningún log — la distinción ya existe por construcción. **Deuda 🟡 de Fase 6: añadir métricas/alertas diferenciadas para fallos de Anthropic, no solo logs.**

### `AiRecommendations.tsx` — componente cliente

**4 estados bien diferenciados:**

- `loading` → spinner animado con "Generando recomendaciones..." — feedback inmediato
- `done` → grid de recomendaciones con título, año, tipo (i18n), razón y enlace de búsqueda
- `empty` → mensaje "Añade al menos 3 títulos..." — accionable
- `error` → `null` (silencioso) — correcto para feature auxiliar que no debe bloquear el home

**Integración en `/home`:** `<AiRecommendations />` aparece en la parte superior del home, antes del feed de amigos. Posición correcta — las recomendaciones IA son el valor diferencial de la plataforma y merecen estar above the fold.

---

## Bugs detectados en auditoría (interna + dictamen)

| # | Archivo | Bug | Impacto | Corrección |
| --- | --- | --- | --- | --- |
| 1 | `AiRecommendations.tsx` | `TYPE_LABELS` hardcoded en español (`'Película'`, `'Serie'`, etc.) | Locale EN mostraba tipos en ES en las cards de recomendación | Eliminado `TYPE_LABELS`, reemplazado por `useTranslations('media')` |
| 2 | `AiRecommendations.tsx` | `useEffect` sin `AbortController` | `setState` en componente desmontado si el usuario navega durante el fetch — React warning en dev | Añadido `AbortController`, `AbortError` ignorado en catch, cleanup `controller.abort()` en return del useEffect |
| 3 | `lib/claude/recommendations.ts` | Validación incompleta: `title === ''` y `reason === ''` pasaban el filtro; `year: "época medieval"` se mapeaba sin validar | Datos inválidos de Claude llegaban a la UI | Añadidos checks `.trim() !== ''` para title y reason; rango `year > 1800 && year <= currentYear + 5` |

---

## Cobertura de tests

| Test | Caso cubierto | Tipo |
| --- | --- | --- |
| `returns 401 if not authenticated` | Auth check Route Handler | Unit |
| `returns recommendations array on success` | Flujo feliz Route Handler | Unit |
| `returns empty array if library too small` | [] desde getAiRecommendations | Unit |
| `returns 200 with empty array when Anthropic API fails` | Fallo silencioso Route Handler siempre 200 | Unit |
| `returns [] if library has fewer than 3 items` | Guard < 3 items en función real | Unit |
| `filters recommendations with invalid type` | Parser filtra tipos inválidos (podcast, music) | Unit |
| `filters recommendations with empty title or reason` | Parser filtra title/reason vacíos | Unit |
| `returns [] if Claude returns malformed JSON` | JSON sin bloque {} → [] | Unit |
| `clamps year to undefined if out of valid range` | Año 1700 o "época medieval" → undefined | Unit |

**Tests nuevos netos Fase 5:** 9 (4 iniciales + 5 añadidos post-dictamen)
**Total acumulado:** 376

---

## Deuda técnica — estado al cierre de Fase 5

| Prioridad | Tema | Estado |
| --- | --- | --- |
| 🔴 Alta | `BLOQ-001` tests integración Supabase sin CI | ⏳ Pendiente |
| 🔴 Alta | Rate limiting en todos los Route Handlers (incl. `/api/ai-recommendations`) | ⏳ Fase 6 |
| 🔴 Alta | `error.tsx` ausente en rutas autenticadas | ⏳ Fase 6 |
| 🔴 Media-alta | API keys `NEXT_PUBLIC_` en bundle cliente | ⏳ Fase 6 |
| 🟠 Media | Sin cache en `/api/ai-recommendations` — cada pageload = llamada a Anthropic (~1000 tokens input + ~400 output) | ⏳ TTL ~1h por usuario — Fase 6 |
| 🟠 Media | Fallos de Anthropic solo en logs de servidor — sin métricas/alertas diferenciadas | ⏳ Observabilidad — Fase 6 |
| 🟡 Media | Prompt de `buildPrompt` hardcoded en español — `reason` siempre en ES para usuarios EN | ⏳ Parametrizar idioma — Fase 6 |
| 🟡 Media | `getLibraryContext` sin diversidad por tipo — biblioteca sesgada → recomendaciones sesgadas | ⏳ Top N por tipo — Fase 6 |
| 🟡 Media | Verificar amistad antes de recomendar (hoy: cualquier userId válido) | ⏳ Fase 6 |
| 🟡 Media | `getUserLists` — O(n) queries para item count | ⏳ GROUP BY — Fase 6 |
| 🟡 Media | `parseMediaId` inline en `NotificationsList` — duplicado en varios sitios | ⏳ Extraer a `utils.ts` — Fase 6 |
| 🟡 Media | Invitación a lista sin accept/rechazar — superficie de abuso potencial | ⏳ Evaluar antes de registro público |
| 🟡 Media | `x-action` header sin tipo discriminado | ⏳ `type ListAction` — Fase 6 |
| 🟡 Media | Sin paginación en `/notifications` (máx 50) | ⏳ Fase 6 |
| 🟡 Media | `FeedItem` sin enlace a perfil del amigo | ⏳ Fase 6 |
| 🟢 Baja | Parser de Claude no maneja array raíz `[{...}]` — improbable con el prompt actual | ⏳ Gap documentado |
| 🟢 Baja | `BLOQ-003` CSP sin `frame-src` para YouTube | ⏳ Fase 6 |
| 🟢 Baja | Sin panel de revisión de reportes | ⏳ Herramienta externa / Fase 7 |

---

## Lo que se hizo bien

**Arquitectura de seguridad para la API key.** `ANTHROPIC_API_KEY` está estrictamente contenida en el Route Handler. El componente cliente solo conoce el tipo `AiRec` — no hay fuga de credenciales posible por construcción, no por disciplina de código.

**Manejo defensivo end-to-end.** `getAiRecommendations` nunca lanza — todos los caminos de fallo retornan `[]`. El Route Handler siempre responde 200 con `{ recommendations: [] }` en el peor caso. El componente renderiza estado `empty` sin mensaje de error al usuario. Correcto para una feature auxiliar que no debe degradar la experiencia principal. Los errores reales (API key, fallo de red, parse error) se logean con `console.error` diferenciado del caso legítimo (biblioteca pequeña, sin log).

**`updated_at` resuelto antes de IA.** Resolver la deuda 🔴 de `created_at` antes de implementar las recomendaciones fue la decisión correcta de priorización. `getLibraryContext` se beneficia inmediatamente de `updated_at DESC` — Claude recibe el historial más reciente, no el más antiguo.

**Parser con doble defensa más validación estricta de campos.** Regex de extracción JSON + validación de tipos post-parseo + validación de strings no vacíos + rango de año razonable. Claude puede añadir texto antes/después del JSON, incluir tipos inválidos, o devolver campos vacíos — todos los casos manejados sin crashear.

**Componente `AiRecommendations` completamente autocontenido con cleanup correcto.** Hace su propio fetch con `AbortController`, gestiona sus propios estados, no requiere props ni contexto externo, y limpia el fetch en el return del `useEffect` para evitar setState en componentes desmontados.

---

## Veredicto

La Fase 5 entrega las recomendaciones IA con arquitectura de seguridad correcta y manejo defensivo completo. Los bugs detectados (2 en auditoría interna + 1 en revisión externa) eran reales: `TYPE_LABELS` hardcoded en español, `useEffect` sin cleanup, y validación incompleta de campos de la respuesta de Claude. Todos corregidos. Los 5 tests añadidos post-dictamen cubren los casos de fallo más relevantes del parser.

Los puntos más importantes de la revisión externa fueron la validación incompleta de campos `AiRec` (datos inválidos de Claude llegaban a la UI sin filtrar) y la cobertura de tests insuficiente para una integración con API externa. Ambos resueltos.

**376/376 tests, 42/42 archivos. Fase 6 pendiente — rate limiting, cache `/api/ai-recommendations`, observabilidad, i18n completo, SEO, deploy Vercel.**
