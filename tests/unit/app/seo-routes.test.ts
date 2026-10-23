import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/lib/best/sitemap", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/best/sitemap")>();
  return { ...real, sectionSitemap: vi.fn(async (id: string) => (id === "pages" ? real.pagesSitemap() : [])) };
});

import robots from "@/app/robots";
import sitemap, { generateSitemaps } from "@/app/sitemap";
import { GET as sitemapIndex } from "@/app/sitemap.xml/route";

afterEach(() => vi.unstubAllEnvs());

describe("robots y sitemap", () => {
  it("apuntan a la URL pública configurada, sin barra doble", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://kulturaapp.vercel.app/");
    expect(robots().sitemap).toBe("https://kulturaapp.vercel.app/sitemap.xml");
    expect((await sitemap({ id: "pages" }))[0].url).toBe("https://kulturaapp.vercel.app/es");
  });

  it("no deja indexar la API", () => {
    const rules = robots().rules as { disallow: string };
    expect(rules.disallow).toBe("/api/");
  });

  it("una sección por id y el índice /sitemap.xml las enumera todas (SEO-3)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.app");
    const ids = (await generateSitemaps()).map((s) => s.id);
    expect(ids).toEqual(["pages", "rankings", "titles", "collections"]);
    const res = sitemapIndex();
    expect(res.headers.get("content-type")).toContain("application/xml");
    const xml = await res.text();
    expect(xml).toContain("<sitemapindex");
    for (const id of ids) expect(xml).toContain(`<loc>https://x.app/sitemap/${id}.xml</loc>`);
  });

  it("páginas fijas: portada y las cuatro legales en los dos idiomas, sin /login (noindex)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.app");
    const urls = (await sitemap({ id: "pages" })).map((e) => e.url);
    expect(urls).toEqual([
      "https://x.app/es",
      "https://x.app/en",
      "https://x.app/es/privacy",
      "https://x.app/en/privacy",
      "https://x.app/es/terms",
      "https://x.app/en/terms",
      "https://x.app/es/legal",
      "https://x.app/en/legal",
      "https://x.app/es/accessibility",
      "https://x.app/en/accessibility",
    ]);
    expect(urls.some((u) => u.includes("/login"))).toBe(false);
    expect(urls.some((u) => /library|discover|settings/.test(u))).toBe(false);
  });
});
