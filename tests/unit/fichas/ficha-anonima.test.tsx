// ============================================================
// FICHA_ISR · Ficha cacheable para visitantes sin sesión
// La misma ficha que ve hoy un anónimo, sin leer la sesión; 404 solo cuando
// el título no existe (se guarda en la caché) y error cuando no se sabe.
// ============================================================

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MediaDetailData } from "@/lib/media/detail-data";

const mocks = vi.hoisted(() => ({
  loadMediaDetailResult: vi.fn(),
  getKulturaRating: vi.fn(),
  createClient: vi.fn(),
  getMediaEntry: vi.fn(),
  setRequestLocale: vi.fn(),
  loadSalaFichaExtras: vi.fn(),
  mediaDetailProps: { current: null as null | Record<string, unknown> },
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next-intl/server", () => ({
  setRequestLocale: mocks.setRequestLocale,
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/lib/media/detail-data", () => ({ loadMediaDetailResult: mocks.loadMediaDetailResult }));
vi.mock("@/lib/media/kultura-rating", () => ({ getKulturaRating: mocks.getKulturaRating }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/library/queries", () => ({ getMediaEntry: mocks.getMediaEntry }));
vi.mock("@/lib/recommendations/match-score", () => ({ computeMatchScores: vi.fn() }));
vi.mock("@/lib/media/sala-extras", () => ({ loadSalaFichaExtras: mocks.loadSalaFichaExtras }));
vi.mock("@/lib/translate/synopsis", () => ({
  translateSynopsis: vi.fn(async ({ text }: { text: string }) => text),
}));
vi.mock("@/components/media/MediaDetail", () => ({
  MediaDetail: (props: Record<string, unknown>) => {
    mocks.mediaDetailProps.current = props;
    return <main data-testid="media-detail" />;
  },
}));

import FichaAnonimaPage, { generateMetadata } from "@/app/[locale]/media-anonima/[type]/[id]/page";

function detail(): MediaDetailData {
  return {
    item: {
      id: "movie_550",
      externalId: "550",
      type: "movie",
      title: "El club de la lucha",
      year: 1999,
      synopsis: "Sinopsis.",
      genres: ["Thriller"],
    },
    genreLabels: ["Suspense"],
    providers: [],
    steam: null,
    source: null,
    nsfw: false,
  } as unknown as MediaDetailData;
}

const params = () => ({ params: Promise.resolve({ locale: "es", type: "movie", id: "550" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mediaDetailProps.current = null;
  mocks.getKulturaRating.mockResolvedValue(null);
  mocks.loadSalaFichaExtras.mockResolvedValue(null);
  mocks.loadMediaDetailResult.mockResolvedValue({ status: "ok", data: detail() });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ficha cacheable (FICHA_ISR)", () => {
  it("pinta la ficha de un anónimo sin tocar la sesión", async () => {
    render(await FichaAnonimaPage(params()));
    expect(screen.getByTestId("media-detail")).toBeTruthy();
    const props = mocks.mediaDetailProps.current!;
    expect(props.isAuthenticated).toBe(false);
    expect(props.initialEntry).toBeNull();
    expect(props.shareRating).toBeNull();
    expect(props.matchScore).toBeUndefined();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getMediaEntry).not.toHaveBeenCalled();
    expect(mocks.setRequestLocale).toHaveBeenCalledWith("es");
  });

  it("título que no existe → 404 (cacheable)", async () => {
    mocks.loadMediaDetailResult.mockResolvedValue({ status: "missing" });
    await expect(FichaAnonimaPage(params())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("proveedor caído → error, no 404 (no se guarda en la caché)", async () => {
    mocks.loadMediaDetailResult.mockResolvedValue({ status: "unavailable" });
    await expect(FichaAnonimaPage(params())).rejects.toThrow("ficha no disponible ahora");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("«Sala» solo con SALA_FICHA=1; con `prueba` (cookie) o `0`, la ficha de hoy", async () => {
    for (const [value, sala] of [["1", true], ["prueba", false], ["0", false]] as const) {
      vi.stubEnv("SALA_FICHA", value);
      render(await FichaAnonimaPage(params()));
      expect(mocks.mediaDetailProps.current!.sala).toBe(sala);
    }
  });

  it("metadatos: los mismos que la ficha de siempre; sin ficha, el título de «no encontrado»", async () => {
    expect((await generateMetadata(params())).title).toBe("El club de la lucha (1999) · movie");
    mocks.loadMediaDetailResult.mockResolvedValue({ status: "unavailable" });
    expect((await generateMetadata(params())).title).toBe("notFound");
  });
});
