// ============================================================
// Fase 8.2 · Tarjeta OG de una lista pública (/u/{usuario}/l/{id}).
//   - sin `generateImageMetadata`: la ruta es `/opengraph-image`, la que pide
//     `ogImagePath` al compartir con imagen;
//   - hasta cuatro portadas de la lista; caché corta;
//   - lista privada o inexistente: tarjeta sin portadas, nunca un error.
// ============================================================

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  responses: [] as Array<{ element: unknown; options: Record<string, unknown> }>,
  posterDataUri: vi.fn(async (src: string) => `data:image/jpeg;base64,${src}`),
  getPublicList: vi.fn(),
}));

vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(element: unknown, options: Record<string, unknown>) {
      h.responses.push({ element, options });
    }
  },
}));
vi.mock("@/lib/og/brand", async (orig) => ({
  ...(await orig<typeof import("@/lib/og/brand")>()),
  loadFont: async () => null,
}));
vi.mock("@/lib/og/poster", () => ({ posterDataUri: h.posterDataUri }));
vi.mock("@/lib/social/public-collection", () => ({ getPublicList: h.getPublicList }));

import * as card from "@/app/[locale]/u/[username]/l/[id]/opengraph-image";
import { ogImagePath } from "@/components/pwa/share";

const PARAMS = { locale: "es", username: "ana", id: "l1" };
const item = (n: number, poster: string | null) => ({ mediaId: `movie_${n}`, title: `T${n}`, poster, type: "movie", year: 2000 });

/** Texto de la tarjeta, recorriendo el árbol de elementos. */
function text(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  return text((node as { props?: { children?: unknown } }).props?.children);
}

beforeEach(() => {
  h.responses.length = 0;
  h.posterDataUri.mockClear();
  h.getPublicList.mockReset();
});

describe("tarjeta OG de una lista pública", () => {
  it("vive en /opengraph-image (sin generateImageMetadata), como espera ogImagePath", () => {
    expect("generateImageMetadata" in card).toBe(false);
    expect(card.size).toEqual({ width: 1200, height: 630 });
    expect(ogImagePath("/es/u/ana/l/l1")).toBe("/es/u/ana/l/l1/opengraph-image");
  });

  it("nombre de la lista, de quién es, cuántos títulos y hasta cuatro portadas", async () => {
    h.getPublicList.mockResolvedValue({
      owner: { username: "Ana" },
      list: { id: "l1", name: "Cine para un domingo", mediaType: "movie", items: [item(1, "a"), item(2, null), item(3, "c"), item(4, "d"), item(5, "e"), item(6, "f")] },
    });
    await card.default({ params: Promise.resolve(PARAMS) });

    expect(h.getPublicList).toHaveBeenCalledWith("ana", "l1");
    expect(h.posterDataUri.mock.calls.map((c) => c[0])).toEqual(["a", "c", "d", "e"]);
    const [{ element, options }] = h.responses;
    const shown = text(element);
    expect(shown).toContain("Cine para un domingo");
    expect(shown).toContain("Una lista de Ana en KULTURA.");
    expect(shown).toContain("6 títulos");
    expect((options.headers as Record<string, string>)["cache-control"]).toBe("public, max-age=300, s-maxage=600");
  });

  it("lista privada, inexistente o con fallo: tarjeta sin portadas, sin lanzar", async () => {
    h.getPublicList.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("db"));
    await card.default({ params: PARAMS });
    await card.default({ params: { ...PARAMS, locale: "en", username: "%" } });
    expect(h.responses).toHaveLength(2);
    expect(h.posterDataUri).not.toHaveBeenCalled();
    expect(text(h.responses[0].element)).not.toContain("títulos");
  });
});
