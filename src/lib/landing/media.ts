// ============================================================
// KULTURA — Imágenes con profundidad de la landing (rediseño)
//
// Las elige y prepara cada semana la tarea de GitHub Actions
// `landing-media.yml` (scripts/landing-media/build.py): toma los líderes de los
// rankings, lo más visto de la semana y la muestra de portadas, calcula el mapa
// de profundidad de cada imagen y escribe la tabla `landing_media` (solo las
// filas `active` de la semana en curso se pueden leer).
//
// Aquí solo se LEEN. Caché de 7 días con la etiqueta `landing-media`, que la
// propia tarea vacía al terminar (POST /api/revalidate), así que el cambio se
// ve en cuanto acaba y no hay ninguna consulta por visita.
// Nunca lanza: sin tabla, sin filas o con un fallo, devuelve [] y la landing
// usa su respaldo.
// ============================================================

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env.public";
import { LANDING_MEDIA_CACHE_TAG } from "@/lib/best/cache-tags";
import { createLogger } from "@/lib/logger";

const log = createLogger("landing-media");
const WEEK_SECONDS = 60 * 60 * 24 * 7;

export type LandingSlot = "hero" | "close" | "feature" | "step" | "ranking";

/** Una imagen lista para el shader de profundidad. */
export interface LandingMedia {
  slot: LandingSlot;
  position: number;
  format: string | null;
  type: string;
  externalId: string;
  title: string;
  year: number | null;
  rating: number | null;
  image: string;
  depth: string;
  width: number;
  height: number;
  /** Corte de la capa delantera (0-1). */
  threshold: number;
  /** Foco del encuadre (0-1). */
  focus: [number, number];
  /** ¿Es seguro poner el nombre entre el fondo y el personaje? */
  layered: boolean;
  accent: string;
}

/** URL pública de un archivo del bucket «landing». */
export function landingPublicUrl(path: string): string {
  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/landing/${path.replace(/^\//, "")}`;
}

type Row = {
  slot: string; position: number; format: string | null; media_type: string; external_id: string;
  title: string; year: number | null; rating: number | null; image_path: string; depth_path: string;
  width: number; height: number; threshold: number; focus_x: number; focus_y: number;
  layered: boolean; accent: string;
};

/** Fila de la tabla → objeto para la landing (exportado para los tests). */
export function toLandingMedia(row: Row): LandingMedia {
  return {
    slot: row.slot as LandingSlot,
    position: row.position,
    format: row.format,
    type: row.media_type,
    externalId: row.external_id,
    title: row.title,
    year: row.year,
    rating: row.rating === null ? null : Number(row.rating),
    image: landingPublicUrl(row.image_path),
    depth: landingPublicUrl(row.depth_path),
    width: row.width,
    height: row.height,
    threshold: row.threshold,
    focus: [row.focus_x, row.focus_y],
    layered: row.layered,
    accent: row.accent,
  };
}

const cached = unstable_cache(
  async (): Promise<LandingMedia[]> => {
    const { data, error } = await createAdminClient()
      .from("landing_media")
      .select(
        "slot, position, format, media_type, external_id, title, year, rating, image_path, depth_path, width, height, threshold, focus_x, focus_y, layered, accent",
      )
      .eq("active", true)
      .order("slot")
      .order("position");
    if (error) throw new Error(error.message);
    return (data ?? []).map(toLandingMedia);
  },
  ["landing-media-v1"],
  { revalidate: WEEK_SECONDS, tags: [LANDING_MEDIA_CACHE_TAG] },
);

/** Imágenes activas de la semana, ordenadas por sección y posición. Nunca lanza. */
export async function getLandingMedia(): Promise<LandingMedia[]> {
  try {
    return await cached();
  } catch (e) {
    log.warn(`sin imágenes semanales · ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}
