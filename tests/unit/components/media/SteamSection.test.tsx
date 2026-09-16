// ============================================================
// KULTURA — SteamSection (E-GAMES-STEAM)
// El bloque de Steam solo aparece cuando hay datos resueltos, y cada sub-bloque
// (descuento, idiomas, capturas) solo si el dato existe: la ficha de un juego
// que no está en Steam no debe mostrar huecos ni etiquetas vacías.
// ============================================================

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { SteamInfo } from "@/lib/api/steam";

vi.mock("next-intl/server", () => ({
  getTranslations: () => Promise.resolve((key: string) => key),
}));

vi.mock("next/image", () => ({
  // `fill`/`sizes` se descartan: son props de next/image que el <img> del mock
  // no entiende y ensuciarían el DOM con atributos desconocidos.
  default: ({
    src,
    alt,
    ...rest
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    sizes?: string;
  }) => {
    delete (rest as { fill?: boolean }).fill;
    delete (rest as { sizes?: string }).sizes;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img src={src} alt={alt} {...rest} />;
  },
}));

import { SteamSection } from "@/components/media/SteamSection";

const FULL: SteamInfo = {
  appId: 1145360,
  storeUrl: "https://store.steampowered.com/app/1145360/",
  isFree: false,
  price: "12,49€",
  priceOriginal: "24,99€",
  discountPercent: 50,
  supportedLanguages: ["English", "Spanish - Spain", "Japanese"],
  screenshots: [
    { thumb: "https://cdn.cloudflare.steamstatic.com/t1.jpg", full: "https://cdn.cloudflare.steamstatic.com/f1.jpg" },
    { thumb: "https://cdn.cloudflare.steamstatic.com/t2.jpg", full: "https://cdn.cloudflare.steamstatic.com/f2.jpg" },
  ],
  metacritic: 93,
};

async function renderSection(steam: SteamInfo) {
  render(await SteamSection({ steam }));
}

describe("SteamSection", () => {
  it("pinta precio, precio original, descuento y metacritic", async () => {
    await renderSection(FULL);
    expect(screen.getByText("12,49€")).toBeInTheDocument();
    expect(screen.getByText("24,99€")).toBeInTheDocument();
    expect(screen.getByText("−50%")).toBeInTheDocument();
    expect(screen.getByText("93")).toBeInTheDocument();
  });

  it("enlaza a la tienda con rel seguro y target _blank", async () => {
    await renderSection(FULL);
    const link = screen.getByRole("link", { name: "steamViewOnStore" });
    expect(link).toHaveAttribute("href", FULL.storeUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("lista los idiomas soportados", async () => {
    await renderSection(FULL);
    expect(screen.getByText("Spanish - Spain")).toBeInTheDocument();
    expect(screen.getByText("Japanese")).toBeInTheDocument();
  });

  it("pinta las capturas (decorativas, alt vacío) enlazando a la versión grande", async () => {
    const { container } = render(await SteamSection({ steam: FULL }));
    const shots = container.querySelectorAll("img");
    expect(shots).toHaveLength(2);
    // alt="" a propósito: son decorativas, el enlace ya lleva el texto.
    expect(shots[0]).toHaveAttribute("alt", "");
    expect(shots[0]).toHaveAttribute("src", FULL.screenshots![0].thumb);
    expect(shots[0].closest("a")).toHaveAttribute(
      "href",
      FULL.screenshots![0].full
    );
  });

  it("juego gratuito → etiqueta de gratis, sin precio", async () => {
    await renderSection({
      appId: 1,
      storeUrl: "https://store.steampowered.com/app/1/",
      isFree: true,
    });
    expect(screen.getByText("steamFree")).toBeInTheDocument();
  });

  it("sin precio ni descuento → texto de precio no disponible y ningún porcentaje", async () => {
    await renderSection({
      appId: 2,
      storeUrl: "https://store.steampowered.com/app/2/",
      isFree: false,
    });
    expect(screen.getByText("steamNoPrice")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("sin idiomas ni capturas → no pinta esos encabezados (nada de huecos vacíos)", async () => {
    await renderSection({
      appId: 3,
      storeUrl: "https://store.steampowered.com/app/3/",
      isFree: false,
      price: "9,99€",
    });
    expect(screen.queryByText("steamLanguages")).not.toBeInTheDocument();
    expect(screen.queryByText("steamScreenshots")).not.toBeInTheDocument();
    expect(screen.queryByText("Metacritic")).not.toBeInTheDocument();
  });

  it("la grid de capturas es mobile-first (2 columnas, 4 en md)", async () => {
    await renderSection(FULL);
    const list = screen.getByRole("list");
    expect(list.className).toContain("grid-cols-2");
    expect(list.className).toContain("md:grid-cols-4");
  });
});
