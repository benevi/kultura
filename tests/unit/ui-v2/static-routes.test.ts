// @vitest-environment node
// ============================================================
// F0 · El interruptor `ui_v2` lee `cookies()`, lo que saca una página de la
// caché del CDN. Las rutas cacheables (`STATIC_CSP_ROUTES`, src/lib/csp.ts)
// no pueden usarlo: ninguna de sus carpetas importa `@/lib/ui-v2`.
// Si este test falla, primero hay que rediseñar la caché de esa ruta.
// ============================================================

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isStaticCspRoute } from "@/lib/csp";

const APP = path.join(process.cwd(), "src", "app", "[locale]");

/** Carpetas de las rutas cacheables, con la URL que sirven (para comprobarlas contra csp.ts). */
const STATIC_DIRS: Array<{ dir: string; url: string; recursive: boolean }> = [
  { dir: "", url: "/es", recursive: false },
  { dir: "best", url: "/es/best", recursive: true },
  { dir: "privacy", url: "/es/privacy", recursive: true },
  { dir: "terms", url: "/es/terms", recursive: true },
  { dir: "legal", url: "/es/legal", recursive: true },
  { dir: "accessibility", url: "/es/accessibility", recursive: true },
  { dir: "offline", url: "/es/offline", recursive: true },
];

function sources(dir: string, recursive: boolean): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) out.push(...sources(full, true));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("ui_v2 fuera de las rutas cacheables", () => {
  it("la lista de carpetas corresponde a rutas cacheables de verdad", () => {
    for (const { url } of STATIC_DIRS) expect(isStaticCspRoute(url), url).toBe(true);
    // Control: una ruta con sesión no es cacheable (ahí sí vale el interruptor).
    expect(isStaticCspRoute("/es/lists")).toBe(false);
  });

  it("ninguna página cacheable importa @/lib/ui-v2", () => {
    const offenders = STATIC_DIRS.flatMap(({ dir, recursive }) => sources(path.join(APP, dir), recursive))
      .filter((file) => fs.readFileSync(file, "utf8").includes("@/lib/ui-v2"))
      .map((file) => path.relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });
});
