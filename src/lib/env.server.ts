import "server-only";
import { z } from "zod";
import { emptyToUndefined, formatEnvIssues } from "@/lib/env-utils";

/**
 * Secretos de SERVIDOR validados (E24, SEG-11).
 *
 * `import "server-only"`: si un Client Component (o algo que este importe)
 * llega a este módulo, `next build` falla en vez de meter el nombre de los
 * secretos en un chunk de cliente. Las vars públicas están en `env.public.ts`.
 *
 * Se validan fail-fast al arrancar el servidor vía `instrumentation.ts`
 * (runtime, NO en build).
 */

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TMDB_API_KEY: z.string().min(1),
  RAWG_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.preprocess(
    emptyToUndefined,
    z.string().startsWith("sk-ant-").optional()
  ),
  COMICVINE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  // E-BOOKS-GOOGLE: reactivada (estuvo retirada entre E84c y 2026-09-12, cuando
  // los libros pasaron a Open Library y de vuelta a Google Books). OPCIONAL —
  // la API pública responde sin key, pero con cuota compartida por IP que puede
  // estar a cero; ver la nota en `src/lib/api/googlebooks.ts`.
  GOOGLE_BOOKS_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  // E-DEMO: email de la cuenta demo de solo lectura (la crea
  // `scripts/seed-demo.ts`). OPCIONAL: sin ella, el botón "Ver la demo" no se
  // pinta y `/api/auth/demo` redirige al login.
  DEMO_USER_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Valida y devuelve los secretos server-only. Lanza con la lista de vars que
 * fallan. Llamado por `instrumentation.ts` (fail-fast) y por los consumidores.
 */
export function parseServerEnv(): ServerEnv {
  const result = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TMDB_API_KEY: process.env.TMDB_API_KEY,
    RAWG_API_KEY: process.env.RAWG_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    COMICVINE_KEY: process.env.COMICVINE_KEY,
    GOOGLE_BOOKS_KEY: process.env.GOOGLE_BOOKS_KEY,
    DEMO_USER_EMAIL: process.env.DEMO_USER_EMAIL,
  });
  if (!result.success) {
    throw new Error(
      `[env] Variables de servidor inválidas o ausentes:\n${formatEnvIssues(result.error)}`
    );
  }
  return result.data;
}

let _serverEnv: ServerEnv | null = null;

/**
 * Env de servidor validado (lazy + memoizado). Lazy a propósito: la validación
 * corre en el primer acceso (runtime), nunca en el import de build → no rompe
 * el build de Vercel. El fail-fast de arranque lo fuerza `instrumentation.ts`.
 */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    if (!_serverEnv) _serverEnv = parseServerEnv();
    return _serverEnv[prop as keyof ServerEnv];
  },
});
