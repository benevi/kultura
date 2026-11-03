// ============================================================
// KULTURA — Copia de la portada «Álbum de cromos» (contrato de dirección)
// ============================================================

import { describe, it, expect } from "vitest";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";
import { FORMAT_HEX } from "@/lib/og/brand";
import { IMMERSIVE_FORMATS } from "@/lib/landing/immersive";

type Tree = { [k: string]: string | Tree };
const strings = (t: Tree): string[] => Object.values(t).flatMap((v) => (typeof v === "string" ? [v] : strings(v)));

describe("titular y acciones", () => {
  it("el titular del contrato, literal, en español", () => {
    expect(es.landing.hero.title).toBe("Todo lo que ves, lees y juegas, en un álbum que llenas tú.");
    expect(es.landing.hero.cta).toBe("Crear mi cuenta gratis");
    expect(es.landing.hero.demo).toBe("Ver la demo");
  });

  it("en inglés, traducido", () => {
    expect(en.landing.hero.title).toBe("Everything you watch, read and play, in an album you fill in.");
    expect(en.landing.hero.cta).toBe("Create my free account");
  });

  it("la misma promesa en la descripción y bajo el titular; el título por defecto es el de la portada", () => {
    for (const m of [es, en]) {
      expect(m.landing.seo.description).toBe(m.landing.hero.sub);
      expect(m.meta.defaultTitle).toBe(m.landing.seo.title);
    }
  });

  it("el subtítulo nombra los siete formatos y que es gratis", () => {
    expect(es.landing.hero.sub).toMatch(/cine.*series.*anime.*manga.*videojuegos.*libros.*cómics/i);
    expect(es.landing.hero.sub).toContain("Gratis y sin anuncios");
  });
});

describe("voz", () => {
  it("nunca «sin registro»: se dice «gratis»", () => {
    for (const ns of ["landing", "onboarding", "pwa", "demo", "meta"] as const) {
      for (const s of strings(es[ns] as unknown as Tree)) expect(s.toLowerCase()).not.toMatch(/sin regist/);
    }
  });

  it("sin emoji en los textos de la portada", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const m of [es, en]) for (const s of strings(m.landing as unknown as Tree)) expect(emoji.test(s)).toBe(false);
  });

  it("el creador va con su nombre, sin cifras de usuarios inventadas", () => {
    expect(es.landing.trust.maker.body).toContain("Víctor Franco");
    for (const s of strings(es.landing as unknown as Tree)) expect(s).not.toMatch(/\b(miles|millones) de (usuarios|personas)\b/i);
  });

  it("es y en tienen las mismas claves en los namespaces de la portada", () => {
    const keys = (t: Tree, p = ""): string[] =>
      Object.entries(t).flatMap(([k, v]) => (typeof v === "string" ? [`${p}${k}`] : keys(v, `${p}${k}.`)));
    for (const ns of ["landing", "demo", "pwa", "onboarding", "meta"] as const) {
      expect(keys(en[ns] as unknown as Tree).sort()).toEqual(keys(es[ns] as unknown as Tree).sort());
    }
  });
});

describe("tarjeta de compartir (OG)", () => {
  it("cada formato conserva su color hex", () => {
    for (const f of IMMERSIVE_FORMATS) expect(FORMAT_HEX[f]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
