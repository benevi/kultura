// ============================================================
// KULTURA — Portadas reales para la landing (E-LANDING-SHOWCASE)
//
// La landing enseñaba su propuesta con bloques de gradiente: honestos como
// primitivo F0, pero no cuentan qué hay dentro. Aquí se resuelve una muestra
// de portadas REALES del catálogo (película, serie, anime, libro, manga,
// juego, cómic) para pintarlas en el hero y en las tarjetas de features.
//
// Decisiones (y por qué):
//   - Reusa `fetchAggregateData` (modo "all" de Descubrir) en vez de llamar a
//     seis proveedores a mano: ya hace fan-out a las 7 familias, normaliza,
//     filtra NSFW y tolera que una familia falle (allSettled por familia).
//   - `/[locale]` se renderiza on-demand (ƒ en el build), así que sin caché
//     cada visita a la landing dispararía ese fan-out. `unstable_cache` guarda
//     el RESULTADO (una lista de portadas, no de items completos) un día.
//   - Nunca se cachea una muestra vacía: si la carga se queda corta se lanza,
//     y `unstable_cache` no guarda rechazos — así un hipo de un proveedor no
//     congela la landing sin imágenes durante 24 h.
//   - Presupuesto de tiempo duro (`SHOWCASE_TIMEOUT_MS`): la landing es la
//     puerta de entrada; antes de hacerla esperar se pinta el collage de
//     gradientes, que sigue siendo un diseño válido.
//
// La landing NUNCA depende de esto para ser usable: sin muestra, los
// componentes caen a su versión de gradiente (ver `HeroCollage`).
// ============================================================

import { unstable_cache } from "next/cache";
import { fetchAggregateData } from "@/lib/api/aggregate";
import { createLogger } from "@/lib/logger";
import type { MediaItem, MediaType } from "@/types/media";

const log = createLogger("landing-showcase");

/** Portada lista para pintar: solo lo que la landing necesita. */
export interface ShowcaseItem {
  id: string;
  title: string;
  type: MediaType;
  poster: string;
}

/** Cuántas portadas pide la landing (hero 3 + library 3 + lists 3 + ia 1). */
export const LANDING_SHOWCASE_SIZE = 10;

/** Mínimo para que merezca la pena pintar portadas en vez de gradientes. */
export const LANDING_SHOWCASE_MIN = 4;

/** Un día: el catálogo popular no cambia a ritmo de visita. */
const SHOWCASE_TTL_SECONDS = 60 * 60 * 24;

/** Presupuesto de espera antes de caer al collage de gradientes. */
const SHOWCASE_TIMEOUT_MS = 2500;

/**
 * Ordena la muestra para que las primeras portadas sean de tipos DISTINTOS
 * (una por familia) y el resto rellene detrás. El agregado ya alterna por
 * familia, pero una familia caída correría el turno de las demás y el hero
 * acabaría con tres películas; esto lo garantiza explícitamente.
 *
 * Descarta lo que no tenga portada real: el objetivo del bloque es justo esa
 * imagen, y una card sin ella desluce la fila entera (mismo criterio que el
 * gate de portada de las recomendaciones IA).
 */
export function pickShowcase(
  items: MediaItem[],
  size = LANDING_SHOWCASE_SIZE
): ShowcaseItem[] {
  const withPoster = items.filter(
    (item): item is MediaItem & { poster: string } =>
      typeof item.poster === "string" && item.poster.length > 0
  );

  const firstOfType: (MediaItem & { poster: string })[] = [];
  const rest: (MediaItem & { poster: string })[] = [];
  const seen = new Set<MediaType>();
  for (const item of withPoster) {
    if (seen.has(item.type)) rest.push(item);
    else {
      seen.add(item.type);
      firstOfType.push(item);
    }
  }

  return [...firstOfType, ...rest].slice(0, size).map((item) => ({
    id: item.id,
    title: item.title,
    type: item.type,
    poster: item.poster,
  }));
}

/** Rechaza a los `ms` para no dejar la landing colgada de un proveedor lento. */
function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`showcase timeout ${ms}ms`)), ms)
  );
}

/**
 * Carga la muestra. LANZA si no llega al mínimo, a propósito: así el resultado
 * pobre no entra en la caché de un día (`unstable_cache` no guarda rechazos).
 */
async function loadShowcase(locale: string): Promise<ShowcaseItem[]> {
  const { items } = await Promise.race([
    fetchAggregateData(1, {}, locale),
    timeout(SHOWCASE_TIMEOUT_MS),
  ]);
  const picked = pickShowcase(items);
  if (picked.length < LANDING_SHOWCASE_MIN) {
    throw new Error(`showcase incompleto (${picked.length} portadas)`);
  }
  return picked;
}

const cachedShowcase = unstable_cache(loadShowcase, ["landing-showcase"], {
  revalidate: SHOWCASE_TTL_SECONDS,
  tags: ["landing-showcase"],
});

/**
 * Muestra de portadas para la landing. Nunca lanza: devuelve `[]` cuando no hay
 * datos y el llamante pinta la versión de gradientes.
 */
export async function getLandingShowcase(
  locale: string
): Promise<ShowcaseItem[]> {
  try {
    return await cachedShowcase(locale);
  } catch (e) {
    log.warn(
      `sin portadas reales para la landing · ${e instanceof Error ? e.message : String(e)}`
    );
    return [];
  }
}
