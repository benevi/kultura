import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TrailerEmbed } from "@/components/media/TrailerEmbed";

describe("TrailerEmbed", () => {
  it("renderiza un iframe", () => {
    render(<TrailerEmbed youtubeKey="dQw4w9WgXcQ" title="Rick Astley - Never Gonna Give You Up" />);
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
  });

  it("el src del iframe contiene el youtubeKey", () => {
    const key = "dQw4w9WgXcQ";
    render(<TrailerEmbed youtubeKey={key} title="Test trailer" />);
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute("src", `https://www.youtube.com/embed/${key}`);
  });

  it("el iframe tiene allowFullScreen", () => {
    render(<TrailerEmbed youtubeKey="abc123" title="Full screen test" />);
    const iframe = document.querySelector("iframe");
    // allowFullScreen se serializa como atributo booleano en el DOM
    expect(iframe).toHaveAttribute("allowfullscreen");
  });

  it("el title del iframe coincide con la prop title", () => {
    const title = "Tráiler de Fight Club";
    render(<TrailerEmbed youtubeKey="xyz" title={title} />);
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute("title", title);
  });

  it("usa loading=lazy en el iframe", () => {
    render(<TrailerEmbed youtubeKey="abc" title="Lazy test" />);
    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute("loading", "lazy");
  });
});
