import { z } from "zod";
import { emptyToUndefined, formatEnvIssues } from "@/lib/env-utils";

/**
 * Variables de entorno PÚBLICAS validadas (E24, SEG-11).
 *
 * Solo `NEXT_PUBLIC_*`: es seguro importarlo desde Client Components, el
 * middleware (Edge) y el servidor. Los secretos viven en `env.server.ts`, que
 * lleva `import "server-only"` y rompe el build si algo de cliente lo importa.
 *
 * Next inlinea cada `NEXT_PUBLIC_*` SOLO si se accede por nombre LITERAL
 * (nunca dinámico), por eso el objeto se construye var a var.
 *
 * Las vars de test (SUPABASE_TEST_*, TEST_USER_*) NO van aquí: solo viven en
 * scripts y tests, y no deben romper el build de la app si faltan.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
});

export type PublicEnv = z.infer<typeof publicSchema>;

function parsePublicEnv(): PublicEnv {
  // Acceso LITERAL obligatorio para que Next inline los valores en el bundle.
  const result = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!result.success) {
    throw new Error(
      `[env] Variables públicas inválidas o ausentes:\n${formatEnvIssues(result.error)}`
    );
  }
  return result.data;
}

/** Env público validado. Se evalúa al importar el módulo. */
export const publicEnv: PublicEnv = parsePublicEnv();
