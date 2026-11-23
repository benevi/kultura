/**
 * @vitest-environment node
 *
 * Fase 8.5 · F4: la vertical que llena la sala, con tope de 1,25× su tamaño
 * natural (biblia §2). `src/styles/sala/poster.css` es exactamente lo que
 * genera `salaPosterCss()`; para regenerarla, este test con `-u`.
 */
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { salaPosterFill, salaPosterSizes, salaPosterSource } from "@/lib/design/sala-poster";
import { salaPosterCss } from "@/lib/design/sala-poster-css";

const ROOT = resolve(__dirname, "../../..");

it("poster.css coincide con salaPosterCss()", async () => {
  await expect(salaPosterCss()).toMatchFileSnapshot(resolve(ROOT, "src/styles/sala/poster.css"));
});

describe("salaPosterFill", () => {
  it("llena hasta el mayor paso que no pasa de 1,25× el ancho natural", () => {
    // AniList, la grande: 460 × 1,25 = 575 → hasta 480 px de ventana.
    expect(salaPosterFill(460)).toBe("480");
    expect(salaPosterFill(512)).toBe("640");
    expect(salaPosterFill(1000)).toBe("1024");
    expect(salaPosterFill(1300)).toBe("1536");
  });
  it("demasiado pequeña para cualquier móvil: libro siempre", () => {
    expect(salaPosterFill(230)).toBe("none");
  });
  it("sin ancho conocido: llena, y el cliente lo comprueba al cargar", () => {
    expect(salaPosterFill(null)).toBe("all");
  });
});

describe("salaPosterSource", () => {
  it("AniList: la grande (carpeta /cover/large/, 460 px), no la de las tarjetas", () => {
    expect(
      salaPosterSource("https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx199-sWefXJvXkDOb.jpg")
    ).toEqual({ src: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx199-sWefXJvXkDOb.jpg", width: 460 });
    expect(salaPosterSource("https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.png").width).toBe(460);
  });
  it("AniList con otra ruta: tal cual, con el ancho de la pequeña", () => {
    expect(salaPosterSource("https://s4.anilist.co/file/otra/bx1.png")).toEqual({
      src: "https://s4.anilist.co/file/otra/bx1.png",
      width: 230,
    });
  });
  it("TMDB y el resto: tal cual, sin ancho conocido", () => {
    expect(salaPosterSource("https://image.tmdb.org/t/p/w500/p.jpg")).toEqual({
      src: "https://image.tmdb.org/t/p/w500/p.jpg",
      width: null,
    });
    expect(salaPosterSource("/relativa.jpg").width).toBeNull();
  });
});

describe("salaPosterSizes", () => {
  it("a todo el ancho mientras llena; luego, la portada de libro", () => {
    expect(salaPosterSizes("480")).toBe("(max-width: 480px) 100vw, 22rem");
    expect(salaPosterSizes("all")).toBe("100vw");
    expect(salaPosterSizes("none")).toBe("22rem");
  });
});

describe("poster.css", () => {
  const css = salaPosterCss();
  it("libro siempre con `none` y, con un paso, solo por encima de él", () => {
    expect(css).toMatch(/^\.sala-stage\[data-sala-fill="none"\] \{/m);
    expect(css).toContain('@media (min-width: 480.02px) {\n  .sala-stage[data-sala-fill="480"] {');
    expect(css).not.toContain('[data-sala-fill="all"]');
  });
  it("en libro: la portada entera, sin velo, y el título con la tinta del campo", () => {
    expect(css).toContain("object-fit: contain;");
    expect(css).toContain(".sala-stage-veil {\n  display: none;");
    expect(css).toContain("color: var(--sala-band-ink);");
  });
});
