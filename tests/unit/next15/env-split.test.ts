// ============================================================
// KULTURA — Variables de entorno partidas en pública y servidor (SEG-11)
//
// Lo que se protege:
//   - `env.server.ts` lleva `import "server-only"` (si algo de cliente lo
//     importa, `next build` falla en vez de meter secretos en un chunk);
//   - `env.public.ts` solo expone `NEXT_PUBLIC_*`;
//   - ningún Client Component ni el middleware (Edge) importa `env.server`;
//   - el viejo `@/lib/env` ya no existe ni se importa.
// ============================================================

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { publicEnv } from "@/lib/env.public";

const ROOT = path.resolve(__dirname, "../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(full);
  }
  return out;
}

const sources = [...walk(path.join(ROOT, "src")), path.join(ROOT, "instrumentation.ts")].map((file) => ({
  file: path.relative(ROOT, file),
  code: readFileSync(file, "utf8"),
}));

describe("env partido (SEG-11)", () => {
  it("env.server.ts empieza con import \"server-only\"", () => {
    const code = readFileSync(path.join(ROOT, "src/lib/env.server.ts"), "utf8");
    expect(code.split("\n")[0].trim()).toBe('import "server-only";');
  });

  it("env.public.ts solo expone variables NEXT_PUBLIC_*", () => {
    expect(Object.keys(publicEnv).length).toBeGreaterThan(0);
    for (const key of Object.keys(publicEnv)) expect(key).toMatch(/^NEXT_PUBLIC_/);
    const code = readFileSync(path.join(ROOT, "src/lib/env.public.ts"), "utf8");
    for (const m of code.matchAll(/process\.env\.(\w+)/g)) expect(m[1]).toMatch(/^NEXT_PUBLIC_/);
    expect(code).not.toMatch(/^import "server-only"/m);
  });

  it("ni Client Components ni el middleware importan env.server", () => {
    const offenders = sources
      .filter(({ file, code }) => /^\s*["']use client["']/.test(code) || file === path.join("src", "middleware.ts"))
      .filter(({ code }) => /lib\/env\.server/.test(code))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("el antiguo @/lib/env ya no existe ni se importa", () => {
    expect(existsSync(path.join(ROOT, "src/lib/env.ts"))).toBe(false);
    const offenders = sources
      .filter(({ code }) => /["'](@\/lib\/env|\.\/src\/lib\/env|\.\.?\/env)["']/.test(code))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
