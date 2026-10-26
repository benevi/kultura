// ============================================================
// KULTURA — Caracterización del catálogo (F-32)
//
// Foto fija de `fetchDiscoverData` / `fetchAggregateResult` para una batería
// de peticiones reales de Descubrir (las mismas cadenas que llegan a
// `/api/discover`): qué peticiones salen a cada proveedor (URL y cuerpo, es
// decir la FORMA de la consulta) y qué devuelve la capa (ítems, páginas,
// `hasMore`, error y parcial). Se escribió ANTES de partir `discover.ts` en
// adaptadores por familia: mismas entradas → mismas salidas.
//
// Solo se sustituye la red (`fixtures/network.ts`) y el reloj (para que el
// tope de años futuros no cambie la foto al cambiar de año).
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { installNetwork, type FailMap } from "./fixtures/network";
import { fetchDiscoverData } from "@/lib/api/discover";
import { fetchAggregateResult } from "@/lib/api/aggregate";
import { parseDiscoverParams } from "@/lib/api/discover-params";
import { resetProviderCircuits } from "@/lib/api/http";

/** Igual que la ruta: de la query string a los filtros de la capa. */
function filtersFrom(qs: string) {
  const p = parseDiscoverParams(new URLSearchParams(qs));
  return {
    parsed: p,
    filters: {
      genre: p.genre,
      year: p.year,
      platform: p.platform,
      sort: p.sort,
      status: p.status,
      demografia: p.demografia,
      duracion: p.duracion,
      idioma: p.idioma,
      valoracion: p.valoracion,
      temporadas: p.temporadas,
      volumenes: p.volumenes,
      editorial: p.editorial,
      formato: p.formato,
      modojuego: p.modojuego,
      duracionmedia: p.duracionmedia,
      estado: p.estado,
    },
  };
}

const SCENARIOS: [qs: string, fail?: FailMap][] = [
  // Catálogo base por familia, en los dos idiomas.
  ["type=movie&page=1"],
  ["type=movie&page=3&locale=en"],
  ["type=tv&page=1"],
  ["type=anime&page=1"],
  ["type=manga&page=1"],
  ["type=manga&page=2&locale=en"],
  ["type=book&page=1"],
  ["type=book&page=2&locale=en"],
  ["type=game&page=1"],
  ["type=comic&page=1"],
  // Filtros nativos y post-filtros.
  ["type=movie&genre=action,drama&year=2010s&sort=rating&rating=7&duracion=long&idioma=ja"],
  ["type=tv&genre=comedy&status=ended&seasons=3plus&platform=netflix"],
  ["type=anime&genre=action&year=2020&sort=recent&status=finished&rating=8"],
  ["type=manga&genre=action&demografia=seinen&volumenes=10&sort=rating&status=completed"],
  ["type=book&genre=fantasy&year=2020s&sort=recent&idioma=en"],
  ["type=book&year=classic&formato=novel"],
  ["type=game&genre=action&platform=pc&year=2015&sort=rating&rating=80&estado=released&gamemode=multiplayer&playtime=short"],
  ["type=comic&editorial=marvel&year=2020&sort=recent&volumenes=50"],
  // Desconocido → cine; fuera del tope → vacío sin red.
  ["type=nope&page=1"],
  ["type=movie&page=999"],
  ["type=comic&page=25"],
  // Fallos de proveedor: 429 (límite), 500 y respaldo de anime por TMDB.
  ["type=movie&page=1", { tmdb: 500 }],
  ["type=anime&page=1", { anilist: 429 }],
  ["type=anime&page=1", { anilist: 500, tmdb: 500 }],
  ["type=game&page=1", { rawg: 429 }],
  // Búsqueda dentro de Descubrir.
  ["type=movie&q=dune"],
  ["type=book&q=dune&page=2"],
  ["type=game&q=portal", { rawg: 500 }],
  // Agregado: catálogo, orden, parciales y búsqueda.
  ["type=all&page=1"],
  ["type=all&page=6&sort=rating"],
  ["type=all&page=2&sort=title_az&genre=action"],
  ["type=all&page=1", { rawg: 500 }],
  ["type=all&page=1&q=dune"],
  ["type=all&page=1&q=dune", { tmdb: 429 }],
];

describe("caracterización de Descubrir (mismas entradas → mismas salidas)", () => {
  beforeEach(() => {
    resetProviderCircuits();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(SCENARIOS)("%s %j", async (qs, fail) => {
    const calls = installNetwork(fail);
    const { parsed, filters } = filtersFrom(qs);
    const result =
      parsed.type === "all"
        ? await fetchAggregateResult(parsed.page, filters, parsed.locale, parsed.q)
        : await fetchDiscoverData(parsed.type, parsed.page, filters, parsed.locale, parsed.q);
    // Orden de llamadas estable: las familias del agregado salen en paralelo.
    const sortedCalls = [...calls].sort((a, b) =>
      `${a.method} ${a.url} ${a.body ?? ""}`.localeCompare(`${b.method} ${b.url} ${b.body ?? ""}`)
    );
    expect({ calls: sortedCalls, result }).toMatchSnapshot();
  });
});
