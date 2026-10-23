// F-15 · `lang` de la sinopsis cuando no está en el idioma de la página (WCAG 3.1.2).
import { describe, it, expect } from "vitest";
import { synopsisLang } from "@/lib/media/synopsis-lang";

const EN = "Several hundred years ago, humans were nearly exterminated by titans and the survivors live behind walls.";
const ES = "Hace cientos de años, los humanos fueron casi exterminados por los titanes y los supervivientes viven tras unos muros.";

describe("synopsisLang", () => {
  it("inglés en /es → 'en'", () => {
    expect(synopsisLang(EN, "es")).toBe("en");
  });
  it("español en /en → 'es'", () => {
    expect(synopsisLang(ES, "en")).toBe("es");
  });
  it("mismo idioma que la página → sin lang", () => {
    expect(synopsisLang(EN, "en")).toBeUndefined();
    expect(synopsisLang(ES, "es")).toBeUndefined();
  });
  it("sin certeza (japonés, vacío) → sin lang (no se afirma lo que no se sabe)", () => {
    expect(synopsisLang("進撃の巨人", "es")).toBeUndefined();
    expect(synopsisLang("", "es")).toBeUndefined();
    expect(synopsisLang(undefined, "es")).toBeUndefined();
  });
});
