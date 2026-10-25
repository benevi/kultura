// ============================================================
// KULTURA — Tarjeta de compartir del sitio con Next 15 (F-20)
//
// Next 15 resuelve `generateImageMetadata` de `[locale]/opengraph-image.tsx`
// con los metadatos de CADA página del segmento, en una capa donde
// `next-intl/server` lanza "getTranslations is not supported in Client
// Components". Ese error rompía el render de todas las páginas con sesión
// (el job de accesibilidad no podía abrir ningún diálogo). Lo que se protege:
//   - `generateImageMetadata` no depende de `next-intl/server`;
//   - el `alt` sigue traducido (SEO-6);
//   - sin fuentes cargadas la tarjeta usa la fuente por defecto.
// ============================================================

// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

vi.mock("next-intl/server", () => ({
  getTranslations: () => {
    throw new Error("`getTranslations` is not supported in Client Components.");
  },
}));
vi.mock("next/og", () => ({ ImageResponse: class {} }));

import { generateImageMetadata, size, contentType } from "@/app/[locale]/opengraph-image";
import { fontsOption } from "@/lib/og/brand";

describe("generateImageMetadata de la tarjeta del sitio", () => {
  it("no usa next-intl/server y da el alt en español", async () => {
    const [card] = await generateImageMetadata({ params: Promise.resolve({ locale: "es" }) });
    expect(card).toEqual({ id: "card", alt: es.landing.seo.title, size, contentType });
  });

  it("alt en inglés (params como objeto, como en Next 15)", async () => {
    const [card] = await generateImageMetadata({ params: { locale: "en" } });
    expect(card.alt).toBe(en.landing.seo.title);
    expect(card.alt).not.toBe(es.landing.seo.title);
  });
});

describe("fontsOption", () => {
  it("sin fuentes cargadas omite la opción (fuente por defecto)", () => {
    expect(fontsOption([])).toEqual({});
  });

  it("con fuentes, las pasa tal cual", () => {
    const font = { name: "Figtree", data: new ArrayBuffer(1), weight: 700 as const, style: "normal" as const };
    expect(fontsOption([font])).toEqual({ fonts: [font] });
  });
});
