// ============================================================
// KULTURA — GET /api/landing/sources (rediseño: imágenes semanales)
//
// Candidatos para la tarea semanal que renueva las imágenes con profundidad
// de la landing (.github/workflows/landing-media.yml → scripts/landing-media).
// Devuelve SOLO datos públicos que ya se ven sin cuenta: los rankings
// destacados de cada formato (/best) y la muestra de portadas de la landing.
// No calcula nada nuevo: reutiliza las mismas cachés (24 h) que /best y la
// landing, así que llamarlo no gasta cupo de los proveedores.
// ============================================================

import { NextResponse } from "next/server";
import { BEST_FORMATS, bestYears, getBestRanking, getFeaturedRanking } from "@/lib/best/best-of";
import { getLandingShowcase } from "@/lib/landing/showcase";
import { createLogger } from "@/lib/logger";

const log = createLogger("landing-sources");

/** Títulos por ranking que se mandan: el líder y los siguientes como reserva. */
const SOURCES_PER_RANKING = 8;

export const revalidate = 3600;

export async function GET() {
  const rankings = await Promise.all(
    BEST_FORMATS.map(async (format) => {
      try {
        // El destacado exige una lista indexable (8+). Si ningún año llega
        // (p. ej. juegos a principios de año), se usa el del año en curso tal
        // cual, como hace la landing: su líder sigue siendo real.
        const featured =
          (await getFeaturedRanking(format, "es")) ??
          { year: bestYears()[0], ranking: await getBestRanking(format, bestYears()[0], "es") };
        return {
          format,
          year: featured.year,
          items: featured.ranking.items.slice(0, SOURCES_PER_RANKING).map((it) => ({
            id: it.id,
            externalId: it.externalId ?? null,
            type: it.type,
            title: it.title,
            year: it.year ?? null,
            rating: it.rating ?? null,
            poster: it.poster,
          })),
        };
      } catch (e) {
        log.warn(`ranking ${format} no disponible · ${e instanceof Error ? e.message : String(e)}`);
        return { format, year: null, items: [] };
      }
    }),
  );

  const showcase = (await getLandingShowcase("es")).map((it) => ({
    id: it.id,
    type: it.type,
    title: it.title,
    poster: it.poster,
  }));

  return NextResponse.json(
    { generatedAt: new Date().toISOString(), rankings, showcase },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
