import { z } from "zod";

/**
 * Validación centralizada de variables de entorno (E24).
 *
 * Dos esquemas separados por la frontera `NEXT_PUBLIC_`:
 *  - publicSchema  → vars expuestas al bundle (cliente + server). Next.js inlinea
 *    cada `NEXT_PUBLIC_*` SOLO si se accede por nombre LITERAL (nunca dinámico),
 *    por eso construimos el objeto var a var.
 *  - serverSchema  → secretos server-only. Se validan fail-fast en arranque del
 *    server vía `instrumentation.ts` (runtime, NO en build).
 *
 * Las vars de test (SUPABASE_TEST_*, TEST_USER_*) NO van aquí: solo viven en
 * scripts y tests, y no deben romper el build de la app si faltan.
 */

/** Trata el string vacío como ausente para vars opcionales. */
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TMDB_API_KEY: z.string().min(1),
  RAWG_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.preprocess(
    emptyToUndefined,
    z.string().startsWith("sk-ant-").optional()
  ),
  COMICVINE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

/** Lista qué vars fallan (con el motivo) para un error claro al arrancar. */
function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

function parsePublicEnv(): PublicEnv {
  // Acceso LITERAL obligatorio para que Next inline los valores en el bundle.
  const result = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!result.success) {
    throw new Error(
      `[env] Variables públicas inválidas o ausentes:\n${formatIssues(result.error)}`
    );
  }
  return result.data;
}

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
  });
  if (!result.success) {
    throw new Error(
      `[env] Variables de servidor inválidas o ausentes:\n${formatIssues(result.error)}`
    );
  }
  return result.data;
}

/**
 * Env público validado. Seguro de importar en cliente y server: solo contiene
 * vars `NEXT_PUBLIC_*`. Se evalúa al importar el módulo.
 */
export const publicEnv: PublicEnv = parsePublicEnv();

let _serverEnv: ServerEnv | null = null;

/**
 * Env de servidor validado (lazy + memoizado). NO importar desde Client
 * Components: los secretos no llevan prefijo público y serían `undefined` en
 * el bundle de cliente. Lazy a propósito: la validación corre en el primer
 * acceso (runtime), nunca en el import de build → no rompe el build de Vercel.
 * El fail-fast de arranque lo fuerza `instrumentation.ts`.
 */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    if (!_serverEnv) _serverEnv = parseServerEnv();
    return _serverEnv[prop as keyof ServerEnv];
  },
});
