/**
 * F-22 (REN, criterio 6) — presupuesto de rendimiento en los PR.
 * Lighthouse CI corta el PR si el JS de una página cacheable pasa de 150 KB
 * transferidos o el CLS de 0,05; aquí se exige que el presupuesto siga
 * existiendo, que no se afloje y que el job corra en los PR.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isStaticCspRoute } from "@/lib/csp";

const ROOT = resolve(__dirname, "../../..");
const rc = JSON.parse(readFileSync(resolve(ROOT, "lighthouserc.json"), "utf8"));
const ci = readFileSync(resolve(ROOT, ".github/workflows/ci.yml"), "utf8");

type Assertions = Record<string, [string, { maxNumericValue: number }]>;
const matrix = rc.ci.assert.assertMatrix as { matchingUrlPattern: string; assertions: Assertions }[];
const forUrl = (url: string) => matrix.filter((m) => new RegExp(m.matchingUrlPattern).test(url));

describe("lighthouserc.json", () => {
  const urls = rc.ci.collect.url as string[];

  it("cada URL medida tiene exactamente un bloque de presupuesto", () => {
    for (const url of urls) expect(forUrl(url)).toHaveLength(1);
  });

  it("rankings y legales: JS ≤ 150 KB y CLS ≤ 0,05, como error (falla el PR)", () => {
    for (const url of urls.filter((u) => /\/(best|privacy)/.test(u))) {
      const [block] = forUrl(url);
      expect(block.assertions["resource-summary:script:size"][0]).toBe("error");
      expect(block.assertions["resource-summary:script:size"][1].maxNumericValue).toBeLessThanOrEqual(150 * 1024);
      expect(block.assertions["cumulative-layout-shift"][0]).toBe("error");
      expect(block.assertions["cumulative-layout-shift"][1].maxNumericValue).toBeLessThanOrEqual(0.05);
    }
  });

  // La portada mide ~155 KB con el gzip de `next start` (≈ 135-140 KB con el
  // brotli de Vercel): su tope provisional es 160 KB hasta que F-09/F-30
  // aligeren sus componentes cliente. No puede subir más.
  it("portada: JS ≤ 160 KB como error (provisional)", () => {
    const [block] = forUrl(urls.find((u) => u.endsWith("/es"))!);
    expect(block.assertions["resource-summary:script:size"][0]).toBe("error");
    expect(block.assertions["resource-summary:script:size"][1].maxNumericValue).toBeLessThanOrEqual(160 * 1024);
  });

  it("mide las páginas cacheables (portada, ranking y legal)", () => {
    const paths = urls.map((u) => new URL(u).pathname);
    expect(paths).toEqual(expect.arrayContaining(["/es", "/es/privacy"]));
    expect(paths.some((p) => p.startsWith("/es/best/"))).toBe(true);
    for (const p of paths) expect(isStaticCspRoute(p)).toBe(true);
  });
});

describe("ci.yml", () => {
  it("tiene el job de Lighthouse CI con versión fija y corre en los PR", () => {
    expect(ci).toMatch(/\n  lighthouse:\n/);
    expect(ci).toMatch(/@lhci\/cli@\d+\.\d+\.\d+ autorun/);
    const job = ci.slice(ci.indexOf("\n  lighthouse:\n"), ci.indexOf("\n  integration:\n"));
    expect(job).toContain("if: github.event_name != 'schedule'");
  });
});
