/**
 * @vitest-environment node
 *
 * F-30 · Contraste de las pastillas de estado de la biblioteca (pendiente de
 * F-08): `bg-accent-info/20` con texto azul sobre la tarjeta elevada daba
 * ~3-3,9:1 y el rojo ~4,3:1 (< 4,5:1 de WCAG 1.4.3). Se calcula aquí el
 * contraste real de cada pastilla (relleno al 20 % sobre las dos superficies
 * donde aparece) a partir de las clases de `LibraryAction.tsx`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { blend, contrastRatio, toSrgb, type Rgb } from "@/lib/design/color";
import { ROOT, resolveToken } from "../design/css-tokens";

const rgb = (token: string): Rgb => toSrgb(resolveToken(token))!;
/** Clase de texto → token (los rojos de texto van al rojo accesible, ACC-4). */
const TEXT: Record<string, string> = {
  "text-text-primary": "--text-primary",
  "text-accent-positive": "--accent-positive",
  "text-accent-highlight": "--accent-highlight",
  "text-accent-info": "--accent-info",
  "text-accent-danger": "--accent-danger-text",
};

const code = readFileSync(resolve(ROOT, "src/components/library/LibraryAction.tsx"), "utf8");
const block = /const statusClasses[^{]*\{([\s\S]*?)\n\}/.exec(code)![1];
const pills = Array.from(block.matchAll(/(\w+): '(bg-accent-(\w+)\/(\d+)) (text-[\w-]+)'/g)).map((m) => ({
  status: m[1],
  fill: `--accent-${m[3]}`,
  alpha: Number(m[4]) / 100,
  text: m[5],
}));

describe("pastillas de estado (LibraryAction)", () => {
  it("están las cuatro", () => {
    expect(pills.map((p) => p.status).sort()).toEqual(["abandoned", "completed", "in_progress", "pending"]);
  });

  it.each(pills.flatMap((p) => ["--surface-elevated", "--surface-default"].map((bg) => [p.status, bg, p] as const)))(
    "%s sobre %s: texto ≥ 4,5:1",
    (_s, surface, pill) => {
      const bg = blend(rgb(pill.fill), rgb(surface), pill.alpha);
      expect(contrastRatio(rgb(TEXT[pill.text]), bg)).toBeGreaterThanOrEqual(4.5);
    }
  );
});
