// ============================================================
// KULTURA — tests del mapeo locale → parámetros de proveedor (E-TMDB-LOCALE)
// ============================================================

import { describe, it, expect } from "vitest";
import {
  resolveApiLocale,
  tmdbLanguage,
  tmdbRegion,
  googleBooksLangRestrict,
  mangaDexLanguages,
  pickLocalizedText,
  DEFAULT_API_LOCALE,
} from "@/lib/api/locale";

describe("resolveApiLocale", () => {
  it("reconoce los locales de la app", () => {
    expect(resolveApiLocale("es")).toBe("es");
    expect(resolveApiLocale("en")).toBe("en");
  });

  it("acepta variantes regionales y mayúsculas", () => {
    expect(resolveApiLocale("es-ES")).toBe("es");
    expect(resolveApiLocale("es-419")).toBe("es");
    expect(resolveApiLocale("EN")).toBe("en");
    expect(resolveApiLocale("en_US")).toBe("en");
  });

  it("cae al default con entrada ausente o desconocida", () => {
    expect(resolveApiLocale(undefined)).toBe(DEFAULT_API_LOCALE);
    expect(resolveApiLocale(null)).toBe(DEFAULT_API_LOCALE);
    expect(resolveApiLocale("")).toBe(DEFAULT_API_LOCALE);
    expect(resolveApiLocale("fr")).toBe(DEFAULT_API_LOCALE);
  });
});

describe("tmdbLanguage", () => {
  it("es → es-ES, en → en-US", () => {
    expect(tmdbLanguage("es")).toBe("es-ES");
    expect(tmdbLanguage("en")).toBe("en-US");
  });

  it("sin locale mantiene es-ES (paridad pre-E-TMDB-LOCALE)", () => {
    expect(tmdbLanguage()).toBe("es-ES");
    expect(tmdbLanguage(null)).toBe("es-ES");
  });
});

describe("tmdbRegion", () => {
  it("mapea el locale a la región de streaming", () => {
    expect(tmdbRegion("es")).toBe("ES");
    expect(tmdbRegion("en")).toBe("US");
    expect(tmdbRegion()).toBe("ES");
  });
});

describe("googleBooksLangRestrict", () => {
  it("devuelve el ISO-639-1 del locale activo", () => {
    expect(googleBooksLangRestrict("es-ES")).toBe("es");
    expect(googleBooksLangRestrict("en")).toBe("en");
    expect(googleBooksLangRestrict(undefined)).toBe("es");
  });
});

describe("mangaDexLanguages", () => {
  it("es pide es + es-la y deja en como red de seguridad", () => {
    expect(mangaDexLanguages("es")).toEqual(["es", "es-la", "en"]);
  });

  it("en pide solo en", () => {
    expect(mangaDexLanguages("en")).toEqual(["en"]);
  });

  it("sin locale usa la cadena española", () => {
    expect(mangaDexLanguages()).toEqual(["es", "es-la", "en"]);
  });
});

describe("pickLocalizedText", () => {
  const dict = { en: "Solo Leveling", es: "Solo Leveling ES", "ja-ro": "Ore dake" };

  it("prefiere el idioma activo", () => {
    expect(pickLocalizedText(dict, "es")).toBe("Solo Leveling ES");
    expect(pickLocalizedText(dict, "en")).toBe("Solo Leveling");
  });

  it("acepta variantes regionales del idioma activo (es-la)", () => {
    expect(pickLocalizedText({ "es-la": "LatAm", en: "EN" }, "es")).toBe("LatAm");
  });

  it("cae a inglés cuando no hay traducción al idioma activo", () => {
    expect(pickLocalizedText({ en: "EN", ja: "JA" }, "es")).toBe("EN");
  });

  it("cae a ja-ro y luego al primer valor disponible", () => {
    expect(pickLocalizedText({ "ja-ro": "Romaji", ja: "日本語" }, "es")).toBe(
      "Romaji"
    );
    expect(pickLocalizedText({ ja: "日本語" }, "es")).toBe("日本語");
  });

  it("ignora valores vacíos y devuelve undefined si no queda nada", () => {
    expect(pickLocalizedText({ es: "   ", en: "" }, "es")).toBeUndefined();
    expect(pickLocalizedText({}, "es")).toBeUndefined();
    expect(pickLocalizedText(undefined, "es")).toBeUndefined();
  });
});
