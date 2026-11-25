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

  // Regresión: AniList manda "LHtdKWJdif4\t" y la ficha se quedaba sin tráiler.
  it("acepta el id con espacios o tabuladores al final y los quita de la URL", () => {
    render(<TrailerEmbed youtubeKey={"LHtdKWJdif4\t"} title="x" />);
    expect(screen.getByRole("button").querySelector("img")).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/LHtdKWJdif4/hqdefault.jpg"
    );
  });

  it("un id que no es de YouTube no se pinta", () => {
    const { container } = render(<TrailerEmbed youtubeKey={'x"><script>'} title="x" />);
    expect(container.innerHTML).toBe("");
  });
});

describe("TrailerEmbed con el vídeo de Steam", () => {
  const steam = {
    trailer: {
      src: "https://video.akamai.steamstatic.com/store_trailers/1/2/a/3/hls_264_master.m3u8",
      poster: "https://shared.akamai.steamstatic.com/ss.jpg",
    },
    storeUrl: "https://store.steampowered.com/app/1145360/",
  };

  it("sin pulsar no hay <video>: póster y aviso de Steam", () => {
    render(<TrailerEmbed steam={steam} title="Tráiler de Hades" />);
    expect(document.querySelector("video")).toBeNull();
    const btn = screen.getByRole("button", { name: "trailerPlay" });
    expect(btn).toHaveAccessibleDescription("steamTrailerNotice");
    expect(btn.querySelector("img")).toHaveAttribute("src", steam.trailer.poster);
  });

  it("al pulsar monta <video> con controles, sin autoplay ni precarga, y le pasa el foco", () => {
    const canPlay = vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("maybe");
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<TrailerEmbed steam={steam} title="Tráiler de Hades" />);
    fireEvent.click(screen.getByRole("button", { name: "trailerPlay" }));
    const video = document.querySelector("video")!;
    expect(video).toHaveAttribute("src", steam.trailer.src);
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("preload", "none");
    expect(video).not.toHaveAttribute("autoplay");
    expect(video).not.toHaveAttribute("muted");
    expect(video).toHaveAttribute("aria-label", "Tráiler de Hades");
    expect(document.activeElement).toBe(video);
    expect(play).toHaveBeenCalledOnce();
    canPlay.mockRestore();
    play.mockRestore();
  });

  it("sin HLS nativo: enlace a la página de Steam", () => {
    const canPlay = vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("");
    render(<TrailerEmbed steam={steam} title="Tráiler de Hades" />);
    fireEvent.click(screen.getByRole("button", { name: "trailerPlay" }));
    expect(document.querySelector("video")).toBeNull();
    expect(screen.getByRole("link", { name: "steamTrailerOpen" })).toHaveAttribute("href", steam.storeUrl);
    canPlay.mockRestore();
  });

  it("YouTube gana a Steam si hay clave", () => {
    render(<TrailerEmbed youtubeKey="dQw4w9WgXcQ" steam={steam} title="t" />);
    expect(screen.getByRole("button")).toHaveAccessibleDescription("trailerNotice");
  });
});
