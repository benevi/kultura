// ============================================================
// KULTURA — SearchResults component unit tests
// ============================================================

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SearchResults } from "@/lib/api/search";
import type { MediaItem } from "@/types/media";
import { DEFAULT_SEARCH_FILTERS } from "@/components/search/SearchFilters";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: vi.fn((namespace: string) => {
    const translations: Record<string, Record<string, string>> = {
      search: {
        all: "Todos",
        noResults: "Sin resultados para",
        placeholder: "Buscar...",
        title: "Buscar",
        resultsFor: "Resultados para",
        searching: "Buscando...",
        filters: "Filtros",
        sortBy: "Ordenar",
        sortRelevance: "Relevancia",
        sortAZ: "A → Z",
        sortZA: "Z → A",
        sortRatingDesc: "Mejor puntuación",
        sortRatingAsc: "Peor puntuación",
        sortYearDesc: "Más recientes",
        sortYearAsc: "Más antiguos",
        minRating: "Puntuación mínima",
        decade: "Década",
        decadeClassic: "Clásicos",
        decade80s: "80s",
        decade90s: "90s",
        decade00s: "00s",
        decade10s: "10s",
        decade20s: "2020+",
        genres: "Géneros",
        clearFilters: "Limpiar filtros",
        randomize: "Sorpréndeme",
        randomizeAgain: "Otra vez",
        showingRandom: "1 resultado aleatorio de {count}",
      },
      media: {
        movie: "Película",
        movies: "Películas",
        tv: "Serie",
        tvs: "Series",
        anime: "Anime",
        animes: "Animes",
        book: "Libro",
        books: "Libros",
        comic: "Cómic",
        comics: "Cómics",
        manga: "Manga",
        mangas: "Mangas",
        game: "Videojuego",
        games: "Videojuegos",
      },
    };
    return (key: string) => translations[namespace]?.[key] ?? key;
  }),
}));

vi.mock("@/components/media/MediaGrid", () => ({
  MediaGrid: ({
    items,
    showType,
  }: {
    items: MediaItem[];
    showType?: boolean;
  }) => (
    <div data-testid="media-grid" data-show-type={showType}>
      {items.map((item) => (
        <div key={item.id} data-testid="grid-item">
          {item.title}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/search/SearchFilters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/search/SearchFilters")>();
  return {
    ...actual,
    SearchFilters: () => <div data-testid="search-filters" />,
  };
});

import { SearchResults as SearchResultsComponent } from "@/components/search/SearchResults";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeMovie = (n: number): MediaItem => ({
  id: `movie_${n}`,
  externalId: String(n),
  type: "movie",
  title: `Movie ${n}`,
  year: 2000 + n,
});

const makeAnime = (n: number): MediaItem => ({
  id: `anime_${n}`,
  externalId: String(n),
  type: "anime",
  title: `Anime ${n}`,
  year: 2000 + n,
});

const emptyResults: SearchResults = {
  movies: [],
  tv: [],
  anime: [],
  manga: [],
  books: [],
  games: [],
};

const defaultProps = {
  filters: DEFAULT_SEARCH_FILTERS,
  onFiltersChange: vi.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SearchResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tab 'Todos' siempre está presente", () => {
    render(
      <SearchResultsComponent
        results={emptyResults}
        activeType="all"
        query="test"
        onTypeChange={vi.fn()}
        {...defaultProps}
      />
    );
    expect(screen.getByText("Todos")).toBeInTheDocument();
  });

  it("solo muestra tabs de tipos que tienen resultados", () => {
    const results: SearchResults = {
      ...emptyResults,
      movies: [makeMovie(1)],
    };
    render(
      <SearchResultsComponent
        results={results}
        activeType="all"
        query="test"
        onTypeChange={vi.fn()}
        {...defaultProps}
      />
    );
    expect(screen.getByText("Películas")).toBeInTheDocument();
    expect(screen.queryByText("Series")).not.toBeInTheDocument();
    expect(screen.queryByText("Animes")).not.toBeInTheDocument();
  });

  it("muestra tabs de todos los tipos con resultados", () => {
    const results: SearchResults = {
      ...emptyResults,
      movies: [makeMovie(1)],
      anime: [makeAnime(1)],
    };
    render(
      <SearchResultsComponent
        results={results}
        activeType="all"
        query="test"
        onTypeChange={vi.fn()}
        {...defaultProps}
      />
    );
    expect(screen.getByText("Películas")).toBeInTheDocument();
    expect(screen.getByText("Animes")).toBeInTheDocument();
    expect(screen.queryByText("Series")).not.toBeInTheDocument();
  });

  it("sin resultados muestra mensaje de no resultados", () => {
    render(
      <SearchResultsComponent
        results={emptyResults}
        activeType="all"
        query="xyzzy"
        onTypeChange={vi.fn()}
        {...defaultProps}
      />
    );
    expect(screen.getByText(/Sin resultados para/)).toBeInTheDocument();
    expect(screen.getByText(/xyzzy/)).toBeInTheDocument();
  });

  it("onTypeChange se llama al hacer click en un tab", () => {
    const onTypeChange = vi.fn();
    const results: SearchResults = {
      ...emptyResults,
      movies: [makeMovie(1), makeMovie(2)],
    };
    render(
      <SearchResultsComponent
        results={results}
        activeType="all"
        query="test"
        onTypeChange={onTypeChange}
        {...defaultProps}
      />
    );
    fireEvent.click(screen.getByText("Películas"));
    expect(onTypeChange).toHaveBeenCalledWith("movie");
  });

  it("onTypeChange se llama con 'all' al hacer click en tab Todos", () => {
    const onTypeChange = vi.fn();
    const results: SearchResults = {
      ...emptyResults,
      movies: [makeMovie(1)],
    };
    render(
      <SearchResultsComponent
        results={results}
        activeType="movie"
        query="test"
        onTypeChange={onTypeChange}
        {...defaultProps}
      />
    );
    fireEvent.click(screen.getByText("Todos"));
    expect(onTypeChange).toHaveBeenCalledWith("all");
  });

  it("activeType='all' muestra todos los items concatenados", () => {
    const results: SearchResults = {
      ...emptyResults,
      movies: [makeMovie(1)],
      anime: [makeAnime(1)],
    };
    render(
      <SearchResultsComponent
        results={results}
        activeType="all"
        query="test"
        onTypeChange={vi.fn()}
        {...defaultProps}
      />
    );
    expect(screen.getByTestId("media-grid")).toBeInTheDocument();
    expect(screen.getByText("Movie 1")).toBeInTheDocument();
    expect(screen.getByText("Anime 1")).toBeInTheDocument();
  });

  it("activeType='movie' muestra solo películas", () => {
    const results: SearchResults = {
      ...emptyResults,
      movies: [makeMovie(1)],
      anime: [makeAnime(1)],
    };
    render(
      <SearchResultsComponent
        results={results}
        activeType="movie"
        query="test"
        onTypeChange={vi.fn()}
        {...defaultProps}
      />
    );
    expect(screen.getByText("Movie 1")).toBeInTheDocument();
    expect(screen.queryByText("Anime 1")).not.toBeInTheDocument();
  });

  it("tab activo tiene clase border-accent", () => {
    const results: SearchResults = {
      ...emptyResults,
      movies: [makeMovie(1)],
    };
    render(
      <SearchResultsComponent
        results={results}
        activeType="all"
        query="test"
        onTypeChange={vi.fn()}
        {...defaultProps}
      />
    );
    const allTab = screen.getByText("Todos").closest("button");
    expect(allTab?.className).toContain("border-accent");
  });

  it("muestra el recuento de resultados en los tabs", () => {
    const results: SearchResults = {
      ...emptyResults,
      movies: [makeMovie(1), makeMovie(2)],
    };
    render(
      <SearchResultsComponent
        results={results}
        activeType="all"
        query="test"
        onTypeChange={vi.fn()}
        {...defaultProps}
      />
    );
    // Both "Todos" and "Películas" tabs show (2) — use getAllByText
    const counts = screen.getAllByText("(2)");
    expect(counts.length).toBeGreaterThanOrEqual(1);
  });
});
