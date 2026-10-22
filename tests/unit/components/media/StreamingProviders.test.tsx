import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StreamingProvider } from "@/types/media";

const { localeRef } = vi.hoisted(() => ({ localeRef: { current: "es" } }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  useLocale: () => localeRef.current,
}));

import { StreamingProviders } from "@/components/media/StreamingProviders";

const flatrateProviders: StreamingProvider[] = [
  { name: "Netflix", logoPath: "https://image.tmdb.org/t/p/original/netflix.png", type: "flatrate" },
  { name: "Disney+", logoPath: "https://image.tmdb.org/t/p/original/disney.png", type: "flatrate" },
];

const rentProviders: StreamingProvider[] = [
  { name: "Amazon Video", logoPath: "https://image.tmdb.org/t/p/original/amazon.png", type: "rent" },
];

const buyProviders: StreamingProvider[] = [
  { name: "Apple TV", logoPath: "https://image.tmdb.org/t/p/original/apple.png", type: "buy" },
];

describe("StreamingProviders", () => {
  it("renderiza los logos de providers flatrate", () => {
    render(<StreamingProviders providers={flatrateProviders} title="Dónde ver" />);
    expect(screen.getByAltText("Netflix")).toBeInTheDocument();
    expect(screen.getByAltText("Disney+")).toBeInTheDocument();
  });

  it("retorna null y no renderiza nada cuando no hay providers", () => {
    const { container } = render(
      <StreamingProviders providers={[]} title="Dónde ver" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("muestra el nombre de cada provider", () => {
    render(<StreamingProviders providers={flatrateProviders} title="Dónde ver" />);
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Disney+")).toBeInTheDocument();
  });

  it("prioriza flatrate sobre rent", () => {
    const mixed: StreamingProvider[] = [...flatrateProviders, ...rentProviders];
    render(<StreamingProviders providers={mixed} title="Dónde ver" />);
    // flatrate se muestra
    expect(screen.getByAltText("Netflix")).toBeInTheDocument();
    // rent NO se muestra cuando hay flatrate
    expect(screen.queryByAltText("Amazon Video")).not.toBeInTheDocument();
  });

  it("muestra rent cuando no hay flatrate", () => {
    render(<StreamingProviders providers={rentProviders} title="Dónde ver" />);
    expect(screen.getByAltText("Amazon Video")).toBeInTheDocument();
  });

  it("muestra buy cuando no hay flatrate ni rent", () => {
    render(<StreamingProviders providers={buyProviders} title="Dónde ver" />);
    expect(screen.getByAltText("Apple TV")).toBeInTheDocument();
  });

  it("elimina duplicados por nombre", () => {
    const withDups: StreamingProvider[] = [
      { name: "Netflix", logoPath: "https://image.tmdb.org/t/p/original/n1.png", type: "flatrate" },
      { name: "Netflix", logoPath: "https://image.tmdb.org/t/p/original/n2.png", type: "flatrate" },
    ];
    render(<StreamingProviders providers={withDups} title="Dónde ver" />);
    const logos = screen.getAllByAltText("Netflix");
    expect(logos).toHaveLength(1);
  });

  it("muestra el título de la sección", () => {
    render(<StreamingProviders providers={flatrateProviders} title="Dónde ver" />);
    expect(screen.getByText("Dónde ver")).toBeInTheDocument();
  });

  // ── PRO-2: atribución a JustWatch (TMDB la exige o retira la clave) ───────

  describe("atribución a JustWatch", () => {
    beforeEach(() => {
      localeRef.current = "es";
    });

    it("siempre cita a JustWatch con su logo y un enlace", () => {
      render(<StreamingProviders providers={flatrateProviders} title="Dónde ver" />);
      expect(screen.getByText("justwatchAttribution")).toBeInTheDocument();
      const logo = screen.getByAltText("JustWatch");
      expect(logo.getAttribute("src")).toContain("justwatch.com");
      const a = logo.closest("a");
      expect(a?.getAttribute("href")).toBe("https://www.justwatch.com/es");
      expect(a?.getAttribute("rel")).toContain("noopener");
      expect(a?.getAttribute("aria-label")).toBe("justwatchLinkLabel");
    });

    it("en inglés enlaza a la oferta de EE. UU. (la misma región que se pide a TMDB)", () => {
      localeRef.current = "en";
      render(<StreamingProviders providers={flatrateProviders} title="Where to watch" />);
      expect(screen.getByAltText("JustWatch").closest("a")?.getAttribute("href")).toBe(
        "https://www.justwatch.com/us"
      );
    });

    it("sin plataformas no se pinta nada (ni la cita)", () => {
      const { container } = render(<StreamingProviders providers={[]} title="x" />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("enlace de cada plataforma a TMDB", () => {
    const link = "https://www.themoviedb.org/movie/550-fight-club/watch?locale=ES";

    it("con `link`, cada logo enlaza a la página 'dónde ver' de TMDB", () => {
      render(<StreamingProviders providers={flatrateProviders} title="x" link={link} />);
      for (const name of ["Netflix", "Disney+"]) {
        const a = screen.getByAltText(name).closest("a");
        expect(a?.getAttribute("href")).toBe(link);
        expect(a?.getAttribute("target")).toBe("_blank");
        expect(a?.getAttribute("aria-label")).toContain(name);
      }
    });

    it("el `url` propio de una plataforma tiene prioridad", () => {
      const own = "https://www.themoviedb.org/tv/1/watch?locale=ES";
      render(
        <StreamingProviders
          providers={[{ ...flatrateProviders[0], url: own }]}
          title="x"
          link={link}
        />
      );
      expect(screen.getByAltText("Netflix").closest("a")?.getAttribute("href")).toBe(own);
    });

    it("un enlace que no es de TMDB (o no es https) no se pinta", () => {
      render(
        <StreamingProviders
          providers={flatrateProviders}
          title="x"
          link="javascript:alert(1)"
        />
      );
      expect(screen.getByAltText("Netflix").closest("a")).toBeNull();
    });

    it("sin enlace, el logo se pinta sin <a>", () => {
      render(<StreamingProviders providers={flatrateProviders} title="x" />);
      expect(screen.getByAltText("Netflix").closest("a")).toBeNull();
    });
  });
});
