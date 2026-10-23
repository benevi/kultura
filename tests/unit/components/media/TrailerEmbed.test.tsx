import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

import { TrailerEmbed } from "@/components/media/TrailerEmbed";

// Ficha pública sin banner de cookies: nada de YouTube hasta que se pide.
describe("TrailerEmbed (fachada)", () => {
  it("al cargar no hay iframe: solo miniatura y botón para reproducir", () => {
    render(<TrailerEmbed youtubeKey="dQw4w9WgXcQ" title="Tráiler de Fight Club" />);
    expect(document.querySelector("iframe")).toBeNull();
    const btn = screen.getByRole("button", { name: "trailerPlay" });
    expect(btn).toHaveAccessibleDescription("trailerNotice");
    const img = btn.querySelector("img");
    expect(img).toHaveAttribute("src", "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("al pulsar monta youtube-nocookie en reproducción y le pasa el foco", () => {
    const key = "dQw4w9WgXcQ";
    render(<TrailerEmbed youtubeKey={key} title="Tráiler de Fight Club" />);
    fireEvent.click(screen.getByRole("button", { name: "trailerPlay" }));
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${key}?autoplay=1&rel=0`);
    expect(iframe).toHaveAttribute("title", "Tráiler de Fight Club");
    expect(iframe).toHaveAttribute("allowfullscreen");
    expect(document.activeElement).toBe(iframe);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("nunca enlaza a youtube.com (pone cookies)", () => {
    const { container } = render(<TrailerEmbed youtubeKey="abc123xyz00" title="x" />);
    fireEvent.click(screen.getByRole("button"));
    expect(container.innerHTML).not.toContain("www.youtube.com");
  });

  it("un id que no es de YouTube no se pinta", () => {
    const { container } = render(<TrailerEmbed youtubeKey={'x"><script>'} title="x" />);
    expect(container.innerHTML).toBe("");
  });
});
