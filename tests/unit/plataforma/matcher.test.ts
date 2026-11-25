/**
 * Tests unitarios — `matcher` del middleware (cupo de Fluid Active CPU).
 *
 * Las API sin sesión, sin escrituras y sin HTML no pasan por el middleware:
 * `/api/health`, `/api/csp-report`, `/api/discover`, `/api/landing/sources` y
 * `/api/cron/daily`. Todo lo demás (páginas, la API con sesión, sus vecinas de
 * nombre parecido) sigue pasando, con su nonce, su sesión y su idioma.
 *
 * Se compila cada entrada con el path-to-regexp de Next, como en
 * `tests/unit/csp/static-csp.test.ts`.
 */
// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl/middleware", () => ({ default: () => () => null }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({}) }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pathToRegexp } = require("next/dist/compiled/path-to-regexp") as {
  pathToRegexp: (source: string) => RegExp;
};

import { config } from "@/middleware";

const runs = (path: string) => config.matcher.some((m: string) => pathToRegexp(m).test(path));

const SKIPPED = ["health", "csp-report", "discover", "landing/sources", "cron/daily"];

describe("matcher del middleware", () => {
  it.each(SKIPPED.map((p) => `/api/${p}`))("%s no pasa por el middleware", (path) => {
    expect(runs(path)).toBe(false);
  });

  it.each([
    "/",
    "/es",
    "/en/best/movie/2026",
    "/es/media/movie/603",
    "/es/library",
    "/es/u/ana",
    "/api/library",
    "/api/search",
    "/api/account/export",
    "/api/auth/callback",
    "/api/auth/demo",
    "/api/sala-prueba",
    "/api/push/subscribe",
    "/api/groups/discover",
    "/api/discover-x",
    "/api/healthz",
    "/api/landing",
    "/api/cron/otro",
    "/login",
    "/media/movie/603",
  ])("%s sigue pasando por el middleware", (path) => {
    expect(runs(path)).toBe(true);
  });

  it("las dos entradas que excluyen API repiten la misma lista", () => {
    const lists = config.matcher
      .map((m: string) => /\(\?:([a-z/|-]+)\)\(\?:\/\|\$\)/.exec(m)?.[1])
      .filter(Boolean);
    expect(lists).toHaveLength(2);
    for (const list of lists) expect(list!.split("|").sort()).toEqual([...SKIPPED].sort());
  });
});
