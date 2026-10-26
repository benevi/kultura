/**
 * Contrato — Calendario (F-28). Las mismas peticiones que hace
 * `src/lib/calendar/sources.ts`, contra las APIs reales y con
 * `PROVIDER_CONTRACT_MODE=enforce`: si TMDB, RAWG, AniList o MangaDex cambian
 * la forma de los campos que lee el calendario, aquí salta. Es la otra mitad
 * de los ejemplos de `tests/unit/calendar-email/fixtures.ts` (el proxy de
 * desarrollo no deja llegar a los proveedores).
 *
 * Uso: npm run test:contract (con TMDB_API_KEY y RAWG_API_KEY reales); cada
 * semana lo lanza .github/workflows/contract.yml.
 */
import { describe, it, expect } from "vitest";
import { describeWithKeys, pause } from "./helpers";
import {
  fetchAniListBatch,
  fetchMangaDexFeed,
  fetchRawgGame,
  fetchTmdbMovie,
  fetchTmdbTv,
  parseAniList,
  parseMangaDexFeed,
  parseRawgGame,
  parseTmdbMovie,
  parseTmdbTv,
  planFor,
} from "@/lib/calendar/sources";
import { addDays, dateInZone, type CalendarCandidate } from "@/lib/calendar/types";

const now = new Date();
const today = dateInZone(now);
const window = { today, until: addDays(today, 90), now, region: "ES", locale: "es" };

function c(mediaId: string, status: CalendarCandidate["status"] = "in_progress"): CalendarCandidate {
  const i = mediaId.indexOf("_");
  return { mediaId, type: mediaId.slice(0, i) as CalendarCandidate["type"], externalId: mediaId.slice(i + 1), title: mediaId, poster: null, status };
}

describeWithKeys(["TMDB_API_KEY"], "TMDB (calendario)", () => {
  it("/tv/{id}: next/last_episode_to_air con air_date AAAA-MM-DD o null", async () => {
    // Los Simpson: siempre en emisión, casi siempre con un episodio anunciado.
    const raw = await fetchTmdbTv(456, "es");
    expect("next_episode_to_air" in raw).toBe(true);
    expect("last_episode_to_air" in raw).toBe(true);
    for (const ep of [raw.next_episode_to_air, raw.last_episode_to_air]) {
      if (ep) expect(ep.air_date === null || /^\d{4}-\d{2}-\d{2}$/.test(ep.air_date ?? "")).toBe(true);
    }
    expect(() => parseTmdbTv(c("tv_456"), raw, window)).not.toThrow();
  });

  it("/movie/{id}?append_to_response=release_dates: fechas por país con type", async () => {
    await pause(300);
    const raw = await fetchTmdbMovie(550);
    const es = raw.release_dates?.results.find((r) => r.iso_3166_1 === "ES");
    expect(es?.release_dates.length).toBeGreaterThan(0);
    expect(typeof es?.release_dates[0].type).toBe("number");
    expect(() => parseTmdbMovie(c("movie_550", "pending"), raw, window)).not.toThrow();
  });
});

describeWithKeys(["RAWG_API_KEY"], "RAWG (calendario)", () => {
  it("/games/{id}: released y tba", async () => {
    const raw = await fetchRawgGame(3498);
    expect(raw.released).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof raw.tba).toBe("boolean");
    expect(parseRawgGame(c("game_3498", "pending"), raw, window)).toEqual([]);
  });
});

describe("AniList (calendario)", () => {
  it("una consulta por lotes (id e idMal) con nextAiringEpisode", async () => {
    const plans = [planFor(c("anime_al-21"))!, planFor(c("anime_21"))!, planFor(c("manga_13"))!] as Parameters<
      typeof fetchAniListBatch
    >[0];
    const found = await fetchAniListBatch(plans);
    expect(found.get("id:21")?.id).toBe(21);
    expect(found.get("mal:ANIME:21")?.id).toBe(21);
    expect(found.get("mal:MANGA:13")?.type).toBe("MANGA");
    expect("nextAiringEpisode" in found.get("id:21")!).toBe(true);
    expect(() => parseAniList(c("anime_al-21"), found.get("id:21")!, window)).not.toThrow();
  });
});

describe("MangaDex (calendario)", () => {
  it("/manga/{id}/feed: capítulos con chapter, translatedLanguage y readableAt", async () => {
    await pause(500);
    // One Piece en MangaDex.
    const raw = await fetchMangaDexFeed("a1c7c817-4e59-43b7-9365-09675a149a6f", "es");
    expect(Array.isArray(raw.data)).toBe(true);
    for (const ch of raw.data.slice(0, 3)) {
      expect(typeof ch.attributes.translatedLanguage).toBe("string");
      expect(Number.isNaN(Date.parse(ch.attributes.readableAt ?? ch.attributes.publishAt ?? ""))).toBe(false);
    }
    expect(() => parseMangaDexFeed(c("manga_a1c7c817-4e59-43b7-9365-09675a149a6f"), raw, window)).not.toThrow();
  });
});
