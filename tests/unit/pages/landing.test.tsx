import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ShowcaseItem } from "@/lib/landing/showcase";

// next/image no funciona en jsdom → <img> plano (mismo mock que media-card).
vi.mock("next/image", () => ({
  default: (
    props: React.ImgHTMLAttributes<HTMLImageElement> & {
      fill?: boolean;
      priority?: boolean;
      sizes?: string;
    }
  ) => {
    const { fill: _fill, priority: _priority, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

// Mock next-intl server
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "es"),
  getTranslations: vi.fn(async (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      landing: {
        "hero.tagline": "Descubre, registra y comparte tu cultura",
        "hero.cta": "Empieza gratis",
        "hero.badge": "7 formatos culturales",
        "features.title": "Todo lo que necesitas",
        "features.library": "Biblioteca personal",
        "features.libraryDesc": "Registra lo que has visto",
        "features.friends": "Conecta con amigos",
        "features.friendsDesc": "Ve qué están disfrutando",
        "features.lists": "Listas colaborativas",
        "features.listsDesc": "Crea listas con amigos",
        "features.ai": "Recomendaciones IA",
        "features.aiDesc": "Descubre tu próximo favorito",
      },
    };
    return (key: string) => messages[namespace]?.[key] ?? key;
  }),
}));

// E-LANDING-SHOWCASE: los huecos de portadas son Server Components ASÍNCRONOS
// dentro de <Suspense>, y react-dom no sabe renderizarlos en jsdom (mismo caso
// que TranslatedSynopsis en MediaDetail). Se mockean por sus versiones
// síncronas, con el MISMO reparto de la muestra que hacen de verdad, y el test
// inyecta las portadas ahí.
const { showcase } = vi.hoisted(() => ({
  showcase: { items: [] as ShowcaseItem[] },
}));

vi.mock("@/components/landing/ShowcaseSlots", async () => {
  const { HeroCollage, HeroStrip, HERO_COLLAGE_SLOTS } = await import(
    "@/components/landing/HeroCollage"
  );
  return {
    HeroCollageSlot: ({ badge }: { badge: string }) => (
      <HeroCollage items={showcase.items.slice(0, HERO_COLLAGE_SLOTS)} badge={badge} />
    ),
    HeroStripSlot: () => <HeroStrip items={showcase.items} />,
  };
});

// Mock @/i18n/navigation
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock layout components to isolate page under test
vi.mock("@/components/layout/Header", () => ({
  Header: () => <header data-testid="mock-header" />,
}));

vi.mock("@/components/layout/Footer", () => ({
  Footer: () => <footer data-testid="mock-footer" />,
}));

// Mock Button component
vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => {
    if (asChild) return <>{children}</>;
    return <button>{children}</button>;
  },
}));

import HomePage from "@/app/[locale]/page";

/** Muestra de portadas: 10 items, una por familia primero (como pickShowcase). */
function showcaseItems(n = 10): ShowcaseItem[] {
  const types = ["movie", "tv", "anime", "book", "manga", "game", "comic"] as const;
  return Array.from({ length: n }, (_, i) => ({
    id: `${types[i % types.length]}_${i}`,
    title: `Título ${i}`,
    type: types[i % types.length],
    poster: `https://image.tmdb.org/t/p/w500/poster-${i}.jpg`,
  }));
}

describe("Landing page", () => {
  beforeEach(() => {
    showcase.items = showcaseItems();
  });

  it("renderiza sin lanzar errores", async () => {
    const PageResolved = await HomePage();
    expect(() => render(PageResolved)).not.toThrow();
  });

  it("muestra el tagline del hero", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(
      screen.getByText("Descubre, registra y comparte tu cultura")
    ).toBeInTheDocument();
  });

  // E-LANDING-TRIM: la sección "what" era una reformulación del tagline del
  // hero y de las propias features — se eliminó, y sus claves de mensaje con
  // ella. Si vuelve a aparecer, es que se ha reintroducido texto redundante.
  it("ya no renderiza la sección what", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(screen.queryByText("what.title")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Todo tu universo cultural, en un solo lugar")
    ).not.toBeInTheDocument();
  });

  // La landing se quedó en DOS bloques (hero + features) a petición del usuario:
  // el CTA final repetía el "Empieza gratis" que ya está en el hero.
  it("ya no renderiza el CTA final", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(screen.queryByText("cta.title")).not.toBeInTheDocument();
    expect(screen.queryByText("cta.button")).not.toBeInTheDocument();
  });

  it("muestra el título de la sección features", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(screen.getByText("Todo lo que necesitas")).toBeInTheDocument();
  });

  it("contiene el Header mockeado", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(screen.getByTestId("mock-header")).toBeInTheDocument();
  });

  it("contiene el Footer mockeado", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
  });

  // El CTA secundario ("Ver más") era un ancla a #features: con la landing en
  // dos bloques movía la página unos píxeles. Se retiró junto con su clave.
  it("no hay CTA secundario ni ancla a #features", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("#features");
    expect(screen.queryByText("hero.ctaSecondary")).not.toBeInTheDocument();
  });

  it("los botones CTA apuntan a /login?mode=register", async () => {
    const PageResolved = await HomePage();
    render(PageResolved);
    const ctaLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/login?mode=register");
    expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
  });
});

// ── E-LANDING-SHOWCASE: portadas reales ──────────────────────────────────────

describe("Landing · portadas reales", () => {
  it("pinta portadas del catálogo en el hero (collage + tira móvil)", async () => {
    showcase.items = showcaseItems();
    const PageResolved = await HomePage();
    const { container } = render(PageResolved);

    const imgs = Array.from(container.querySelectorAll("img"));
    // 3 del collage de escritorio + 4 de la tira de móvil. Las tarjetas de
    // features ya NO llevan miniaturas (solo icono centrado).
    expect(imgs.length).toBe(7);
    expect(imgs.every((img) => img.getAttribute("src")?.includes("image.tmdb.org"))).toBe(true);
    // Decorativas: alt vacío para no dictar siete títulos a un lector de pantalla.
    expect(imgs.every((img) => img.getAttribute("alt") === "")).toBe(true);
  });

  it("sin portadas se sigue renderizando (respaldo de gradientes, cero imágenes)", async () => {
    showcase.items = [];
    const PageResolved = await HomePage();
    const { container } = render(PageResolved);

    expect(container.querySelectorAll("img").length).toBe(0);
    // El contenido de la landing no depende de las portadas.
    expect(screen.getByText("Todo lo que necesitas")).toBeInTheDocument();
    expect(screen.getByText("7 formatos culturales")).toBeInTheDocument();
  });

  it("con muestra corta, el hero cae a gradientes pero no rompe", async () => {
    showcase.items = showcaseItems(2);
    const PageResolved = await HomePage();
    const { container } = render(PageResolved);

    // 2 portadas no llenan ni el collage (3) ni la tira de móvil (4).
    expect(container.querySelectorAll("img").length).toBe(0);
    expect(screen.getByText("Biblioteca personal")).toBeInTheDocument();
  });
});
