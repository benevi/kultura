// ============================================================
// KULTURA — jikan-maps.ts unit tests
// Los builders de traducción a params nativos de Jikan (buildJikanDiscoverParams
// y afines) se eliminaron con E-ANIME-SOURCE/E-MANGA-SOURCE (ya no tienen
// caller: anime → AniList, manga → MangaDex). Lo único que sigue vivo aquí es
// el post-filtro de volúmenes (manga), compartido por ambos proveedores.
// ============================================================

import { describe, it, expect } from "vitest";
import { volumenesMin, filterByMinVolumes } from "@/lib/api/jikan-maps";
import type { MediaItem } from "@/types/media";

describe("volumenesMin", () => {
  it("buckets canónicos → umbral mínimo", () => {
    expect(volumenesMin("1-5")).toBe(1);
    expect(volumenesMin("6-20")).toBe(6);
    expect(volumenesMin("20plus")).toBe(20);
  });

  it("vacío / desconocido → null", () => {
    expect(volumenesMin(null)).toBeNull();
    expect(volumenesMin(undefined)).toBeNull();
    expect(volumenesMin("zzz")).toBeNull();
  });
});

describe("filterByMinVolumes", () => {
  const items = [
    { id: "manga_1", metadata: { volumes: 3 } },
    { id: "manga_2", metadata: { volumes: 10 } },
    { id: "manga_3", metadata: { volumes: 30 } },
    { id: "manga_4", metadata: { volumes: undefined } },
    { id: "manga_5", metadata: {} },
  ] as MediaItem[];

  it("'6-20' → conserva >= 6, descarta menores y sin volumes", () => {
    expect(filterByMinVolumes(items, "6-20").map((i) => i.id)).toEqual([
      "manga_2",
      "manga_3",
    ]);
  });

  it("'20plus' → solo >= 20", () => {
    expect(filterByMinVolumes(items, "20plus").map((i) => i.id)).toEqual([
      "manga_3",
    ]);
  });

  it("bucket vacío/desconocido → items intactos (no filtra)", () => {
    expect(filterByMinVolumes(items, null)).toHaveLength(5);
    expect(filterByMinVolumes(items, "zzz")).toHaveLength(5);
  });
});
