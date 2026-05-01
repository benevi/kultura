# Orchestrator — PHASES

## Estado global del proyecto

| Fase | Descripción | Estado | Agentes involucrados |
| --- | --- | --- | --- |
| 1 | Fundación (setup, auth, landing) | ✅ COMPLETADA | db-agent, auth-agent, ui-agent, layout-agent, i18n-agent |
| 2 | APIs y contenido | ✅ COMPLETADA | db-agent, api-agent, ui-agent |
| 3 | Biblioteca personal | ✅ COMPLETADA | library-agent, ui-agent |
| 4 | Social | ✅ COMPLETADA | social-agent, ui-agent |
| 5 | IA (Claude API) | ✅ COMPLETADA | ai-agent |
| 6 | Pulido final | ✅ COMPLETADA | i18n-agent, gate-keeper, todos |

## Fase actual: 6

### Tareas Fase 1 (cerrada)

| ID | Tarea | Agente | Estado | Commit |
| --- | --- | --- | --- | --- |
| 1.1 | Setup Next.js + Tailwind + config | setup | ✅ | 4be6ec3 |
| 1.2 | Migraciones SQL + RLS + triggers | db-agent | ✅ | d98b280 |
| 1.3 | Clientes Supabase + middleware | auth-agent | ✅ | 150ce24 |
| 1.4 | Tipos TypeScript | api-agent | ✅ | 08d22c8 |
| 1.5 | i18n (es + en) | i18n-agent | ✅ | 25c9326 |
| 1.6 | Componentes UI base | ui-agent | ✅ | 3c1fa71 |
| 1.7 | Auth: login + registro | auth-agent | ✅ | — |
| 1.8 | Landing pública | layout-agent | ✅ | — |
| 1.9 | Auditoría final Fase 1 | gate-keeper | ✅ | — |

### Tareas Fase 2

| ID | Tarea | Agente | Estado | Commit |
| --- | --- | --- | --- | --- |
| 2.0 | Deuda Fase 1: synopsis + bugfixes + trigger safety | db-agent, auth-agent | ✅ | — |
| 2.1 | lib/api/ TMDB (movies + tv) | api-agent | ✅ | — |
| 2.2 | lib/api/ Jikan (anime + manga) | api-agent | ✅ | — |
| 2.3 | lib/api/ Google Books + Open Library | api-agent | ✅ | — |
| 2.4 | lib/api/ MangaDex + RAWG | api-agent | ✅ | — |
| 2.5 | Normalizer MediaItem | api-agent | ✅ | — |
| 2.6 | Página discover con filtros | ui-agent | ✅ | — |
| 2.7 | Búsqueda global + autocompletado | ui-agent | ✅ | — |
| 2.8 | Página detalle de título | ui-agent | ✅ | — |
| 2.9 | Auditoría final Fase 2 | gate-keeper | ✅ | — |

### Tareas Fase 3

| ID | Tarea | Agente | Estado | Commit |
| --- | --- | --- | --- | --- |
| 3.1 | Route Handlers biblioteca (add/update/remove) + tipos | library-agent | ✅ | — |
| 3.2 | Página /library — lista, filtros, vacío state | ui-agent | ✅ | — |
| 3.3 | CTA en MediaDetail — botón añadir/actualizar biblioteca | ui-agent | ✅ | — |
| 3.4 | Progreso episodios (series/anime) — EpisodeProgress | ui-agent | ✅ | — |
| 3.5 | Estadísticas perfil /profile/[username] | ui-agent | ✅ | — |
| 3.6 | Auditoría final Fase 3 | gate-keeper | ✅ | — |

### Tareas Fase 4

| ID | Tarea | Agente | Estado | SPEC |
| --- | --- | --- | --- | --- |
| 4.1 | Sistema de amigos: queries, /api/friends, /friends, FriendshipButton, AuthHeader, route group (app)/ | social-agent, ui-agent | ✅ | SPEC-022 |
| 4.2 | Feed de actividad (/home) | social-agent, ui-agent | ✅ | SPEC-023 |
| 4.3 | Recomendaciones directas desde MediaDetail + /api/recommendations | social-agent, ui-agent | ✅ | SPEC-024 |
| 4.4 | Listas colaborativas: /lists, /lists/[id], crear, invitar, añadir | social-agent, ui-agent | ✅ | SPEC-025 |
| 4.5 | Notificaciones in-app: /notifications, header badge, marcar leída | ui-agent | ✅ | SPEC-026 |
| 4.6 | Reportes: usuario + media | social-agent | ✅ | SPEC-027 |
| 4.7 | Auditoría final Fase 4 | gate-keeper | ✅ | SPEC-028 |

### Tareas Fase 5

| ID | Tarea | Agente | Estado | SPEC |
| --- | --- | --- | --- | --- |
| 5.0 | Migración `updated_at` en `user_media` (deuda 🔴 Fase 4) | db-agent | ✅ | SPEC-029 |
| 5.1 | Recomendaciones inteligentes via Claude API | ai-agent | ✅ | SPEC-030 |
| 5.2 | Auditoría final Fase 5 | gate-keeper | ✅ | SPEC-031 |

### Tareas Fase 6

| ID | Tarea | Agente | Estado | SPEC |
| --- | --- | --- | --- | --- |
| 6.1 | Rate limiting completo + error.tsx en todas las rutas | gate-keeper, ui-agent | ✅ | SPEC-032 |
| 6.2 | Cache TTL 1h AI recommendations + API keys server-only | ai-agent, gate-keeper | ✅ | SPEC-033 |
| 6.3 | SEO: Open Graph tags + metadataBase | ui-agent | ✅ | SPEC-034 |
| 6.4 | Pre-deploy build check: 0 TS/lint errors, env checklist, Vercel deploy | gate-keeper | ✅ | SPEC-035 |
| 6.5 | Auditoría final Fase 6 | gate-keeper | ✅ | SPEC-036 |

## Leyenda

- ⏳ PENDIENTE
- 🔄 EN CURSO
- ✅ COMPLETADA
- ❌ RECHAZADA — requiere corrección
