/**
 * F-16 — páginas de rankings (DIS-10, PRO-8, CRE-11, SEO-2/7/10, ACC-10):
 * se pintan con los textos reales de es.json/en.json y un ranking simulado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";
import { resolveServer } from "./render-server";

const intl = vi.hoisted(() => ({ locale: "es" as "es" | "en" }));
const MESSAGES = { es, en } as const;

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const messages = { es: (await import("../../../messages/es.json")).default, en: (await import("../../../messages/en.json")).default };
  return {
    getLocale: async () => intl.locale,
    getTranslations: async (arg: string | { locale?: string; namespace?: string }) => {
      const opts = typeof arg === "string" ? { namespace: arg } : arg;
      const locale = (opts.locale ?? intl.locale) as "es" | "en";
      return createTranslator({ locale, messages: messages[locale], namespace: opts.namespace as never });
    },
  };
});
vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => <header data-testid="header" /> }));
vi.mock("@/components/layout/Footer", () => ({ Footer: () => <footer data-testid="footer" /> }));
vi.mock("@/lib/best/best-of", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/best/best-of")>();
  const getBestRanking = vi.fn();
  // Mismo algoritmo que el real (probado en best-of.test.ts) sobre el simulado.
  const getFeaturedRanking = async (format: string, locale: string) => {
    for (const year of real.bestYears()) {
      const ranking = await getBestRanking(format, year, locale).catch(() => null);
      if (ranking && real.isIndexableRanking(ranking.items.length)) return { year, ranking };
    }
    return null;
  };
  return { ...real, getBestRanking, getFeaturedRanking };
});

import BestOfPage, { generateMetadata } from "@/app/[locale]/best/[format]/[year]/page";
import BestHubPage from "@/app/[locale]/best/page";
import BestFormatHubPage from "@/app/[locale]/best/[format]/page";
import { getBestRanking, type BestItem, type BestRanking } from "@/lib/best/best-of";

const YEAR = new Date().getFullYear();

const item = (i: number, type: BestItem["type"] = "anime"): BestItem => ({
  id: `${type}_al-${i}`,
  externalId: `al-${i}`,
  type,
  title: `Título ${i}`,
  poster: `https://s4.anilist.co/file/cover/${i}.png`,
  year: YEAR,
  rating: 8.5 - i / 10,
  genres: ["Acción"],
  synopsis: `Sinopsis ${i}`,
});
const ranking = (n: number, minVotes?: number): BestRanking => ({
  items: Array.from({ length: n }, (_, i) => item(i + 1)),
  updatedAt: "2026-10-22T05:00:00.000Z",
  ...(minVotes !== undefined ? { minVotes } : {}),
});

async function show(node: Promise<React.ReactNode>) {
  const tree = await resolveServer(await node);
  return render(
    <NextIntlClientProvider locale={intl.locale} messages={MESSAGES[intl.locale]}>
      {tree}
    </NextIntlClientProvider>,
  );
}

const params = (format: string, year = String(YEAR), locale = "es") => ({
  params: Promise.resolve({ locale, format, year }),
});

beforeEach(() => {
  intl.locale = "es";
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://x.app");
  vi.mocked(getBestRanking).mockReset();
  vi.mocked(getBestRanking).mockResolvedValue(ranking(20));
});
afterEach(() => vi.unstubAllEnvs());

describe("ranking de un año", () => {
  it("cada título enlaza a su ficha pública y tiene Guardar (alta con vuelta a la ficha)", async () => {
    const { container } = await show(BestOfPage(params("anime")));
    const first = screen.getByRole("link", { name: "Puesto 1: Título 1" });
    expect(first).toHaveAttribute("href", "/es/media/anime/al-1");
    const save = screen.getByRole("link", { name: "Guardar Título 1" });
    expect(save).toHaveAttribute("rel", "nofollow");
    expect(save.getAttribute("href")).toBe(`/es/login?mode=register&next=${encodeURIComponent("/es/media/anime/al-1")}`);
    expect(container.querySelectorAll('a[href^="/es/media/"]')).toHaveLength(20);
  });

  it("0 imágenes con alt vacío: el póster lleva el título", async () => {
    const { container } = await show(BestOfPage(params("anime")));
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs).toHaveLength(20);
    expect(imgs.every((img) => (img.getAttribute("alt") ?? "").length > 0)).toBe(true);
    expect(imgs[0]).toHaveAttribute("alt", "Título 1");
  });

  it("podio de 3 y lista compacta desde el 4.º; Compartir justo después del podio", async () => {
    await show(BestOfPage(params("anime")));
    const podium = screen.getByRole("list", { name: "Podio: los tres primeros" });
    expect(podium.querySelectorAll(":scope > li")).toHaveLength(3);
    expect(within(podium).getByText("#1")).toBeInTheDocument();
    const rest = screen.getByRole("list", { name: "Del puesto 4 al 20" });
    expect(rest).toHaveAttribute("start", "4");
    const share = screen.getByRole("group", { name: "Compartir este ranking" });
    // Orden del documento: podio → compartir → resto.
    expect(podium.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(share.compareDocumentPosition(rest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Compartir" })).toHaveLength(1);
  });

  it("formato actual y año actual marcados con aria-current; el resto, enlaces", async () => {
    await show(BestOfPage(params("anime")));
    const formats = screen.getByRole("navigation", { name: "Formato" });
    const current = within(formats).getByRole("link", { name: "Animes" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(within(formats).getByRole("link", { name: "Películas" })).not.toHaveAttribute("aria-current");
    expect(within(formats).getByRole("link", { name: "Películas" })).toHaveAttribute("href", `/es/best/movie/${YEAR}`);
    const years = screen.getByRole("navigation", { name: "Año" });
    expect(within(years).getByRole("link", { name: String(YEAR) })).toHaveAttribute("aria-current", "page");
  });

  it("criterio con el suelo de votos aplicado y fecha de actualización", async () => {
    vi.mocked(getBestRanking).mockResolvedValue(ranking(20, 1500));
    const { container } = await show(BestOfPage(params("movie", "2024")));
    expect(screen.getByText(/al menos 1500 votos/)).toBeInTheDocument();
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("dateTime", "2026-10-22T05:00:00.000Z");
    expect(time?.textContent).toBe("22 de octubre de 2026");
  });

  it("migas visibles y JSON-LD con BreadcrumbList e ItemList con url e image", async () => {
    const { container } = await show(BestOfPage(params("anime")));
    const crumbs = screen.getByRole("navigation", { name: "Ruta de navegación" });
    expect(within(crumbs).getByRole("link", { name: "Rankings" })).toHaveAttribute("href", "/es/best");
    const ld = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.innerHTML);
    const page = ld["@graph"][0];
    expect(page.breadcrumb["@type"]).toBe("BreadcrumbList");
    for (const li of page.mainEntity.itemListElement) {
      expect(li.url).toMatch(/^https:\/\/x\.app\/es\/media\/anime\/al-\d+$/);
      expect(li.image).toMatch(/^https:\/\//);
    }
  });

  it("CTA «Guarda los que te faltan» con alta que vuelve al ranking", async () => {
    await show(BestOfPage(params("anime")));
    const cta = screen.getByRole("region", { name: "Guarda los que te faltan" });
    expect(within(cta).getByRole("link", { name: "Crear mi cuenta gratis" })).toHaveAttribute(
      "href",
      `/es/login?mode=register&next=${encodeURIComponent(`/es/best/anime/${YEAR}`)}`,
    );
  });

  it("sin el Link de next-intl (REN-9): solo <a> del servidor", async () => {
    const fs = await import("node:fs");
    for (const file of [
      "src/app/[locale]/best/[format]/[year]/page.tsx",
      "src/app/[locale]/best/[format]/page.tsx",
      "src/app/[locale]/best/page.tsx",
      "src/components/best/BestOfList.tsx",
      "src/components/best/BestNav.tsx",
      "src/components/best/BestTopRow.tsx",
    ]) {
      expect(fs.readFileSync(file, "utf8"), file).not.toMatch(/@\/i18n\/navigation|components\/collection/);
    }
  });

  it("lista corta del año en curso: aviso visible y noindex", async () => {
    vi.mocked(getBestRanking).mockResolvedValue(ranking(5));
    await show(BestOfPage(params("movie")));
    expect(screen.getByRole("note")).toHaveTextContent("solo 5 títulos llegan al criterio");
    const meta = await generateMetadata(params("movie"));
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("lista completa: indexable, con canonical y og:url propios", async () => {
    const meta = await generateMetadata(params("anime", "2025", "en"));
    expect(meta.robots).toBeUndefined();
    expect(meta.alternates?.canonical).toBe("https://x.app/en/best/anime/2025");
    expect(meta.openGraph).toMatchObject({ url: "https://x.app/en/best/anime/2025", siteName: "KULTURA" });
  });

  it("vacía: estado propio con enlace al año anterior, sin podio", async () => {
    vi.mocked(getBestRanking).mockResolvedValue(ranking(0));
    await show(BestOfPage(params("anime")));
    expect(screen.getByRole("heading", { name: `Todavía no hay ranking de ${YEAR}` })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Ver el ranking de ${YEAR - 1}` })).toHaveAttribute(
      "href",
      `/es/best/anime/${YEAR - 1}`,
    );
    expect(screen.queryByRole("list", { name: /Podio/ })).toBeNull();
    expect((await generateMetadata(params("anime"))).robots).toEqual({ index: false, follow: true });
  });

  it("en inglés: textos en inglés y nota con decimal de punto", async () => {
    intl.locale = "en";
    await show(BestOfPage(params("anime", String(YEAR), "en")));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(`Best anime of ${YEAR}`);
    expect(screen.getByRole("link", { name: "Save Título 1" })).toBeInTheDocument();
    expect(screen.getAllByText("★ 8.4")[0]).toBeInTheDocument();
  });

  it("formato o año no publicados → 404", async () => {
    await expect(BestOfPage(params("book"))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(BestOfPage(params("anime", "2019"))).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("hubs (SEO-7, D-16)", () => {
  it("/best: un bloque por formato con su top 5 enlazado a las fichas y los años", async () => {
    await show(BestHubPage({ params: Promise.resolve({ locale: "es" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Rankings de cine, series, anime y videojuegos");
    for (const name of ["Los mejores animes por año", "Las mejores películas por año", "Las mejores series por año", "Los mejores videojuegos por año"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    const top = screen.getAllByRole("list", { name: new RegExp(`Top 5 de ${YEAR}`) });
    expect(top).toHaveLength(4);
    expect(within(top[0]).getAllByRole("link")).toHaveLength(5);
    // Un landmark por formato con nombre propio (axe landmark-unique).
    expect(screen.getByRole("navigation", { name: "Todos los años · Animes" })).toBeInTheDocument();
  });

  it("/best/anime: un bloque por año; los años cortos sin pósteres pero enlazados", async () => {
    vi.mocked(getBestRanking).mockImplementation(async (_f, year) => (year === YEAR ? ranking(4) : ranking(20)));
    await show(BestFormatHubPage({ params: Promise.resolve({ locale: "es", format: "anime" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Los mejores animes por año");
    expect(screen.getByRole("link", { name: `Los mejores animes de ${YEAR}` })).toHaveAttribute("href", `/es/best/anime/${YEAR}`);
    expect(screen.queryByRole("list", { name: `Top 5 de ${YEAR}` })).toBeNull();
    expect(screen.getByRole("list", { name: `Top 5 de ${YEAR - 1}` })).toBeInTheDocument();
    const formats = screen.getByRole("navigation", { name: "Formato" });
    expect(within(formats).getByRole("link", { name: "Animes" })).toHaveAttribute("aria-current", "page");
  });

  it("/best/libros → 404", async () => {
    await expect(
      BestFormatHubPage({ params: Promise.resolve({ locale: "es", format: "book" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
