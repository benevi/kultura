import { describe, it, expect, vi, afterEach } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

afterEach(() => vi.unstubAllEnvs());

describe("robots y sitemap", () => {
  it("apuntan a la URL pública configurada, sin barra doble", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://kulturaapp.vercel.app/");
    expect(robots().sitemap).toBe("https://kulturaapp.vercel.app/sitemap.xml");
    expect(sitemap()[0].url).toBe("https://kulturaapp.vercel.app/es");
  });

  it("no deja indexar la API", () => {
    const rules = robots().rules as { disallow: string };
    expect(rules.disallow).toBe("/api/");
  });

  it("solo lista páginas públicas, en los dos idiomas", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.app");
    const urls = sitemap().map((e) => e.url);
    expect(urls).toHaveLength(8);
    expect(urls).toContain("https://x.app/en/privacy");
    expect(urls.some((u) => /library|discover|settings/.test(u))).toBe(false);
  });
});
