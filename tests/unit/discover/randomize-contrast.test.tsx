// «Sorpréndeme» deshabilitado (sin resultados) se sigue leyendo: el texto
// del botón llega a 4,5:1 sobre su fondo. Con `opacity-60` encima de
// `text-tertiary` sobre `surface-elevated` se quedaba muy por debajo.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { blend, contrastRatio, toSrgb, type Rgb } from "@/lib/design/color";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/search/SearchBar", () => ({ SearchBar: () => null }));
vi.mock("@/components/ui/FilterBar", () => ({ FilterBar: () => null }));
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({}), usePathname: () => "/" }));

import { DiscoverToolbar } from "@/app/[locale]/(app)/discover/DiscoverToolbar";

const CSS = readFileSync(resolve(__dirname, "../../../src/app/globals.css"), "utf8");

function token(name: string): Rgb {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(CSS);
  const rgb = m ? toSrgb(m[1].trim()) : null;
  if (!rgb) throw new Error(`token --${name} no encontrado`);
  return rgb;
}

/** Color efectivo del texto y del fondo del botón según sus clases. */
function effectiveContrast(className: string): number {
  const text = /\btext-text-(primary|secondary|tertiary)\b/.exec(className)?.[1];
  const bg = /\bbg-surface-(default|elevated)\b/.exec(className)?.[1];
  if (!text || !bg) throw new Error(`clases de color no reconocidas: ${className}`);
  const page = token("surface-base");
  const opacity = /\bopacity-(\d+)\b/.exec(className);
  const alpha = opacity ? Number(opacity[1]) / 100 : 1;
  // La opacidad funde botón y texto con la barra (fondo de página).
  const bgRgb = blend(token(`surface-${bg}`), page, alpha);
  const fgRgb = blend(token(`text-${text}`), page, alpha);
  return contrastRatio(fgRgb, bgRgb);
}

function renderToolbar(canRandomize: boolean) {
  render(
    <DiscoverToolbar
      type="all"
      query=""
      isSearching={false}
      canRandomize={canRandomize}
      filterGroups={[]}
      activeFilters={{}}
      onSearch={() => {}}
      onClearSearch={() => {}}
      onRandom={() => {}}
      onTypeChange={() => {}}
      onFilterChange={() => {}}
    />
  );
  return screen.getByRole("button", { name: "randomize" });
}

describe("Sorpréndeme: contraste", () => {
  it("deshabilitado: ≥ 4,5:1 y sin opacidad que lo apague", () => {
    const button = renderToolbar(false);
    expect(button).toBeDisabled();
    expect(button.className).not.toMatch(/\bopacity-\d+\b/);
    expect(effectiveContrast(button.className)).toBeGreaterThanOrEqual(4.5);
  });

  it("habilitado: ≥ 4,5:1", () => {
    const button = renderToolbar(true);
    expect(button).toBeEnabled();
    expect(effectiveContrast(button.className)).toBeGreaterThanOrEqual(4.5);
  });
});
