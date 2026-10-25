import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ShowcaseItem } from "@/lib/landing/showcase";
import type { BestItem } from "@/lib/best/best-of";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

// next/image no funciona en jsdom → <img> plano (mismo mock que media-card).
vi.mock("next/image", () => ({
  default: (
    props: React.ImgHTMLAttributes<HTMLImageElement> & {
      fill?: boolean;
      priority?: boolean;
      sizes?: string;
      loader?: unknown;
    }
  ) => {
    const { fill: _fill, priority: _priority, sizes: _sizes, loader: _loader, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

// next-intl con los mensajes REALES (es/en): así el test comprueba la copia
// de D-11 tal cual está en `messages/` y no un texto inventado aquí.
const { intl } = vi.hoisted(() => ({ intl: { locale: "es" as "es" | "en" } }));

function lookup(messages: Record<string, unknown>, ns: string, key: string): unknown {
  return [ns, ...key.split(".")].reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
    messages
  );
}

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => intl.locale),
  getTranslations: vi.fn(async (arg: string | { locale: string; namespace: string }) => {
    const ns = typeof arg === "string" ? arg : arg.namespace;
    const loc = typeof arg === "string" ? intl.locale : arg.locale;
    const messages = (loc === "en" ? en : es) as unknown as Record<string, unknown>;
    const t = (key: string, vars?: Record<string, string | number>) => {
      const raw = lookup(messages, ns, key);
      if (typeof raw !== "string") return `${ns}.${key}`;
      return raw.replace(/\{(\w+)\}/g, (_, v: string) => String(vars?.[v] ?? `{${v}}`));
    };
    t.raw = (key: string) => lookup(messages, ns, key);
    return t;
  }),
}));

const { demo } = vi.hoisted(() => ({ demo: { email: "demo@example.com" as string | undefined } }));
vi.mock("@/lib/env.server", () => ({
  env: new Proxy({}, { get: (_t, prop) => (prop === "DEMO_USER_EMAIL" ? demo.email : undefined) }),
}));

// E-LANDING-SHOWCASE: los huecos de portadas son Server Components ASÍNCRONOS
// dentro de <Suspense>, y react-dom no sabe renderizarlos en jsdom. Se mockean
// por sus versiones síncronas y el test inyecta las portadas ahí.
const { showcase } = vi.hoisted(() => ({
  showcase: { items: [] as ShowcaseItem[], fans: undefined as Record<string, (BestItem | null)[]> | undefined },
}));

vi.mock("@/components/landing/ShowcaseSlots", async () => {
  const { ImmersiveBackdrop } = await import("@/components/landing/ImmersiveBackdrop");
  const { HeroStrip } = await import("@/components/landing/HeroCollage");
  const { FeatureGrid } = await import("@/components/landing/FeatureGrid");
  const { BestRankings } = await import("@/components/landing/BestRankings");
  const { HowItWorks } = await import("@/components/landing/HowItWorks");
  return {
    FeatureGridSlot: ({ locale: _l, ...props }: { locale: string } & React.ComponentProps<typeof FeatureGrid>) => (
      <FeatureGrid {...props} posters={showcase.items} />
    ),
    HowItWorksSlot: ({ locale: _l, ...props }: { locale: string } & React.ComponentProps<typeof HowItWorks>) => (
      <HowItWorks {...props} posters={showcase.items} />
    ),
    BestRankingsSlot: ({ locale: _l, ...props }: { locale: string } & React.ComponentProps<typeof BestRankings>) => (
      <BestRankings {...props} fans={showcase.fans} />
    ),
    HeroBackdropSlot: () => <ImmersiveBackdrop items={showcase.items} />,
    HeroStripSlot: () => <HeroStrip items={showcase.items} />,
  };
});

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: () => <header data-testid="mock-header" />,
}));

vi.mock("@/components/layout/Footer", () => ({
  Footer: () => <footer data-testid="mock-footer" />,
}));

import HomePage, { generateMetadata } from "@/app/[locale]/page";

/** Muestra de portadas: una por familia primero (como pickShowcase). */
function showcaseItems(n = 21): ShowcaseItem[] {
  const types = ["movie", "tv", "anime", "book", "manga", "game", "comic"] as const;
  return Array.from({ length: n }, (_, i) => ({
    id: `${types[i % types.length]}_${i}`,
    title: `Título ${i}`,
    type: types[i % types.length],
    poster: `https://image.tmdb.org/t/p/w500/poster-${i}.jpg`,
  }));
}

async function renderPage(locale: "es" | "en" = "es") {
  intl.locale = locale;
  return render(await HomePage());
}

function jsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script?.innerHTML ?? "{}") as { "@graph": Array<Record<string, unknown>> };
}

describe("Landing · hero único (D-11)", () => {
  beforeEach(() => {
    showcase.items = showcaseItems();
    showcase.fans = undefined;
    demo.email = "demo@example.com";
  });

  it("un solo h1, con la copia confirmada y la palabra watchlist", async () => {
    await renderPage();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Tu watchlist de cine, series, anime, manga, juegos, libros y cómics");
  });

  it("en inglés, el mismo hero traducido", async () => {
    await renderPage("en");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Your watchlist for movies, TV, anime, manga, games, books and comics"
    );
    expect(screen.getAllByRole("link", { name: "Create my free account" }).length).toBeGreaterThanOrEqual(1);
  });

  // Antes el CTA vivía en el capítulo final de la intro, oculto con
  // `visibility:hidden` hasta los 12,9-14 s. Ahora sale con el HTML.
  it("subtítulo y los dos botones están en el primer pintado, sin esperar a la intro", async () => {
    showcase.items = [];
    const { container } = await renderPage();
    const hero = container.querySelector("section[aria-labelledby='hero-title']") as HTMLElement;
    expect(hero).not.toBeNull();
    expect(
      within(hero).getByText(
        "Apunta lo que quieres ver, leer y jugar, puntúa lo que ya viste y compártelo con tus amigos. Gratis y sin anuncios."
      )
    ).toBeInTheDocument();
    const cta = within(hero).getByRole("link", { name: "Crear mi cuenta gratis" });
    expect(cta).toHaveAttribute("href", "/login?mode=register");
    expect(within(hero).getByRole("button", { name: "Ver la demo" })).toBeInTheDocument();
    // Nada del hero está oculto a la espera de la animación.
    expect(hero.querySelector("[style*='visibility']")).toBeNull();
  });

  it("sin cuenta demo configurada no hay botón de demo ni pregunta sobre ella", async () => {
    demo.email = undefined;
    await renderPage();
    expect(screen.queryByRole("button", { name: "Ver la demo" })).toBeNull();
    expect(screen.queryByText("¿Puedo probarla sin registrarme?")).toBeNull();
  });

  // ACC-6: el capítulo de formatos anunciaba cada palabra con aria-live.
  it("no hay regiones aria-live en la landing", async () => {
    const { container } = await renderPage();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("el badge del hero sale de los mensajes", async () => {
    await renderPage();
    expect(screen.getByText("7 formatos, 1 sola lista")).toBeInTheDocument();
  });
});

describe("Landing · secciones", () => {
  beforeEach(() => {
    showcase.items = showcaseItems();
    showcase.fans = undefined;
    demo.email = "demo@example.com";
  });

  it("orden: features, así funciona, rankings, comparativa, FAQ y cierre", async () => {
    await renderPage();
    const h2 = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    const year = new Date().getFullYear();
    expect(h2).toEqual([
      "Lo que hay dentro.",
      "Así funciona",
      `Lo mejor de ${year}`,
      "La alternativa a Letterboxd, Trakt y MyAnimeList",
      "Preguntas frecuentes",
      "Tu cultura, en un solo sitio.",
    ]);
  });

  it("la landing termina con el CTA (cierre con los dos botones)", async () => {
    const { container } = await renderPage();
    const final = container.querySelector("section[aria-labelledby='final-title']") as HTMLElement;
    expect(within(final).getByRole("link", { name: "Crear mi cuenta gratis" })).toHaveAttribute(
      "href",
      "/login?mode=register"
    );
    expect(within(final).getByRole("button", { name: "Ver la demo" })).toBeInTheDocument();
  });

  // SEO-9: los cuatro rankings del año y todos los anteriores (≥ 12 enlaces).
  it("enlaza a los rankings de todos los años publicados", async () => {
    const { container } = await renderPage();
    const year = new Date().getFullYear();
    const links = Array.from(container.querySelectorAll("a[href^='/best/']"));
    expect(links.length).toBeGreaterThanOrEqual(12);
    for (const f of ["anime", "movie", "tv", "game"]) {
      for (let y = 2024; y <= year; y++) {
        expect(container.querySelector(`a[href="/best/${f}/${y}"]`)).not.toBeNull();
      }
    }
    // Los chips de años anteriores llevan el título completo como nombre.
    expect(screen.getByRole("link", { name: "Las mejores películas de 2024" })).toBeInTheDocument();
  });

  it("la pegatina de la card de IA está traducida (TXT-4)", async () => {
    await renderPage("en");
    expect(screen.getByText(/✦\s*AI/)).toBeInTheDocument();
    expect(screen.queryByText(/✦\s*IA/)).toBeNull();
  });

  it("FAQ visible y FAQPage en JSON-LD con las mismas preguntas", async () => {
    const { container } = await renderPage();
    const graph = jsonLd(container)["@graph"];
    const faq = graph.find((n) => n["@type"] === "FAQPage") as {
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
    };
    expect(faq.mainEntity).toHaveLength(6);
    for (const q of faq.mainEntity) {
      expect(screen.getByText(q.name)).toBeInTheDocument();
      expect(screen.getByText(q.acceptedAnswer.text)).toBeInTheDocument();
    }
    expect(graph.some((n) => n["@type"] === "WebApplication")).toBe(true);
  });

  it("comparativa: matriz en escritorio y una fila por formato en móvil", async () => {
    const { container } = await renderPage();
    const section = container.querySelector("section[aria-labelledby='compare-title']") as HTMLElement;
    const srText = (row: HTMLElement) =>
      // Lo que oye un lector de pantalla (la marca visual es aria-hidden).
      Array.from(row.querySelectorAll("td")).map((td) => td.querySelector(".sr-only")?.textContent ?? td.textContent);

    // Escritorio (≥ md): 7 formatos en columnas, una fila por app. Sin
    // columnas de funciones (todas las apps las tenían: no distinguían nada).
    const matrix = within(section).getByTestId("compare-matrix");
    expect(matrix.className).toContain("md:block");
    expect(within(matrix).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(
      ["App", "Formatos", "Cine", "Series", "Anime", "Manga", "Juegos", "Libros", "Cómics"]
    );
    expect(within(matrix).getAllByRole("rowheader").map((h) => h.textContent)).toEqual(
      ["KULTURA", "Letterboxd", "Trakt", "MyAnimeList", "Goodreads", "Backloggd"]
    );
    const row = (name: string) => within(matrix).getByRole("rowheader", { name }).closest("tr") as HTMLElement;
    expect(srText(row("KULTURA"))).toEqual(Array(7).fill("Sí"));
    expect(srText(row("Letterboxd"))).toEqual(["Sí", "No", "No", "No", "No", "No", "No"]);
    expect(srText(row("Goodreads"))).toEqual(["No", "No", "No", "No", "No", "Sí", "No"]);

    // Móvil (< md): traspuesta, tres columnas, una fila por formato.
    const byFormat = within(section).getByTestId("compare-by-format");
    expect(byFormat.className).toContain("md:hidden");
    expect(within(byFormat).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(
      ["Formato", "KULTURA", "App especializada"]
    );
    expect(within(byFormat).getAllByRole("rowheader").map((h) => h.textContent)).toEqual(
      ["Cine", "Series", "Anime", "Manga", "Juegos", "Libros", "Cómics"]
    );
    const fmt = (name: string) => srText(within(byFormat).getByRole("rowheader", { name }).closest("tr") as HTMLElement);
    expect(fmt("Cine")).toEqual(["Sí", "LetterboxdTrakt"]);
    expect(fmt("Libros")).toEqual(["Sí", "Goodreads"]);
    expect(fmt("Juegos")).toEqual(["Sí", "Backloggd"]);
    expect(fmt("Cómics")).toEqual(["Sí", "Ninguna de estas"]);
  });

  it("contiene Header y Footer", async () => {
    await renderPage();
    expect(screen.getByTestId("mock-header")).toBeInTheDocument();
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
  });
});

describe("Landing · portadas reales", () => {
  beforeEach(() => {
    demo.email = "demo@example.com";
    showcase.fans = undefined;
  });

  it("features y 'así funciona' con portadas; decorativas (alt vacío)", async () => {
    showcase.items = showcaseItems();
    const { container } = await renderPage();
    const imgs = Array.from(container.querySelectorAll("img"));
    // Features: estantería 4 + recomendación 1 + amigos 2 + lista 3.
    expect(imgs.filter((img) => img.closest("article")).length).toBe(10);
    // Así funciona: búsqueda 3 + ficha 1 + lista 3.
    const how = container.querySelector("section[aria-labelledby='how-title']") as HTMLElement;
    expect(how.querySelectorAll("img").length).toBe(7);
    expect(imgs.every((img) => img.getAttribute("alt") === "")).toBe(true);
  });

  it("sin portadas se sigue renderizando (respaldo de gradientes, cero imágenes)", async () => {
    showcase.items = [];
    const { container } = await renderPage();
    expect(container.querySelectorAll("img").length).toBe(0);
    expect(screen.getByText("Lo que hay dentro.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  // DIS-4: una portada apaisada (captura de RAWG) no se recorta a carátula.
  it("las piezas sin carátula del abanico de rankings caen a gradiente", async () => {
    showcase.items = [];
    const year = new Date().getFullYear();
    showcase.fans = { game: [null, null, null] };
    const { container } = await renderPage();
    const card = container.querySelector(`a[href="/best/game/${year}"]`) as HTMLElement;
    expect(card.querySelectorAll("img").length).toBe(0);
  });
});

describe("Landing · metadatos (D-11, SEO-6)", () => {
  it("title y OG con la promesa del h1; tarjeta grande de X; og completo", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "es" }) });
    expect(meta.title).toEqual({
      absolute: "KULTURA — Tu watchlist de cine, series, anime, manga, juegos, libros y cómics",
    });
    expect(meta.description).toBe(
      "Apunta lo que quieres ver, leer y jugar, puntúa lo que ya viste y compártelo con tus amigos. Gratis y sin anuncios."
    );
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.openGraph).toMatchObject({
      siteName: "KULTURA",
      type: "website",
      locale: "es_ES",
      url: expect.stringMatching(/\/es$/),
      title: "KULTURA — Tu watchlist de cine, series, anime, manga, juegos, libros y cómics",
    });
  });

  it("en inglés, en inglés", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta.title).toEqual({
      absolute: "KULTURA — Your watchlist for movies, TV, anime, manga, games, books and comics",
    });
    expect(meta.openGraph).toMatchObject({ locale: "en_US" });
  });
});
