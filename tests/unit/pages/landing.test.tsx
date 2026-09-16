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
        "features.aiBadge": "Para ti",
      },
    };
    return (key: string) => messages[namespace]?.[key] ?? key;
  }),
}));

// E-LANDING-SHOWCASE: la landing pide portadas reales al catálogo. En test se
// inyectan (o se vacían, para comprobar el respaldo de gradientes).
const { getLandingShowcase } = vi.hoisted(() => ({
  getLandingShowcase: vi.fn(),
}));

vi.mock("@/lib/landing/showcase", () => ({
  getLandingShowcase,
  LANDING_SHOWCASE_SIZE: 10,
  LANDING_SHOWCASE_MIN: 4,
}));

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
function showcase(n = 10): ShowcaseItem[] {
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
    vi.mocked(getLandingShowcase).mockResolvedValue(showcase());
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
  it("pinta portadas del catálogo en el hero y en las features", async () => {
    vi.mocked(getLandingShowcase).mockResolvedValue(showcase());
    const PageResolved = await HomePage();
    const { container } = render(PageResolved);

    const imgs = Array.from(container.querySelectorAll("img"));
    // 3 del collage + 4 de la tira móvil + 3 biblioteca + 3 listas + 1 IA.
    expect(imgs.length).toBe(14);
    expect(imgs.every((img) => img.getAttribute("src")?.includes("image.tmdb.org"))).toBe(true);
    // Decorativas: alt vacío para no dictar 14 títulos a un lector de pantalla.
    expect(imgs.every((img) => img.getAttribute("alt") === "")).toBe(true);
    // El pill de la card de IA lleva texto real, nunca un % de match inventado.
    expect(screen.getByText("Para ti")).toBeInTheDocument();
  });

  it("sin portadas se sigue renderizando (respaldo de gradientes, cero imágenes)", async () => {
    vi.mocked(getLandingShowcase).mockResolvedValue([]);
    const PageResolved = await HomePage();
    const { container } = render(PageResolved);

    expect(container.querySelectorAll("img").length).toBe(0);
    // El contenido de la landing no depende de las portadas.
    expect(screen.getByText("Todo lo que necesitas")).toBeInTheDocument();
    expect(screen.getByText("7 formatos culturales")).toBeInTheDocument();
  });

  it("con muestra corta, el hero cae a gradientes pero no rompe", async () => {
    vi.mocked(getLandingShowcase).mockResolvedValue(showcase(2));
    const PageResolved = await HomePage();
    const { container } = render(PageResolved);

    // 2 portadas no llenan ni el collage (3) ni la tira móvil (4) ni ninguna
    // ilustración de feature (3/3/1 tras el reparto) → gradientes en todo.
    expect(container.querySelectorAll("img").length).toBe(0);
    expect(screen.getByText("Biblioteca personal")).toBeInTheDocument();
  });
});
