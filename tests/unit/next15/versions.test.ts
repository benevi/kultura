// ============================================================
// KULTURA — Versiones del framework y auditoría en CI (F-20, COD-4/SEG-4)
//
// Lo que se protege: que nadie vuelva a la rama 14 (sin parches), que React y
// sus tipos vayan a la par, que el SDK de Anthropic no baje de la versión
// corregida y que CI siga parando con una vulnerabilidad alta en producción.
// ============================================================

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const pkg = JSON.parse(read("package.json")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};
const lock = JSON.parse(read("package-lock.json")) as {
  packages: Record<string, { version?: string }>;
};

const installed = (name: string) => lock.packages[`node_modules/${name}`]?.version ?? "";
const parts = (v: string) => v.replace(/^[^\d]*/, "").split(".").map(Number);
const atLeast = (v: string, min: string) => {
  const a = parts(v);
  const b = parts(min);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
};

describe("versiones (D-03)", () => {
  it("Next 15.5 parcheado y eslint-config-next de la misma versión", () => {
    expect(pkg.dependencies.next).toBe("15.5.28");
    expect(installed("next")).toBe("15.5.28");
    expect(pkg.devDependencies["eslint-config-next"]).toBe(pkg.dependencies.next);
  });

  it("React 19 con react-dom y tipos a juego", () => {
    expect(parts(installed("react"))[0]).toBe(19);
    expect(installed("react-dom")).toBe(installed("react"));
    expect(parts(installed("@types/react"))[0]).toBe(19);
    expect(parts(installed("@types/react-dom"))[0]).toBe(19);
  });

  it("next-intl 4.x y @anthropic-ai/sdk ≥ 0.91.1", () => {
    expect(parts(installed("next-intl"))[0]).toBe(4);
    expect(atLeast(installed("@anthropic-ai/sdk"), "0.91.1")).toBe(true);
  });

  it("server-only instalado (lo usa env.server.ts)", () => {
    expect(pkg.dependencies["server-only"]).toBeDefined();
    expect(installed("server-only")).not.toBe("");
  });
});

describe("CI", () => {
  it("audita las dependencias de producción y para con una alta o crítica", () => {
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toMatch(/run:\s*npm audit --omit=dev --audit-level=high\s*$/m);
    // Después de instalar y antes de compilar.
    expect(ci.indexOf("npm audit")).toBeGreaterThan(ci.indexOf("npm ci"));
    expect(ci.indexOf("npm audit")).toBeLessThan(ci.indexOf("npm run build"));
  });
});
