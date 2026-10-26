/**
 * Contrato — datos del progreso por formato (F-27).
 * Llama a los clientes reales con `PROVIDER_CONTRACT_MODE=enforce` y
 * comprueba que lo que usa «marcar siguiente» sigue llegando con la forma de
 * las fixtures de `tests/unit/progress/fixtures/tmdb.ts`:
 *   TMDB /tv/{id} → seasons[].episode_count, status, last_episode_to_air
 *   TMDB /tv/{id}/season/{n} → episodes[].episode_number, name, air_date
 *   RAWG /games/{id} → playtime (horas medias)
 * Gasta 2 peticiones de TMDB y 1 de RAWG.
 */
import { it, expect } from "vitest";
import { describeWithKeys } from "./helpers";
import { getTV } from "@/lib/api/tmdb";
import { getGame } from "@/lib/api/rawg";
import { getTvSeason, tvPlanFromTmdb, type TmdbTvProgressFields } from "@/lib/library/progress-server";
import { nextProgress } from "@/lib/library/progress";

const GAME_OF_THRONES = 1399; // terminada: 8 temporadas (73 episodios) + especiales
const HADES = 274755;

describeWithKeys(["TMDB_API_KEY"], "TMDB (progreso de series)", () => {
  it("/tv/{id}: temporadas con episode_count y estado; el plan sale como en las fixtures", async () => {
    const tv = (await getTV(GAME_OF_THRONES, "es")) as unknown as TmdbTvProgressFields;
    const plan = tvPlanFromTmdb(tv);
    expect(plan.ended).toBe(true);
    expect(plan.seasons?.map((s) => s.episodes)).toEqual([10, 10, 10, 10, 10, 10, 7, 6]);
    expect(nextProgress("tv", { season: 1, episode: 10 }, plan)?.value).toMatchObject({ season: 2, episode: 1 });
    expect(nextProgress("tv", { season: 8, episode: 5 }, plan)?.finished).toBe(true);
  });

  it("/tv/{id}/season/{n}: episodios numerados con nombre y fecha", async () => {
    const season = await getTvSeason(GAME_OF_THRONES, 1, "es");
    expect(season.season_number).toBe(1);
    expect(season.episodes).toHaveLength(10);
    expect(season.episodes[0].episode_number).toBe(1);
    expect(typeof season.episodes[0].name).toBe("string");
    expect(season.episodes[0].air_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describeWithKeys(["RAWG_API_KEY"], "RAWG (horas de juego)", () => {
  it("ficha: playtime en horas", async () => {
    const game = await getGame(HADES);
    expect(typeof game.playtime).toBe("number");
  });
});
