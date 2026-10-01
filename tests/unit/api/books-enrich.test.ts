// ============================================================
// KULTURA — Puente Open Library → Google Books en la ficha (E-BOOKS-HIBRIDO)
//
// El contrato es de robustez: el puente MEJORA la ficha cuando puede y NUNCA
// la empeora. Si Google no responde, no hay ISBN o no hay coincidencia, se
// sirve el ítem de Open Library tal cual.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MediaItem } from "@/types/media";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));

vi.mock("@/lib/api/googlebooks", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/googlebooks")>();
  return { ...actual, searchGoogleBooks: searchMock };
});

import { enrichBookWithGoogle } from "@/lib/api/books-enrich";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function olItem(over: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "book_OL7353617W",
    externalId: "OL7353617W",
    type: "book",
    title: "Persuasión",
    poster: "https://covers.openlibrary.org/b/id/1-L.jpg",
    year: 1817,
    genres: ["fiction", "accessible book"],
    metadata: { isbn: ["9788491050704"] },
    ...over,
  } as MediaItem;
}

function googleVolume() {
  return {
    id: "gbVolume1",
    volumeInfo: {
      title: "Persuasión",
      description: "Una sinopsis mucho mejor.",
      imageLinks: { thumbnail: "https://books.google.com/portada.jpg" },
      categories: ["Fiction / Classics"],
      language: "es",
    },
  };
}

beforeEach(() => {
  searchMock.mockReset();
});

describe("enrichBookWithGoogle", () => {
  it("toma portada, sinopsis y géneros de Google cuando los hay", async () => {
    searchMock.mockResolvedValue({ items: [googleVolume()] });

    const out = await enrichBookWithGoogle(olItem());

    expect(out.synopsis).toBe("Una sinopsis mucho mejor.");
    expect(out.poster).toContain("books.google.com");
    expect(out.genres).toEqual(["Fiction / Classics"]);
  });

  it("NO cambia el id: el enlace y la vuelta a la biblioteca dependen de él", async () => {
    searchMock.mockResolvedValue({ items: [googleVolume()] });

    const out = await enrichBookWithGoogle(olItem());

    expect(out.id).toBe("book_OL7353617W");
    expect(out.externalId).toBe("OL7353617W");
    expect(out.type).toBe("book");
  });

  it("busca por ISBN, no por título: entre ediciones el título se repite", async () => {
    searchMock.mockResolvedValue({ items: [googleVolume()] });

    await enrichBookWithGoogle(olItem());

    expect(searchMock).toHaveBeenCalledWith(
      "isbn:9788491050704",
      1,
      {},
      null
    );
  });

  it("sin ISBN no se puentea: mejor sin mejora que con la portada equivocada", async () => {
    const item = olItem({ metadata: {} });

    const out = await enrichBookWithGoogle(item);

    expect(out).toBe(item);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("sin coincidencia en Google devuelve el ítem intacto", async () => {
    searchMock.mockResolvedValue({ items: [] });

    const item = olItem();
    const out = await enrichBookWithGoogle(item);

    expect(out.synopsis).toBe(item.synopsis);
    expect(out.poster).toBe(item.poster);
  });

  it("si Google falla (cuota, sin clave, red) se sirve Open Library", async () => {
    searchMock.mockRejectedValue(new Error("429"));

    const item = olItem();
    const out = await enrichBookWithGoogle(item);

    expect(out).toBe(item);
  });

  it("conserva lo de Open Library en los campos que Google no trae", async () => {
    searchMock.mockResolvedValue({
      items: [{ id: "g", volumeInfo: { title: "Persuasión" } }],
    });

    const item = olItem({ synopsis: "Sinopsis de Open Library" });
    const out = await enrichBookWithGoogle(item);

    expect(out.synopsis).toBe("Sinopsis de Open Library");
    expect(out.poster).toBe(item.poster);
    expect(out.genres).toEqual(item.genres);
  });
});
