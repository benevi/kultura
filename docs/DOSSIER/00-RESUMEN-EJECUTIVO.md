# 00 — Resumen ejecutivo

> Capítulo pensado para leerse sin conocimientos técnicos. Todo término especializado que aparezca está definido en el [glosario](./14-GLOSARIO.md).

### Qué vas a aprender aquí

- Qué es Kultura y qué problema resuelve.
- Qué puede hacer hoy un usuario dentro de la aplicación.
- En qué estado real está el proyecto y qué falta para considerarlo lanzado.

**Requisitos previos:** ninguno.

---

## 1. Qué es Kultura

Kultura es una aplicación web para **descubrir, registrar y compartir cultura**. Cubre siete tipos de contenido en un solo sitio: películas, series, anime, libros, cómics, manga y videojuegos (`src/types/media.ts`, tipo `MediaType`; `CLAUDE.md §cabecera`).

El problema que ataca es la dispersión: quien consume varios de esos formatos suele necesitar una aplicación distinta para cada uno (una para películas, otra para libros, otra para videojuegos…). Kultura reúne en una sola aplicación el catálogo, el registro personal y la parte social para los siete formatos. Esta motivación se deduce del propio alcance del producto (siete tipos bajo un mismo buscador y una misma biblioteca); ⚠️ NO VERIFICADO: no existe en el repo un documento fundacional que declare la visión con estas palabras.

La aplicación funciona en dos idiomas, español e inglés, con 596 textos traducidos en cada uno (`messages/es.json`, `messages/en.json`), y está diseñada primero para móvil (`CLAUDE.md`, regla 7).

## 2. Qué puede hacer un usuario hoy

Todo lo siguiente existe y funciona en el código actual (rutas en `src/app/[locale]/(app)/`; detalle pantalla a pantalla en el [capítulo 01](./01-VISION-Y-PRODUCTO.md)):

- **Descubrir**: explorar catálogos por tipo de contenido con filtros (género, año, valoración…) y paginación (`discover/page.tsx`).
- **Buscar**: buscar un título concreto en cualquiera de los siete formatos (`search/page.tsx`). Los datos vienen de seis fuentes públicas de internet especializadas (TMDB para cine y series, Jikan para anime y manga, Open Library para libros, ComicVine para cómics, MangaDex para manga y RAWG para videojuegos — `src/lib/api/`).
- **Registrar**: guardar cualquier título en una biblioteca personal con estado (pendiente, en curso, completado, abandonado), nota de 1 a 5 y progreso de episodios (`library/page.tsx`, tabla `user_media`).
- **Socializar**: añadir amigos, recomendarles títulos, chatear en privado (solo entre amigos), crear listas compartidas y participar en grupos con su propio tablón (`friends/`, `chat/`, `lists/`, `groups/`).
- **Recibir recomendaciones de IA**: la aplicación analiza la biblioteca del usuario y pide a un modelo de inteligencia artificial (Claude, de Anthropic) cinco sugerencias personalizadas (`src/lib/claude/recommendations.ts`).
- **Gestionar su cuenta**: perfil público con estadísticas, notificaciones, ajustes de idioma y buzón de sugerencias a los desarrolladores (`profile/`, `notifications/`, `settings/`, `suggestions/`).

![Pendiente: Pantalla Home con sesión iniciada](./img/00-home-general.png)
<!-- CAPTURA PENDIENTE
id: 00-home-general
ruta: /es/home
estado: sesión iniciada con biblioteca poblada, tema oscuro, viewport 1440x900
qué debe verse: hero, filas de contenido (MediaRow), recomendaciones IA, popular en tu círculo
por qué: primera imagen del dossier; enseña la app de un vistazo a un lector no técnico
-->

## 3. Cómo está construido, en una frase

Una aplicación web moderna (Next.js) desplegada en la nube (Vercel), con base de datos y sistema de cuentas gestionados (Supabase), que consulta fuentes públicas de datos culturales y una IA externa. El detalle está en el [capítulo 02](./02-ARQUITECTURA.md).

## 4. Estado real del proyecto

Cifras verificadas contra el repositorio a fecha 2026-07-16:

| Indicador | Valor | Fuente |
| --- | --- | --- |
| Commits (cambios registrados) | 311 | `git log --oneline \| wc -l` |
| Inicio del desarrollo | 2026-04-12 | commit `7d9e252` |
| Pantallas | 16 de aplicación + login + landing | `src/app/[locale]/**/page.tsx` |
| Endpoints internos de API | 23 | `src/app/api/**/route.ts` |
| Tablas de base de datos | 18, todas con seguridad a nivel de fila (RLS) | `supabase/migrations/` |
| Reglas de acceso a datos (policies) | 53 vigentes | reconstruido de las 14 migraciones ([cap. 05](./05-SEGURIDAD.md)) |
| Tests automáticos unitarios | 1 245, todos en verde | `npx vitest run`, ejecutado 2026-07-16 |
| Idiomas | 2 (es/en), paridad completa | `messages/*.json` |

El producto está **funcionalmente completo y desplegado en Vercel** (`vercel.json`; verificación funcional post-deploy exigida por `CLAUDE.md`, regla 11). ⚠️ NO VERIFICADO: la URL pública de producción no consta en el repo.

Lo que **falta** para considerarlo lanzado de verdad, según el plan del propio proyecto (`docs/ROADMAP.md §Dónde estamos`):

1. **Observabilidad** (bloque C, 1 de 8 tareas): saber qué falla en producción antes de que lo cuente un usuario — logs, alertas, monitorización.
2. **Legal** (bloque D, 0 de 3): términos de uso, privacidad y consentimiento de cookies. El propio roadmap lo marca **bloqueante para usuarios de la UE**.
3. **Monetización** (bloque F, 0 de 5): sin empezar, deliberadamente pospuesto hasta cerrar lo anterior.

El proyecto mantiene además un registro honesto de su deuda técnica (cosas que funcionan pero conviene mejorar); está priorizada en el [capítulo 13](./13-ESTADO-Y-DEUDA.md).

## 5. Cómo se ha construido

Una persona, con asistencia de IA como herramienta de programación, en unos tres meses (2026-04-12 → hoy; historial de git). El trabajo se organiza en bloques (A: urgencias de seguridad → B: base reproducible → B3: despliegue → B3.5: diseño → C/D/E/F) con una disciplina estricta: una sola tarea activa a la vez, criterio de "hecho" verificable con comandos, y un commit por tarea (`CLAUDE.md §Flujo de trabajo`; detalle en el [capítulo 12](./12-METODOLOGIA.md)).

---

### Resumen en 5 líneas

1. Kultura une en una sola web el descubrimiento, registro y parte social de películas, series, anime, libros, cómics, manga y videojuegos.
2. Hoy un usuario puede buscar, guardar en su biblioteca, puntuar, chatear con amigos, compartir listas y grupos, y recibir recomendaciones de IA.
3. Está construida con Next.js + Supabase + Vercel, en español e inglés, con 1 245 tests unitarios en verde.
4. Está desplegada y es funcional; lo que bloquea el lanzamiento real es observabilidad, textos legales (UE) y monetización, en ese orden.
5. La ha construido una persona en ~3 meses (311 commits) con IA como herramienta y una metodología de tarea única verificable.

### Si quieres profundizar

- Funcionalidad pantalla a pantalla: [01-VISION-Y-PRODUCTO.md](./01-VISION-Y-PRODUCTO.md)
- Plan estratégico y estado por bloques: [`docs/ROADMAP.md`](../ROADMAP.md)
- Reglas de trabajo del proyecto: [`CLAUDE.md`](../../CLAUDE.md)

[← Volver al índice](./README.md)
