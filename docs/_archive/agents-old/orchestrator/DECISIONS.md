# Orchestrator — DECISIONS

Registro de decisiones de arquitectura. Cada decisión incluye contexto, opciones consideradas y motivo de la elección.

---

## DEC-001 — Framework frontend: Next.js 14 (App Router)
**Fecha:** inicio del proyecto
**Contexto:** Necesitamos SSR para SEO, la app será pública.
**Opciones consideradas:** React SPA, Vue/Nuxt, Next.js
**Decisión:** Next.js 14 con App Router
**Motivo:** SSR nativo, SEO óptimo, integración perfecta con Vercel, ecosistema maduro, Claude Code tiene mejor soporte.

---

## DEC-002 — Backend: Supabase
**Fecha:** inicio del proyecto
**Contexto:** Necesitamos auth + BD + realtime sin gestionar servidor propio.
**Opciones consideradas:** Firebase, backend propio Node/Express, Supabase
**Decisión:** Supabase
**Motivo:** PostgreSQL (mejor para relaciones complejas), auth integrado, RLS nativo, tier gratuito generoso, ya familiar para el equipo.

---

## DEC-003 — API cómics: ComicVine
**Fecha:** inicio del proyecto
**Contexto:** Necesitamos cobertura amplia de cómics DC, Marvel e indie.
**Opciones consideradas:** Marvel API (solo Marvel), Open Library (básico), ComicVine
**Decisión:** ComicVine
**Motivo:** Base de datos más completa para cómics occidentales. Requiere proxy server-side por CORS.

---

## DEC-004 — API manga: MangaDex + Jikan combinados
**Fecha:** inicio del proyecto
**Contexto:** Jikan cubre MAL (ratings), MangaDex cubre catálogo y portadas.
**Decisión:** MangaDex como fuente principal de catálogo, Jikan para ratings MAL.
**Motivo:** Combinación da mejor cobertura que cada una por separado.

---

## DEC-005 — Puntuación: 1-5 estrellas
**Fecha:** inicio del proyecto
**Decisión:** Escala 1-5 estrellas (enteros, sin decimales).
**Motivo:** Más intuitivo para usuarios casuales que escala 1-10.

---

## DEC-006 — Privacidad: perfiles siempre públicos
**Fecha:** inicio del proyecto
**Decisión:** No hay opción de perfil privado. Todo es público.
**Motivo:** Simplifica el modelo de datos y la lógica de RLS. Se puede añadir privacidad en v2.

---

## DEC-007 — Sistema de amigos: solo por enlace de invitación
**Fecha:** inicio del proyecto
**Decisión:** No hay búsqueda de usuarios. Solo se puede añadir amigos con enlace.
**Motivo:** Enfocado en círculo cercano. Evita problemas de privacidad y spam en fase inicial.

---

## DEC-008 — Listas: un solo tipo de contenido por lista
**Fecha:** inicio del proyecto
**Decisión:** Una lista no puede mezclar películas, libros, etc.
**Motivo:** Simplifica UI y lógica de normalización. Se puede flexibilizar en v2.

---

## DEC-009 — Idioma de datos: español primero, inglés fallback
**Fecha:** inicio del proyecto
**Decisión:** TMDB con language=es-ES, fallback en-US. Google Books con langRestrict=es.
**Motivo:** Audiencia principalmente hispanohablante.
