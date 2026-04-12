/**
 * Tests de tipos para MediaItem y tipos relacionados.
 * Son tests de compilación: si TypeScript compila, los tipos son correctos.
 * Los `satisfies` y asignaciones sirven como documentación ejecutable.
 */
import { describe, it, expect } from "vitest";
import type {
  MediaType,
  MediaStatus,
  MediaItem,
  StreamingProvider,
} from "@/types/media";

describe("MediaType", () => {
  it("acepta todos los tipos válidos", () => {
    const types: MediaType[] = [
      "movie",
      "tv",
      "anime",
      "book",
      "comic",
      "manga",
      "game",
    ];
    expect(types).toHaveLength(7);
  });
});

describe("MediaStatus", () => {
  it("acepta todos los estados válidos", () => {
    const statuses: MediaStatus[] = [
      "completed",
      "in_progress",
      "pending",
      "abandoned",
    ];
    expect(statuses).toHaveLength(4);
  });
});

describe("MediaItem", () => {
  it("acepta un item mínimo válido", () => {
    const item: MediaItem = {
      id: "movie_550",
      externalId: "550",
      type: "movie",
      title: "Fight Club",
    };
    expect(item.id).toBe("movie_550");
    expect(item.type).toBe("movie");
  });

  it("acepta un item completo", () => {
    const provider: StreamingProvider = {
      name: "Netflix",
      logoPath: "/logo.png",
      type: "flatrate",
    };

    const item: MediaItem = {
      id: "tv_1399",
      externalId: "1399",
      type: "tv",
      title: "Game of Thrones",
      originalTitle: "Game of Thrones",
      poster: "/poster.jpg",
      backdrop: "/backdrop.jpg",
      year: 2011,
      synopsis: "Nine noble families...",
      genres: ["Drama", "Fantasy"],
      rating: 9.2,
      ratingSource: "TMDB",
      trailerKey: "KPLWWIOCOOQ",
      streamingProviders: [provider],
      metadata: { seasons: 8, episodes: 73, status: "Ended" },
    };

    expect(item.id).toBe("tv_1399");
    expect(item.streamingProviders).toHaveLength(1);
    // metadata es Record<string, unknown> — acepta cualquier valor
    expect(item.metadata?.["seasons"]).toBe(8);
  });

  it("el id sigue el formato {type}_{externalId}", () => {
    const item: MediaItem = {
      id: "anime_1535",
      externalId: "1535",
      type: "anime",
      title: "Death Note",
    };
    const [type, externalId] = item.id.split("_");
    expect(type).toBe(item.type);
    expect(externalId).toBe(item.externalId);
  });
});
