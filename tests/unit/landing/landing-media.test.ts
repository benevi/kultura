// ============================================================
// KULTURA — Imágenes semanales con profundidad de la landing (rediseño):
// fila → objeto para el shader, URL pública del bucket, caché revalidable y
// que un fallo de la base nunca rompa la landing.
// ============================================================

import { describe, it, expect, vi } from "vitest";

const { cacheCalls, rows } = vi.hoisted(() => ({
  cacheCalls: [] as Array<{ keys: string[]; opts: { tags?: string[]; revalidate?: number } }>,
  rows: { data: null as unknown, error: null as null | { message: string } },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown, keys: string[], opts: { tags?: string[]; revalidate?: number }) => {
    cacheCalls.push({ keys, opts });
    return fn;
  },
}));
vi.mock("@/lib/env.public", () => ({ publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/" } }));
vi.mock("@/lib/supabase/admin", () => {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => q,
    then: (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res),
  };
  return { createAdminClient: () => ({ from: () => q }) };
});

import { getLandingMedia, landingPublicUrl, toLandingMedia } from "@/lib/landing/media";
import { LANDING_MEDIA_CACHE_TAG, REVALIDATABLE_TAGS } from "@/lib/best/cache-tags";

const row = {
  slot: "hero", position: 0, format: "movie", media_type: "movie", external_id: "123", title: "Proyecto Salvación",
  year: 2026, rating: null, image_path: "2026-11-02/hero-0.jpg", depth_path: "2026-11-02/hero-0_d.jpg",
  width: 1920, height: 1080, threshold: 0.18, focus_x: 0.63, focus_y: 0.4, layered: true, accent: "#ea773a",
};

describe("landing-media", () => {
  it("construye la URL pública del bucket «landing» sin barras dobles", () => {
    expect(landingPublicUrl("/2026-11-02/hero-0.jpg")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/landing/2026-11-02/hero-0.jpg",
    );
  });

  it("convierte una fila en lo que necesita el shader", () => {
    const m = toLandingMedia(row);
    expect(m.focus).toEqual([0.63, 0.4]);
    expect(m.depth.endsWith("hero-0_d.jpg")).toBe(true);
    expect(m.layered).toBe(true);
    expect(m.rating).toBeNull();
  });

  it("cachea una semana con una etiqueta que /api/revalidate acepta", () => {
    const call = cacheCalls.find((c) => c.keys[0].startsWith("landing-media"));
    expect(call?.opts.tags).toEqual([LANDING_MEDIA_CACHE_TAG]);
    expect(call?.opts.revalidate).toBe(60 * 60 * 24 * 7);
    expect(REVALIDATABLE_TAGS).toContain(LANDING_MEDIA_CACHE_TAG);
  });

  it("devuelve las filas activas convertidas", async () => {
    rows.data = [row];
    rows.error = null;
    const out = await getLandingMedia();
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Proyecto Salvación");
  });

  it("nunca lanza: con un error de la base devuelve [] (la landing usa su respaldo)", async () => {
    rows.data = null;
    rows.error = { message: "relation does not exist" };
    await expect(getLandingMedia()).resolves.toEqual([]);
  });
});
