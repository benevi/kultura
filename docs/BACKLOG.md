# BACKLOG — KULTURA

> Una sola regla: **se trabaja de arriba a abajo. No se saltan tareas.**
> Si algo "parece más urgente", o es porque no entiendes la dependencia, o porque el orden está mal y hay que discutirlo (no saltárselo).
>
> Cada tarea tiene criterio binario de "hecho". No hay "en progreso" global — eso vive en `NOW.md`.

---

## BLOQUE A — Parar el sangrado (1–2 días reales)

Sin esto, todo lo demás se hace con la casa ardiendo.

- [x] **A1. Rotar credenciales Supabase comprometidas** ✅ (cerrada el 2026-05-01)
  Migración a sistema nuevo de Supabase API keys (`sb_publishable_*` + `sb_secret_*`). Legacy JWT-based keys deshabilitadas en el dashboard. App funcionando en local con las nuevas en `.env.local`. Vars actualizadas también en Vercel.

- [x] **A2. Verificar y reforzar `.gitignore` + ausencia de secretos en historial** ✅ (cerrada el 2026-05-01, verificación sin cambios)
  Confirmado que `.env.local` no está trackeado (`git ls-files .env.local` devuelve vacío). Falta: añadir `.claude/` a `.gitignore` (el directorio puede contener `settings.local.json` con info personal). Revisar si existe algún otro archivo con secretos en el repo.
  Hecho cuando: `.gitignore` incluye `.claude/`, y un `git grep -i "sb_secret_\|eyJhbGc" -- ':(exclude).env*'` no devuelve nada.

- [x] **A3. Rotar el resto de claves API por higiene** ✅ (cerrada el 2026-05-01)
  Aunque `TMDB_API_KEY`, `RAWG_API_KEY`, `GOOGLE_BOOKS_KEY`, `COMICVINE_KEY` y `ANTHROPIC_API_KEY` no aparecían en texto plano en el `settings.json` viejo, el archivo era una colección de comandos de debug. Por higiene: rotar todas. Para cada una: regenerar en su dashboard, actualizar `.env.local` local, actualizar Vercel.
  Hecho cuando: las 5 claves tienen valores nuevos en local + Vercel y la app sigue arrancando.

- [x] **A4. Sincronizar nombres de variables entre local y Vercel** ✅ (cerrada el 2026-05-01, ya unificado)
  En Vercel las claves son `TMDB_API_KEY`, `RAWG_API_KEY`, `GOOGLE_BOOKS_KEY` (sin `NEXT_PUBLIC_`). En `.env.local` puede que sigan con el prefijo viejo. Decidir nombres canónicos (server-only, sin `NEXT_PUBLIC_`) y unificar.
  Hecho cuando: `.env.local` y Vercel usan exactamente los mismos nombres y la app funciona en ambos entornos.

- [x] **A5. Versionar el estado actual del proyecto (commits temáticos + remoto GitHub)**✅ (cerrada el 2026-05-02).
 13 commits temáticos en 4 sesiones + reescritura de identidad + push a https://github.com/benevi/kultura (privado). Detalles en DONE.md. Working tree limpio, master en sync con origin.

- [ ] **A6. Auditoría de coherencia repo vs disco**
        Verificar que después de A5 no quedan archivos en disco que no estén
        trackeados (salvo los explícitamente ignorados por .gitignore). Si
        hay huérfanos, decidir uno por uno: stagear, ignorar, o borrar.
        Hecho cuando: `git status --short` solo lista archivos con cambios
        legítimos, sin "??" inesperados.

---

## BLOQUE B — Base reproducible (2–3 días)

Sin esto, cada cambio posterior es ruleta rusa.

- [x] **B1-A. Limpiar tests rotos huérfanos**✅ (cerrada el 2026-05-01)
  6 errores en `tests/` impiden `tsc --noEmit`: 3 tests de componentes Library inexistentes, 1 test de `@/lib/env` (módulo aún no creado, es B3), 2 mocks desactualizados en `queries.test.ts`.
  Hecho cuando: `tsc --noEmit` exit 0, `vitest run` exit 0, hay commit `[B1-A] Limpiar tests rotos`.

- [ ] **B1-B. CI básico en GitHub Actions**
  El B1 original. Workflow con typecheck + tests unit + build.
  Depende de: B1-A.
   
- [ ] **B1-C. Arreglar 4 tests fallando en register-form.test.tsx**
  mockRouterPush nunca se llama. Investigar: ¿mock router 
  mal? ¿signUp mock falta? ¿flujo del componente cambió?
  Hecho cuando: vitest run pasa los 4 tests de register-form.
  
- [ ] **B2. Migraciones SQL versionadas**
  `supabase db pull` contra el proyecto actual. Commitear `supabase/migrations/*.sql` incluyendo RLS policies. README en `supabase/` explicando cómo aplicar en entorno nuevo.
  Hecho cuando: un dev nuevo puede levantar un Supabase local desde cero con `supabase db reset` y el schema queda idéntico al de producción.

- [ ] **B3. Validación de env vars al startup**
  `src/lib/env.ts` con Zod que valide todas las env vars requeridas. Importar en `app/layout.tsx`.
  Hecho cuando: arrancar sin `ANTHROPIC_API_KEY` falla con mensaje claro en startup, no en primera request.

---

## BLOQUE C — Que producción no sea una caja negra (3–4 días)

Sin esto, cuando algo falle en prod no te vas a enterar.

- [ ] **C1. Sentry integrado**
  `@sentry/nextjs` con DSN en env vars. Capturar errores de Route Handlers y componentes cliente.
  Hecho cuando: un `throw new Error("test")` en una ruta aparece en el dashboard de Sentry en <1 min.

- [ ] **C2. Logger estructurado reemplaza `console.error`**
  `src/lib/logger.ts` con pino o similar. Reemplazar las 15 instancias de `console.error` documentadas en el audit.
  Hecho cuando: `grep -rn "console\." src/ --include="*.ts" --include="*.tsx"` devuelve 0 o solo casos justificados.

- [ ] **C3. Rate limiting → Vercel KV**
  Reemplazar el `Map` en memoria por `@vercel/kv`. Sliding window igual que ahora, pero distribuido.
  Hecho cuando: dos requests paralelos desde dos instancias diferentes de Vercel respetan el mismo contador.

---

## BLOQUE D — Legal mínimo (2 días)

Bloqueante si tienes o quieres usuarios EU.

- [ ] **D1. Política de privacidad + Términos**
  Páginas estáticas en `/[locale]/privacy` y `/[locale]/terms`. Enlazadas desde footer.
  Hecho cuando: ambas páginas existen en es y en, y el footer las enlaza.

- [ ] **D2. Endpoint de eliminación de cuenta**
  `DELETE /api/account` que borre al usuario actual. Cascades en DB ya existen (verificar).
  Hecho cuando: un usuario puede eliminar su cuenta desde settings y desaparece de todas las tablas.

- [ ] **D3. Exportación de datos básica**
  `GET /api/account/export` que devuelva JSON con toda la data del usuario.
  Hecho cuando: el endpoint responde con library + lists + friendships del usuario autenticado.

---

## BLOQUE E — Mejoras de calidad (opcional para MVP)

No bloqueantes. Atacar solo después de A–D.

- [ ] **E1.** `generateMetadata()` en páginas de contenido — `/media/[type]/[id]`, `/profile/[username]`, `/lists/[id]`.
- [ ] **E2.** Error Boundaries en secciones principales.
- [ ] **E3.** Paginación verificada en todas las queries de listado.
- [ ] **E4.** Tests de componentes React con `@testing-library/react`.
- [ ] **E5.** E2E ampliado — library add, recomendación user-to-user, crear lista.
- [ ] **E6.** ComicVine implementado — `/api/comics/route.ts` + `lib/api/comicvine.ts`.
- [ ] **E7.** OAuth Google vía Supabase Auth.
- [ ] **E8.** Recuperación de contraseña personalizada.
- [ ] **E9.** Form fields con id/name (warning visto en consola — accesibilidad).
- [ ] **E10. Evaluar 3 APIs alternativas de libros**
  Motivación: Google Books + Open Library devuelven pocos resultados o de baja calidad para títulos en español que no son bestsellers. Probar Hardcover (GraphQL, gratuito con cuenta), ISBNdb (REST, free tier 1 req/s), y Open Library standalone (gratis, sin key) con un set fijo de 10 queries reales que actualmente fallan o dan resultados pobres. Comparar: cobertura de resultados, calidad de metadatos en español, calidad de portadas, límites de rate.
  Hecho cuando: existe `docs/decisions/books-api.md` con (a) las 10 queries de prueba, (b) tabla comparativa, (c) decisión razonada, (d) API elegida.

- [ ] **E11. Migrar `lib/api/googlebooks.ts` → API decidida en E10**
  Implementar el adapter nuevo con la misma firma que `lib/api/googlebooks.ts` actual. El `normalizer` no debería cambiar (todo termina en `MediaItem`). Mantener Open Library como fallback solo si la nueva API tiene huecos detectados en E10. Actualizar tests de contrato.
  Hecho cuando: búsqueda de libros y detalle funcionan con la nueva API, las 10 queries de E10 dan mejores resultados que antes, y los tests de contrato pasan en verde.
  Depende de: E10.

---

## BLOQUE F — Monetización (fase aparte)

Esto NO se hace hasta tener A–D cerrado y haber validado con usuarios reales que hay demanda. Si no, es premature optimization.

- [ ] F1. Definir modelo: freemium (biblioteca limitada) + premium (IA ilimitada).
- [ ] F2. Schema `subscriptions` + `usage_logs`.
- [ ] F3. Stripe integrado.
- [ ] F4. Middleware de plan en endpoints de IA.
- [ ] F5. Dashboard admin con métricas básicas.

---

## Reglas de uso

1. **Una tarea activa máximo.** Si estás trabajando en A2, no abres A3. Si surge algo de A3 que bloquea A2, lo anotas en el propio A2 pero no cambias de tarea.
2. **El criterio "hecho" es binario.** Si no puedes ejecutar un comando o señalar un resultado observable, la tarea no está bien definida — repártela.
3. **Lo que no está aquí, no existe.** Si Claude Code te sugiere "aprovecho y refactorizo X", la respuesta es no. Si realmente hace falta, va al backlog, no al sprint actual.
4. **Aprobación por bloque, no por tarea.** Apruebas el bloque A entero al empezarlo. Dentro del bloque, las tareas se encadenan sin pedir permiso por cada una. Solo se pide confirmación al cerrar bloque.
5. **Revisión del backlog: cada viernes.** 15 min. Reordenar si hace falta, añadir lo nuevo. No durante la semana.
