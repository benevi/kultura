import type { z } from "zod";

/**
 * Utilidades comunes a `env.public.ts` y `env.server.ts` (SEG-11). Módulo sin
 * efectos al importarlo: no valida nada ni lee `process.env`, así que los tests
 * pueden simular cualquiera de los dos env sin arrastrar el otro.
 */

/** Trata el string vacío como ausente para vars opcionales. */
export const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

/** Lista qué vars fallan (con el motivo) para un error claro al arrancar. */
export function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}
