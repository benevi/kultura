// ============================================================
// KULTURA — Detección de idioma de sinopsis (E-SINOPSIS-I18N)
//
// Lo que se protege aquí no es la precisión lingüística, es la REGLA DE COSTE:
// un texto ya en el idioma pedido no debe llegar nunca al modelo, y un texto
// que no lo esté (o del que dudemos) sí.
// ============================================================

import { describe, it, expect } from "vitest";
import { detectLanguage, needsTranslation } from "@/lib/translate/language";

describe("detectLanguage", () => {
  it("sinopsis en español → es", () => {
    const text =
      "Un joven cazador de demonios recorre el país en busca de la criatura " +
      "que masacró a su familia, con la esperanza de devolver a su hermana " +
      "su forma humana.";
    expect(detectLanguage(text)).toBe("es");
  });

  it("sinopsis en inglés → en", () => {
    const text =
      "After a demon attack leaves his family slain and his sister cursed, " +
      "a young man sets out on a journey to find a cure and avenge the dead.";
    expect(detectLanguage(text)).toBe("en");
  });

  it("texto sin señal suficiente → unknown (se traducirá por si acaso)", () => {
    expect(detectLanguage("Final Fantasy VII Remake")).toBe("unknown");
  });

  it("texto en otro idioma → unknown, nunca se da por bueno", () => {
    expect(detectLanguage("鬼滅の刃 無限列車編")).toBe("unknown");
  });

  it("entrada vacía o ausente → unknown sin lanzar", () => {
    expect(detectLanguage("")).toBe("unknown");
    expect(detectLanguage(null)).toBe("unknown");
    expect(detectLanguage(undefined)).toBe("unknown");
  });

  it("la ortografía española decide en textos cortos sin artículos", () => {
    expect(detectLanguage("Misión cumplida, compañero")).toBe("es");
  });

  it("ignora el marcado HTML que sirven algunos proveedores", () => {
    const text =
      "<p>The player takes control of a lone survivor and must explore " +
      "the ruins of a city that was destroyed by an unknown force.</p>";
    expect(detectLanguage(text)).toBe("en");
  });
});

describe("needsTranslation", () => {
  it("el idioma detectado coincide con el pedido → no se traduce (coste 0)", () => {
    const es = "La historia de una familia que pierde todo en una noche.";
    expect(needsTranslation(es, "es")).toBe(false);
  });

  it("el idioma detectado difiere → se traduce", () => {
    const en = "The story of a family that loses everything in one night.";
    expect(needsTranslation(en, "es")).toBe(true);
  });

  it("ante la duda se traduce: el usuario pidió verlo en su idioma", () => {
    expect(needsTranslation("鬼滅の刃", "es")).toBe(true);
    expect(needsTranslation("Elden Ring", "en")).toBe(true);
  });

  it("sin texto no hay nada que traducir", () => {
    expect(needsTranslation("", "es")).toBe(false);
    expect(needsTranslation("   ", "es")).toBe(false);
    expect(needsTranslation(null, "en")).toBe(false);
  });
});
