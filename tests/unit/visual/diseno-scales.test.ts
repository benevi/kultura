/**
 * @vitest-environment node
 *
 * F-30 · Criterio DIS (3): `DISENO.md` = código también en los sets cerrados.
 * Las tablas de escala tipográfica, radios y sombras del documento tienen
 * que ser exactamente las de `tailwind.config.ts` (nombre y valor), y el
 * documento enlaza la guía de voz (`VOZ.md`, de F-31).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import config from "../../../tailwind.config";

const ROOT = resolve(__dirname, "../../..");
const DOC = readFileSync(resolve(ROOT, "DISENO.md"), "utf8");

/** Filas `| `clase` | valor | …` entre `<!-- name:inicio -->` y `<!-- name:fin -->`. */
function table(name: string): Array<[string[], string]> {
  const block = new RegExp(`<!-- ${name}:inicio -->([\\s\\S]*?)<!-- ${name}:fin -->`).exec(DOC)?.[1] ?? "";
  return block
    .split("\n")
    .filter((l) => /^\|\s*`/.test(l))
    .map((l) => {
      const cells = l.split("|").slice(1, -1).map((c) => c.trim());
      const classes = Array.from(cells[0].matchAll(/`([^`]+)`/g), (m) => m[1]);
      return [classes, cells[1].replace(/`/g, "")];
    });
}

describe("DISENO.md describe los sets cerrados del config", () => {
  it("escala tipográfica: mismas clases, mismo orden y mismos tamaños", () => {
    const sizes = config.theme!.fontSize as Record<string, [string, { lineHeight: string }]>;
    const rows = table("escala");
    expect(rows.map(([[cls]]) => cls)).toEqual(Object.keys(sizes).map((k) => `text-${k}`));
    for (const [[cls], size] of rows) {
      expect(size.replace(/\s/g, "")).toBe(sizes[cls.slice(5)][0].replace(/\s/g, ""));
    }
  });

  it("radios: cada valor del set está documentado con su clase", () => {
    const radii = config.theme!.borderRadius as Record<string, string>;
    const documented = new Map(table("radios").flatMap(([classes, value]) => classes.map((c) => [c, value] as const)));
    const canonical = ["lg", "2xl", "bento", "bento-xl", "full", "pill", "button"];
    for (const key of canonical) expect(documented.get(`rounded-${key}`)).toBe(radii[key]);
    expect(documented.size).toBe(canonical.length);
  });

  it("sombras: las cuatro del config, con el mismo valor", () => {
    const shadows = config.theme!.boxShadow as Record<string, string>;
    const rows = table("sombras");
    expect(rows.map(([[cls]]) => cls).sort()).toEqual(
      Object.keys(shadows).filter((k) => k !== "none").map((k) => `shadow-${k}`).sort()
    );
    for (const [[cls], value] of rows) expect(value).toBe(shadows[cls.slice(7)]);
  });

  it("documenta la retícula `page-grid` y la tarjeta de póster única", () => {
    expect(DOC).toMatch(/## Retícula/);
    expect(DOC).toContain("page-grid");
    expect(DOC).toContain("PosterFrame");
  });

  it("enlaza la guía de voz", () => {
    expect(DOC).toMatch(/\[`?VOZ\.md`?\]\(VOZ\.md\)/);
  });

  it("no quedan nombres de radio retirados como si fueran válidos", () => {
    expect(DOC).not.toMatch(/rounded-(18|24|bento-lg)\b/);
  });
});
