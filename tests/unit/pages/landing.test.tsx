import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AlbumCromo } from "@/lib/landing/album";
import type { BestItem } from "@/lib/best/best-of";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

// next-intl con los mensajes REALES (es/en): así el test comprueba la copia
// tal cual está en `messages/` y no un texto inventado aquí.
const { intl } = vi.hoisted(() => ({ intl: { locale: "es" as "es" | "en" } }));

function lookup(messages: Record<string, unknown>, ns: string, key: string): unknown {
  return [ns, ...key.split(".")].reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
    messages
  );
}

function translator(ns: string, loc: "es" | "en") {
  const messages = (loc === "en" ? en : es) as unknown as Record<string, unknown>;
  const t = (key: string, vars?: Record<string, string | number>) => {
    const raw = lookup(messages, ns, key);
    if (typeof raw !== "string") return `${ns}.${key}`;
    return raw.replace(/\{(\w+)(?:, number, ::\.0)?\}/g, (_, v: string) => String(vars?.[v] ?? `{${v}}`));
  };
  t.raw = (key: string) => lookup(messages, ns, key);
  return t;
}

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => intl.locale),
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg: string | { locale: string; namespace: string }) => {
    const ns = typeof arg === "string" ? arg : arg.namespace;
    const loc = (typeof arg === "string" ? intl.locale : arg.locale) as "es" | "en";
    return translator(ns, loc);
  }),
}));
vi.mock("server-only", () => ({}));

const { demo } = vi.hoisted(() => ({ demo: { email: "demo@example.com" as string | undefined } }));
vi.mock("@/lib/env.server", () => ({
  env: new Proxy({}, { get: (_t, prop) => (prop === "DEMO_USER_EMAIL" ? demo.email : undefined) }),
}));

// Los huecos con datos son Server Components ASÍNCRONOS dentro de <Suspense>,
// y react-dom no sabe renderizarlos en jsdom. Se mockean por sus versiones
// síncronas y el test inyecta ahí las portadas.
const { data } = vi.hoisted(() => ({
  data: { best: [] as AlbumCromo[], missing: [] as AlbumCromo[], tops: {} as Record<string, BestItem[]> },
}));

vi.mock("@/components/landing/ShowcaseSlots", async () => {
  const { BestPage } = await import("@/components/landing/BestPage");
  const { MissingPage } = await import("@/components/landing/MissingPage");
  const { LandingCromo } = await import("@/components/landing/LandingCromo");
  const { Ritual } = await import("@/components/landing/Ritual");
  const { FormatSections } = await import("@/components/landing/FormatSections");
  const { RankingChecklist } = await import("@/components/landing/RankingChecklist");
  type P<T extends (...a: never[]) => unknown> = Parameters<T>[0];
  return {
    BestPageSlot: ({ locale: _l, year: _y, ...props }: { locale: string; year: number } & P<typeof BestPage>) => (
      <BestPage {...props} items={data.best} />
    ),
    MissingPageSlot: ({
      locale: _l,
      year: _y,
      pendingLabel,
      ...props
    }: { locale: string; year: number; pendingLabel: (n: number) => string } & P<typeof MissingPage>) => (
      <MissingPage
        {...props}
        items={data.missing.map((it) => ({ ...it, foil: false }))}
        cromos={data.missing.map((it) => (
          <LandingCromo key={it.id} title={it.title} seed={it.id} poster={it.poster} sizes="100px" />
        ))}
        pending={data.missing.map((_, i) => pendingLabel(props.startNumber + i))}
      />
    ),
    RitualSlot: (props: P<typeof Ritual>) => <Ritual {...props} covers={data.missing} />,
    FormatSectionsSlot: ({ locale: _l, ...props }: { locale: string } & P<typeof FormatSections>) => (
      <FormatSections {...props} covers={data.missing} />
    ),
    RankingChecklistSlot: (props: P<typeof RankingChecklist>) => <RankingChecklist {...props} tops={data.tops} />,
  };
});

// REN-9: la portada no usa el `Link` de next-intl (enlaces `<a>` con el
// idioma); si alguien lo vuelve a importar, este doble hace fallar el test.
vi.mock("@/i18n/navigation", () => {
  throw new Error("la portada no debe importar @/i18n/navigation (REN-9)");
});

vi.mock("@/components/layout/Header", () => ({
  Header: () => <header data-testid="mock-header" />,
}));

vi.mock("@/components/layout/Footer", () => ({
  Footer: () => <footer data-testid="mock-footer" />,
}));

import HomePage, { generateMetadata } from "@/app/[locale]/page";

const TYPES = ["movie", "tv", "anime", "book", "manga", "game", "comic"] as const;

function cromos(prefix: string, n: number): AlbumCromo[] {
  return Array.from({ length: n }, (_, i) => {
    const type = TYPES[i % TYPES.length];
    return {
      id: `${type}_${prefix}${i}`,
      title: `${prefix} ${i}`,
      type,
      poster: `https://image.tmdb.org/t/p/w500/${prefix}-${i}.jpg`,
      path: `/media/${type}/${prefix}${i}`,
    };
  });
}

async function renderPage(locale: "es" | "en" = "es") {
  intl.locale = locale;
  return render(await HomePage({ params: Promise.resolve({ locale }) }));
}

function jsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script?.innerHTML ?? "{}") as { "@graph": Array<Record<string, unknown>> };
}

const year = new Date().getFullYear();

beforeEach(() => {
  data.best = cromos("Mejor", 8);
  data.missing = cromos("Falta", 8);
  data.tops = {
    movie: [{ id: "movie_1", type: "movie", title: "Peli uno", poster: "https://image.tmdb.org/t/p/w500/p.jpg", rating: 8.7, genres: [] }],
  };
  demo.email = "demo@example.com";
});

describe("Portada · el álbum abierto (primera pantalla)", () => {
  it("un solo h1, el titular del contrato", async () => {
    await renderPage();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Todo lo que ves, lees y juegas, en un álbum que llenas tú.");
  });

  it("la primera pantalla es papel del álbum: banda cian y pliego de dos páginas", async () => {
    const { container } = await renderPage();
    expect(container.firstElementChild?.className).toContain("theme-paper");
    const hero = container.querySelector("section#hero") as HTMLElement;
    expect(hero.querySelector("[data-album-page='cyan'] h1")).not.toBeNull();
    const spread = within(hero).getByRole("region", { name: "El álbum abierto" });
    expect(spread.querySelector("[data-spread]")).not.toBeNull();
  });

  it("la única acción rosa, «Ver la demo» y el buscador están en la solapa, sin esperar a nada", async () => {
    data.best = [];
    data.missing = [];
    const { container } = await renderPage();
    const hero = container.querySelector("section#hero") as HTMLElement;
    const cta = within(hero).getByRole("link", { name: "Crear mi cuenta gratis" });
    expect(cta).toHaveAttribute("href", "/es/login?mode=register");
    expect(cta.className).toContain("bg-accent-pink");
    expect(hero.querySelectorAll(".bg-accent-pink")).toHaveLength(1);
    expect(within(hero).getByRole("button", { name: "Ver la demo" })).toBeInTheDocument();
    expect(within(hero).getByRole("search")).toBeInTheDocument();
    expect(within(hero).getByLabelText("Busca lo que te falta")).toHaveAttribute("type", "search");
  });

  it("página izquierda: «Lo mejor de {año}» con huecos llenos de portadas reales que enlazan a su ficha", async () => {
    await renderPage();
    const list = screen.getByRole("list", { name: `Lo mejor de ${year}` });
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(links[0]).toHaveAttribute("href", `/es${data.best[0].path}`);
    expect(links[0]).toHaveAccessibleName("Mejor 0");
    expect(list.querySelectorAll("img")).toHaveLength(8);
    // La primera portada es la del LCP: sin carga diferida.
    expect(list.querySelector("img")).toHaveAttribute("loading", "eager");
  });

  it("página derecha: «Te faltan», huecos numerados con el título impreso y el sobre cerrado", async () => {
    const { container } = await renderPage();
    const list = screen.getByRole("list", { name: "Te faltan" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(8);
    expect(items[0]).toHaveTextContent("9");
    expect(items[0]).toHaveTextContent("Hueco 9, te falta: Falta 0");
    // Primer pintado: ningún hueco lleno (los llena el sobre o el respaldo quieto).
    expect(list.querySelectorAll("[data-cromo]")).toHaveLength(0);
    expect(container.querySelector("svg[data-sobre]")?.hasAttribute("data-torn")).toBe(false);
  });

  it("sin datos, las dos páginas siguen ahí con sus huecos vacíos", async () => {
    data.best = [];
    data.missing = [];
    const { container } = await renderPage();
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByRole("list", { name: `Lo mejor de ${year}` }).querySelectorAll("[data-slot]")).toHaveLength(8);
    expect(screen.getByRole("heading", { name: "Te faltan" })).toBeInTheDocument();
  });

  it("en inglés, el mismo álbum traducido", async () => {
    await renderPage("en");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Everything you watch, read and play, in an album you fill in."
    );
    expect(screen.getAllByRole("link", { name: "Create my free account" }).length).toBeGreaterThanOrEqual(1);
  });

  it("sin cuenta demo configurada no hay botón de demo ni pregunta sobre ella", async () => {
    demo.email = undefined;
    await renderPage();
    expect(screen.queryByRole("button", { name: "Ver la demo" })).toBeNull();
    expect(screen.queryByText("¿Puedo verla por dentro antes de crear la cuenta?")).toBeNull();
  });

  it("la única región viva es el estado del buscador", async () => {
    const { container } = await renderPage();
    expect(container.querySelectorAll("[aria-live]")).toHaveLength(0);
    expect(container.querySelectorAll("[role='status']")).toHaveLength(1);
  });
});

describe("Portada · bajo la primera pantalla", () => {
  it("orden: álbum, ritual, secciones, rankings, comparativa, lo que hay detrás, FAQ y cierre", async () => {
    await renderPage();
    const h2 = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2).toEqual([
      `Lo mejor de ${year}`,
      "Te faltan",
      "Así se llena el álbum",
      "Siete secciones, un solo álbum",
      `Los rankings de ${year}`,
      "La alternativa a Letterboxd, Trakt y MyAnimeList",
      "Lo que hay detrás",
      "Preguntas frecuentes",
      "Tu álbum empieza por el primer hueco.",
    ]);
  });

  it("el ritual va con los estados reales del álbum: pendiente, en curso y completado", async () => {
    const { container } = await renderPage();
    const ritual = container.querySelector("[aria-labelledby='ritual-title']") as HTMLElement;
    expect(ritual.getAttribute("data-album-page")).toBe("yellow");
    expect(within(ritual).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Búscalo",
      "Apúntalo en su hueco",
      "Pégalo al terminar",
      "Comparte tu página",
    ]);
    expect(ritual.querySelector("[data-status='pending']")).not.toBeNull();
    expect(ritual.querySelector("[data-cromo][data-state='placed'] [data-progress-strip]")).not.toBeNull();
    expect(ritual.querySelector("[data-status='completed']")).not.toBeNull();
  });

  it("siete secciones, cada color de formato junto a su nombre", async () => {
    const { container } = await renderPage();
    const sections = container.querySelector("[aria-labelledby='sections-title']") as HTMLElement;
    const rows = Array.from(sections.querySelectorAll("li[data-format]"));
    expect(rows.map((r) => r.getAttribute("data-format"))).toEqual(["movie", "tv", "anime", "manga", "game", "book", "comic"]);
    expect(within(sections).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Cine",
      "Series",
      "Anime",
      "Manga",
      "Juegos",
      "Libros",
      "Cómics",
    ]);
    expect(within(sections).getByText("Horas jugadas")).toBeInTheDocument();
  });

  // SEO-9: los cuatro rankings del año y todos los anteriores (≥ 12 enlaces).
  it("enlaza a los rankings de todos los años publicados", async () => {
    const { container } = await renderPage();
    for (const f of ["anime", "movie", "tv", "game"]) {
      for (let y = 2024; y <= year; y++) {
        expect(container.querySelector(`a[href="/es/best/${f}/${y}"]`)).not.toBeNull();
      }
    }
    expect(screen.getByRole("link", { name: "Las mejores películas de 2024" })).toBeInTheDocument();
  });

  it("la página de control: puesto, título enlazado a su ficha y la nota del proveedor en formato español", async () => {
    const { container } = await renderPage();
    const rankings = container.querySelector("[aria-labelledby='rankings-title']") as HTMLElement;
    const link = within(rankings).getByRole("link", { name: "Peli uno" });
    expect(link).toHaveAttribute("href", "/es/media/movie/1");
    const row = link.closest("li") as HTMLElement;
    expect(row).toHaveTextContent("8,7");
    expect(within(row).getByText("nota 8,7 de 10")).toHaveClass("sr-only");
  });

  it("lo que hay detrás: gratis sin plan de pago, criterio, proveedores y el creador con su nombre", async () => {
    const { container } = await renderPage();
    const trust = container.querySelector("[aria-labelledby='trust-title']") as HTMLElement;
    expect(within(trust).getByRole("heading", { name: "Gratis, sin anuncios, sin plan de pago" })).toBeInTheDocument();
    expect(trust).toHaveTextContent("TMDB");
    expect(trust).toHaveTextContent("AniList");
    expect(trust).toHaveTextContent("RAWG");
    expect(trust).toHaveTextContent("Open Library");
    expect(trust).toHaveTextContent("Víctor Franco");
    expect(within(trust).getByRole("link", { name: "Ver los rankings" })).toHaveAttribute("href", "/es/best");
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
    const section = container.querySelector("[aria-labelledby='compare-title']") as HTMLElement;
    const srText = (row: HTMLElement) =>
      Array.from(row.querySelectorAll("td")).map((td) => td.querySelector(".sr-only")?.textContent ?? td.textContent);

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

    const byFormat = within(section).getByTestId("compare-by-format");
    expect(byFormat.className).toContain("md:hidden");
    expect(within(byFormat).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(
      ["Formato", "KULTURA", "App especializada"]
    );
    const fmt = (name: string) => srText(within(byFormat).getByRole("rowheader", { name }).closest("tr") as HTMLElement);
    expect(fmt("Cine")).toEqual(["Sí", "LetterboxdTrakt"]);
    expect(fmt("Cómics")).toEqual(["Sí", "Ninguna de estas"]);
  });

  it("el cierre repite la acción rosa y la demo", async () => {
    const { container } = await renderPage();
    const final = container.querySelector("[aria-labelledby='final-title']") as HTMLElement;
    expect(within(final).getByRole("link", { name: "Crear mi cuenta gratis" })).toHaveAttribute("href", "/es/login?mode=register");
    expect(within(final).getByRole("button", { name: "Ver la demo" })).toBeInTheDocument();
  });

  it("contiene Header y Footer", async () => {
    await renderPage();
    expect(screen.getByTestId("mock-header")).toBeInTheDocument();
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
  });

  it("nada de sombras en reposo, degradados de adorno ni transition-all", async () => {
    const { container } = await renderPage();
    const html = container.innerHTML;
    expect(html).not.toMatch(/shadow-(hard|sticker)|transition-all/);
    const gradients = Array.from(container.querySelectorAll<HTMLElement>("[style*='gradient']"));
    expect(gradients.every((el) => el.hasAttribute("data-placeholder"))).toBe(true);
  });
});

describe("Portada · metadatos (D-11, SEO-6)", () => {
  it("title y OG con la promesa de la portada; tarjeta grande de X; og completo", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "es" }) });
    expect(meta.title).toEqual({ absolute: es.landing.seo.title });
    expect(meta.description).toBe(es.landing.hero.sub);
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.openGraph).toMatchObject({
      siteName: "KULTURA",
      type: "website",
      locale: "es_ES",
      url: expect.stringMatching(/\/es$/),
      title: es.landing.seo.title,
    });
  });

  it("en inglés, en inglés", async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(meta.title).toEqual({ absolute: en.landing.seo.title });
    expect(meta.openGraph).toMatchObject({ locale: "en_US" });
  });
});
