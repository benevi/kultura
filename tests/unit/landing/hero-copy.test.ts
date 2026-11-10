// ============================================================
// KULTURA — Copia del hero (D-11) y reglas de la galería de fondo
// ============================================================

import { describe, it, expect, vi } from "vitest";

import es from "../../../messages/es.json";
import en from "../../../messages/en.json";
import {
  IMMERSIVE_FORMATS,
  IMMERSIVE_PRELOAD,
  SCENE_MEDIA,
  activeFormatAt,
  formatColor,
  parseTitle,
  plainTitle,
  sceneAllowed,
  FORMAT_FROM,
  FINAL_FROM,
} from "@/lib/landing/immersive";
import { contrastRatio, toSrgb } from "@/lib/design/color";
import { FORMAT_HEX } from "@/lib/og/brand";

describe("copia confirmada de D-11", () => {
  it("h1, subtítulo y botones en español, literales", () => {
    expect(plainTitle(es.landing.hero.title)).toBe(
      "Tu watchlist de cine, series, anime, manga, juegos, libros y cómics"
    );
    expect(es.landing.hero.sub).toBe(
      "Apunta lo que quieres ver, leer y jugar, puntúa lo que ya viste y compártelo con tus amigos. Gratis y sin anuncios."
    );
    expect(es.landing.hero.cta).toBe("Crear cuenta");
    expect(es.landing.hero.demo).toBe("Ver la demo");
  });

  it("h1 y botones en inglés, literales", () => {
    expect(plainTitle(en.landing.hero.title)).toBe(
      "Your watchlist for movies, TV, anime, manga, games, books and comics"
    );
    expect(en.landing.hero.cta).toBe("Create account");
  });

  it("la misma promesa en <title> y en la descripción", () => {
    for (const m of [es, en]) {
      expect(m.landing.seo.title).toBe(`KULTURA — ${plainTitle(m.landing.hero.title)}`);
      expect(m.landing.seo.description).toBe(m.landing.hero.sub);
    }
  });

  it("los siete formatos están marcados en el titular, en los dos idiomas", () => {
    for (const m of [es, en]) {
      const types = parseTitle(m.landing.hero.title)
        .filter((p): p is Exclude<typeof p, string> => typeof p !== "string")
        .map((p) => p.type);
      expect(types).toEqual(IMMERSIVE_FORMATS);
    }
  });

  it("parseTitle conserva el texto entre etiquetas", () => {
    expect(parseTitle("A <movie>b</movie>, c <book>d</book>")).toEqual([
      "A ",
      { type: "movie", text: "b" },
      ", c ",
      { type: "book", text: "d" },
    ]);
  });
});

describe("formato iluminado en el titular", () => {
  it("solo durante el tramo de formatos", () => {
    expect(activeFormatAt(0)).toBeNull();
    expect(activeFormatAt(FORMAT_FROM)).toBe("movie");
    expect(activeFormatAt(FINAL_FROM)).toBeNull();
    expect(activeFormatAt(1)).toBeNull();
  });

  it("el color de cada formato se lee sobre el fondo (≥ 7:1)", () => {
    const bg = toSrgb("oklch(16% 0.015 280)")!;
    for (const f of IMMERSIVE_FORMATS) {
      expect(contrastRatio(toSrgb(formatColor(f))!, bg)).toBeGreaterThanOrEqual(7);
    }
  });
});

describe("¿galería WebGL? (REN-4, MOV-13, D-11)", () => {
  const ok = { reducedMotion: false, width: 1440, saveData: false, deviceMemory: 8, cores: 8 };
  it("escritorio capaz: sí", () => {
    expect(sceneAllowed(ok)).toBe(true);
    // Safari/Firefox no exponen deviceMemory: no cuenta como gama baja.
    expect(sceneAllowed({ ...ok, deviceMemory: undefined })).toBe(true);
  });
  it("no con reducir movimiento, en móvil, con ahorro de datos o en gama baja", () => {
    expect(sceneAllowed({ ...ok, reducedMotion: true })).toBe(false);
    expect(sceneAllowed({ ...ok, width: 767 })).toBe(false);
    expect(sceneAllowed({ ...ok, saveData: true })).toBe(false);
    expect(sceneAllowed({ ...ok, deviceMemory: 4 })).toBe(false);
    expect(sceneAllowed({ ...ok, cores: 4 })).toBe(false);
  });
  it("las precargas son como mucho 4 y solo donde habrá galería", () => {
    expect(IMMERSIVE_PRELOAD).toBeLessThanOrEqual(4);
    expect(SCENE_MEDIA).toContain("min-width: 768px");
    expect(SCENE_MEDIA).toContain("prefers-reduced-motion: no-preference");
  });
});

describe("tarjeta de compartir (OG)", () => {
  it("cada formato tiene su color hex derivado del OKLCH del hero", () => {
    for (const f of IMMERSIVE_FORMATS) expect(FORMAT_HEX[f]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
