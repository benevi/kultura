// KULTURA — Cómo se presenta un fallo de proveedor en el catálogo.

import { JikanError } from "@/lib/api/jikan";
import { AniListError } from "@/lib/api/anilist";
import { GoogleBooksError } from "@/lib/api/googlebooks";

/**
 * Resume un error en UNA línea legible: nombre, status si lo trae y mensaje.
 * Un `Error` serializado en el contexto del log no se lee sin desplegarlo, y
 * un fallo de proveedor sin código HTTP no se puede diagnosticar.
 */
export function describeError(e: unknown): string {
  if (e instanceof Error) {
    const status = (e as { status?: unknown }).status;
    const code = typeof status === "number" ? ` status=${status}` : "";
    const cause = e.cause instanceof Error ? ` cause=${e.cause.name}: ${e.cause.message}` : "";
    return `${e.name}${code}: ${e.message}${cause}`;
  }
  return String(e);
}

/**
 * ¿El fallo es "el proveedor me está limitando" (429)? La UI tiene un mensaje
 * distinto para eso ("inténtalo en unos segundos") que para un fallo genérico.
 */
export function isRateLimitError(e: unknown): boolean {
  return (
    (e instanceof JikanError || e instanceof AniListError || e instanceof GoogleBooksError) &&
    e.status === 429
  );
}
