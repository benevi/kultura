// BestPoster es un componente de SERVIDOR (REN-1): no puede importar el
// componente cliente de `next/image` (≈ 9 KB gzip del presupuesto de JS de /best)
// y debe seguir dando el mismo <img> que `<Image fill>`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const preload = vi.fn();
vi.mock("react-dom", async (orig) => ({ ...(await orig<typeof import("react-dom")>()), preload: (...a: unknown[]) => preload(...a) }));
import { BestPoster } from "@/components/best/BestPoster";

describe("BestPoster", () => {
  it("no es un componente cliente ni importa next/image", () => {
    const src = readFileSync(path.join(process.cwd(), "src/components/best/BestPoster.tsx"), "utf8");
    expect(src).not.toMatch(/["']use client["']/);
    expect(src).not.toMatch(/from ["']next\/image["']/);
  });

  it("pinta el <img> con alt, srcset por cubos, sizes y lazy por defecto", () => {
    const html = renderToStaticMarkup(
      <BestPoster src="https://s4.anilist.co/file/x.png" alt="Título" sizes="(min-width: 768px) 80px, 64px" />,
    );
    expect(html).toContain('alt="Título"');
    expect(html).toContain('sizes="(min-width: 768px) 80px, 64px"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('class="object-cover"');
    expect(html).toMatch(/\/_next\/image\?url=https%3A%2F%2Fs4\.anilist\.co%2Ffile%2Fx\.png&amp;w=256&amp;q=70 256w/);
    expect(html).not.toContain("w=3840");
  });

  it("con priority no es lazy", () => {
    const html = renderToStaticMarkup(<BestPoster src="https://image.tmdb.org/t/p/original/a.jpg" alt="A" sizes="30vw" priority />);
    expect(html).not.toContain('loading="lazy"');
    expect(html).toContain("<img");
    expect(preload).toHaveBeenCalledWith(expect.stringContaining("image.tmdb.org"), expect.objectContaining({ as: "image", imageSizes: "30vw" }));
    expect(html).toContain("position:absolute");
    expect(html).toContain("width:100%");
  });
});
