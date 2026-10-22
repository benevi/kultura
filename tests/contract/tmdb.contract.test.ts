/**
 * Contrato — TMDB (cine, series y respaldo de anime).
 * Llama a los clientes reales con `PROVIDER_CONTRACT_MODE=enforce`.
 * Requiere TMDB_API_KEY.
 */
import { it, expect } from "vitest";
import { describeWithKeys, expectFieldCoverage } from "./helpers";
import {
  discoverTV,
  getMovie,
  getMovieProviders,
  getMovieVideos,
  getPopularMovies,
  searchMovies,
  tmdbWatchLink,
  probeTmdb,
} from "@/lib/api/tmdb";

const FIGHT_CLUB = 550;

describeWithKeys(["TMDB_API_KEY"], "TMDB", () => {
  it("búsqueda: cumple el contrato y trae los campos que pinta la card", async () => {
    const res = await searchMovies("matrix", 1, "es");
    expect(res.results.length).toBeGreaterThan(0);
    expectFieldCoverage(res.results, [
      "title",
      "poster_path",
      "release_date",
      "overview",
      "vote_average",
      "genre_ids",
    ]);
    expect(typeof res.total_pages).toBe("number");
  });

  it("populares y descubrir series cumplen el contrato", async () => {
    expect((await getPopularMovies(1, "es")).results.length).toBeGreaterThan(0);
    const tv = await discoverTV(1, {}, "es");
    expectFieldCoverage(tv.results, ["name", "first_air_date", "poster_path"]);
  });

  it("ficha: cumple el contrato", async () => {
    const movie = await getMovie(FIGHT_CLUB, "es");
    expect(movie.id).toBe(FIGHT_CLUB);
    expectFieldCoverage([movie], ["title", "runtime", "genres", "credits.crew"], 1);
  });

  it("vídeos y proveedores: forma y enlace 'dónde ver' de TMDB (JustWatch)", async () => {
    const videos = await getMovieVideos(FIGHT_CLUB, "es");
    expect(Array.isArray(videos.results)).toBe(true);
    const providers = await getMovieProviders(FIGHT_CLUB, "ES", "es");
    // Si TMDB deja de mandar `link`, las plataformas se quedan sin enlace.
    expect(tmdbWatchLink(providers, "ES")).toMatch(/^https:\/\/www\.themoviedb\.org\//);
  });

  it("sonda de /api/health?deep=1", async () => {
    await expect(probeTmdb()).resolves.toBeUndefined();
  });
});
