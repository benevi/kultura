// ============================================================
// KULTURA — El buscador de la solapa de la portada funciona de verdad:
// /api/search, resultados como cromos, «Guardar» al alta con vuelta a la ficha.
// ============================================================

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlapSearch, type FlapSearchLabels } from "@/components/landing/FlapSearch";

const labels: FlapSearchLabels = {
  label: "Busca lo que te falta",
  placeholder: "Una peli…",
  submit: "Buscar",
  formats: "Dónde buscar",
  family: { all: "Cine y series", anime: "Anime", manga: "Manga", book: "Libros", game: "Juegos" },
  loading: "Buscando…",
  results: "Resultados de «{q}»",
  empty: "No encuentro nada con «{q}».",
  error: "La búsqueda no responde.",
  save: "Guardar",
  format: { movie: "Película", tv: "Serie", anime: "Anime", manga: "Manga", game: "Videojuego", book: "Libro", comic: "Cómic" },
};

const results = [
  { id: "movie_438631", externalId: "438631", type: "movie", title: "Dune", poster: "https://image.tmdb.org/t/p/w500/d.jpg" },
  { id: "tv_1", externalId: "1", type: "tv", title: "Sin portada" },
];

function search(q: string) {
  fireEvent.change(screen.getByLabelText("Busca lo que te falta"), { target: { value: q } });
  fireEvent.submit(screen.getByRole("search"));
}

describe("FlapSearch", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(results), { status: 200 }));
  });

  it("pide a /api/search con el idioma y enseña los resultados como cromos", async () => {
    render(<FlapSearch locale="es" labels={labels} />);
    search("dune");
    expect(global.fetch).toHaveBeenCalledWith("/api/search?q=dune&locale=es", expect.anything());
    expect(await screen.findByText("Resultados de «dune»")).toBeInTheDocument();
    const list = screen.getByRole("list");
    // Solo los que tienen portada (ningún cromo sin portada).
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByRole("link", { name: "Dune" })).toHaveAttribute("href", "/es/media/movie/438631");
    expect(list.querySelector(".cromo [aria-hidden='true']")?.getAttribute("style")).toContain("linear-gradient");
    expect(within(list).getByText("Película")).toBeInTheDocument();
  });

  it("«Guardar» lleva a crear la cuenta y vuelve a la ficha", async () => {
    render(<FlapSearch locale="en" labels={labels} />);
    search("dune");
    await screen.findByText("Resultados de «dune»");
    const save = screen.getByRole("link", { name: /^Guardar\s+Dune$/ });
    expect(save).toHaveAttribute("href", `/en/login?mode=register&next=${encodeURIComponent("/en/media/movie/438631")}`);
  });

  it("cada familia busca en la suya; el formato elegido se marca", async () => {
    render(<FlapSearch locale="es" labels={labels} />);
    search("naruto");
    const manga = screen.getByRole("button", { name: "Manga" });
    fireEvent.click(manga);
    expect(manga).toHaveAttribute("aria-pressed", "true");
    expect(global.fetch).toHaveBeenLastCalledWith("/api/search?q=naruto&locale=es&type=manga", expect.anything());
    await screen.findByText("Resultados de «naruto»");
  });

  it("menos de dos letras no busca", () => {
    render(<FlapSearch locale="es" labels={labels} />);
    search("d");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sin resultados y con error lo dice en la región de estado", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    render(<FlapSearch locale="es" labels={labels} />);
    search("zzzz");
    expect(await screen.findByRole("status")).toHaveTextContent("No encuentro nada con «zzzz».");

    global.fetch = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    search("dune");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("La búsqueda no responde."));
  });

  it("sin JavaScript el formulario va a la búsqueda de la app", () => {
    render(<FlapSearch locale="es" labels={labels} />);
    const form = screen.getByRole("search");
    expect(form).toHaveAttribute("action", "/es/search");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByLabelText("Busca lo que te falta")).toHaveAttribute("name", "q");
  });
});
