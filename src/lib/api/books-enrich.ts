// ============================================================
// KULTURA — Puente Open Library → Google Books en la ficha (E-BOOKS-HIBRIDO)
//
// El catálogo lo sirve Open Library, que gana en filtros y paginación pero
// pierde en portadas y sinopsis. Al ABRIR un título —y solo entonces, nunca al
// listar— se pide la ficha equivalente a Google Books para quedarse con lo
// mejor de cada uno.
//
// Se puentea por ISBN, no por título+autor: entre ediciones distintas de la
// misma obra el título se repite y el emparejamiento por texto acaba trayendo
// otro libro. Si el doc de Open Library no trae ISBN, no se puentea — antes
// dejar la ficha con los datos de Open Library que enseñar la portada
// equivocada.
//
// Todo es best-effort: sin clave de Google Books, con cuota agotada o sin
// coincidencia, se devuelve el ítem original intacto. La ficha nunca depende de
// que este puente funcione.
// ============================================================

import type { MediaItem } from "@/types/media";
import { searchGoogleBooks } from "@/lib/api/googlebooks";
import { normalizeBookGoogle } from "@/lib/api/normalizer";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/books-enrich");

/** ISBNs que se prueban por ficha. Más de uno rara vez aporta y multiplica coste. */
const MAX_ISBN_TRIES = 1;

function firstIsbns(metadata: Record<string, unknown> | undefined): string[] {
  const raw = metadata?.isbn;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.replace(/[^0-9Xx]/g, ""))
    // ISBN-13 primero: es el que Google Books indexa mejor.
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_ISBN_TRIES);
}

/**
 * Devuelve el ítem con portada y sinopsis de Google Books cuando las hay.
 *
 * Solo SUSTITUYE lo que Google mejora; el id, el tipo, el título y el año
 * siguen siendo los de Open Library, que es quien manda en el catálogo y en el
 * enlace de la ficha. Mezclar ids rompería la vuelta a la biblioteca.
 */
export async function enrichBookWithGoogle(item: MediaItem): Promise<MediaItem> {
  const isbns = firstIsbns(item.metadata as Record<string, unknown> | undefined);
  if (isbns.length === 0) return item;

  for (const isbn of isbns) {
    try {
      const res = await searchGoogleBooks(`isbn:${isbn}`, 1, {}, null);
      const volume = res.items?.[0];
      if (!volume) continue;

      const google = normalizeBookGoogle(volume);
      return {
        ...item,
        poster: google.poster ?? item.poster,
        synopsis: google.synopsis ?? item.synopsis,
        // Los géneros de Google (BISAC) son más consistentes que los subjects
        // libres de Open Library, que traen ruido del tipo "Accessible book".
        genres: google.genres?.length ? google.genres : item.genres,
      };
    } catch (e) {
      // Cuota, clave ausente o red: la ficha se sirve igual con Open Library.
      log.warn("Puente a Google Books fallido, se sirve Open Library", {
        err: String(e),
      });
      return item;
    }
  }

  return item;
}
