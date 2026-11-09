import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/library/FinishPrompt", () => ({ FinishPrompt: () => null }));
vi.mock("@/components/library/useProgressLabel", () => ({ useProgressLabel: () => () => "etiqueta" }));
vi.mock("@/components/library/useProgressAdvance", () => ({
  useProgressAdvance: ({ progress, status }: { progress: unknown; status: string }) => ({
    progress,
    status,
    busy: false,
    advance: vi.fn(),
    announcement: null,
    finish: null,
    completing: false,
    finishError: null,
    complete: vi.fn(),
    dismissFinish: vi.fn(),
  }),
}));

import { Parte, type ParteItem } from "@/v2/home/Parte";

const item = (over: Partial<ParteItem>): ParteItem => ({
  mediaId: "manga_1",
  title: "Obra",
  poster: null,
  type: "manga",
  status: "in_progress",
  progress: { chapter: 31, total: 240 },
  ...over,
});

describe("Parte de Inicio", () => {
  it("cada obra es un h2 con enlace a su ficha, y la primera en curso va grande", () => {
    render(
      <Parte
        fullProgress
        items={[item({ title: "Primera", mediaId: "tv_9_x", type: "tv", progress: { season: 1, episode: 4 } }), item({ title: "Segunda" })]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Primera" }).closest("li")).toHaveClass("k2h-entry--lead");
    expect(screen.getByRole("heading", { level: 2, name: "Segunda" }).closest("li")).not.toHaveClass("k2h-entry--lead");
    // El id de la ficha conserva lo que va tras el primer guion bajo.
    expect(screen.getByRole("link", { name: "Primera" })).toHaveAttribute("href", "/media/tv/9_x");
  });

  it("con total hay barra; sin total no, porque una vacía diría 0 % de algo que no se sabe", () => {
    render(
      <Parte
        fullProgress
        items={[item({ mediaId: "manga_1" }), item({ mediaId: "anime_2", type: "anime", progress: { episode: 7 } })]}
      />,
    );
    const fills = screen.getAllByTestId("progress-fill");
    expect(fills).toHaveLength(1);
    expect(fills[0]).toHaveStyle({ width: "12%" });
  });

  it("una obra acabada no ofrece +1 y su barra está llena", () => {
    render(<Parte fullProgress items={[item({ status: "completed" })]} />);
    expect(screen.queryByTestId("progress-next")).not.toBeInTheDocument();
    expect(screen.getByTestId("progress-fill")).toHaveStyle({ width: "100%" });
  });

  it("sin nada en curso no hay obra principal", () => {
    render(<Parte fullProgress items={[item({ status: "pending", title: "Sin empezar", progress: null })]} />);
    expect(screen.getByRole("heading", { name: "Sin empezar" }).closest("li")).not.toHaveClass("k2h-entry--lead");
  });

  it("una película no tiene +1 y, si es la principal, ofrece la ficha", () => {
    render(<Parte fullProgress items={[item({ type: "movie", mediaId: "movie_5", progress: null })]} />);
    expect(screen.queryByTestId("progress-next")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "open" })).toHaveAttribute("href", "/media/movie/5");
  });

  it("sin la bandera de progreso, un manga no ofrece +1 ni barra", () => {
    render(<Parte fullProgress={false} items={[item({})]} />);
    expect(screen.queryByTestId("progress-next")).not.toBeInTheDocument();
    expect(screen.queryByTestId("progress-fill")).not.toBeInTheDocument();
  });

  it("si la portada no carga, queda el título sobre el color del formato", () => {
    const { container } = render(<Parte fullProgress items={[item({ poster: "https://image.tmdb.org/t/p/w500/x.jpg" })]} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/w780/");
    fireEvent.error(img as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".k2h-cover--plain")).toHaveTextContent("Obra");
  });

  it("el botón de avanzar no queda dentro de un enlace", () => {
    render(<Parte fullProgress items={[item({})]} />);
    expect(screen.getByTestId("progress-next").closest("a")).toBeNull();
  });
});
