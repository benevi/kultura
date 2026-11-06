// ============================================================
// F0 · Interruptor de UI v2 (`ui_v2`): resolución, /api/ui-v2 y conmutador
// de /lists (PLAN_ESTRATEGICO §7.3)
// ============================================================

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import es from "../../../messages/es.json";

const h = vi.hoisted(() => ({
  user: null as null | { id: string },
  cookie: undefined as string | undefined,
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "ui_v2" && h.cookie !== undefined ? { name, value: h.cookie } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({ redirect: h.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user }, error: null }) } }),
}));
vi.mock("@/lib/social/lists", () => ({
  getUserLists: async () => [
    { id: "l1", ownerId: "u1", name: "Pelis de domingo", mediaType: "movie", isCollaborative: false, isPublic: false, createdAt: "2026-11-01" },
  ],
}));
vi.mock("@/lib/social/lists-shared", () => ({ mixedListsEnabled: () => false }));
vi.mock("@/app/[locale]/(app)/lists/ListsClient", () => ({
  ListsClient: () => <div data-testid="ui-v1" />,
}));
vi.mock("next-intl/server", () => {
  const tree = es as unknown as Record<string, Record<string, string>>;
  return {
    getTranslations: async (ns: string | { namespace: string }) => {
      const name = typeof ns === "string" ? ns : ns.namespace;
      return (key: string) => tree[name]?.[key] ?? key;
    },
    getLocale: async () => "es",
  };
});
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={`/es${href}`} {...rest}>
      {children}
    </a>
  ),
}));

import { resolveUiV2, UI_V2_COOKIE } from "@/lib/ui-v2";
import { GET } from "@/app/api/ui-v2/route";
import ListsPage from "@/app/[locale]/(app)/lists/page";
import { _resetStoreForTests } from "@/lib/rate-limit";
import type { ReactElement } from "react";

/** La página devuelve un Server Component async (la pantalla v2): se resuelve antes de pintar. */
async function page(): Promise<ReactElement> {
  const el = (await ListsPage()) as ReactElement<Record<string, unknown>>;
  if (typeof el.type !== "function") return el;
  // Un componente síncrono se deja a React; uno async devuelve una promesa.
  const out = (el.type as (p: unknown) => unknown)(el.props);
  return out instanceof Promise ? ((await out) as ReactElement) : el;
}

beforeEach(() => {
  h.user = { id: "u1" };
  h.cookie = undefined;
  delete process.env.UI_V2_DEFAULT;
  _resetStoreForTests();
});
afterEach(() => {
  delete process.env.UI_V2_DEFAULT;
});

describe("resolveUiV2", () => {
  it("sin cookie ni variable: vieja", () => {
    expect(resolveUiV2(undefined, undefined)).toBe(false);
  });
  it("UI_V2_DEFAULT=1 activa la nueva para quien no ha elegido", () => {
    expect(resolveUiV2(undefined, "1")).toBe(true);
  });
  it("la cookie manda sobre la variable, en los dos sentidos", () => {
    expect(resolveUiV2("1", undefined)).toBe(true);
    expect(resolveUiV2("0", "1")).toBe(false);
  });
  it("un valor de cookie desconocido no cuenta como elección", () => {
    expect(resolveUiV2("true", undefined)).toBe(false);
    expect(resolveUiV2("yes", "1")).toBe(true);
  });
});

const get = (qs: string) => GET(new NextRequest(`https://k.test/api/ui-v2${qs}`));

describe("GET /api/ui-v2", () => {
  it("v=1 pone la cookie y vuelve a next con 303", async () => {
    const res = await get("?v=1&next=%2Fes%2Flists");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://k.test/es/lists");
    const c = res.cookies.get(UI_V2_COOKIE);
    expect(c?.value).toBe("1");
    expect(c?.httpOnly).toBe(true);
    expect(c?.sameSite).toBe("lax");
    expect(c?.path).toBe("/");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("v=0 deja la cookie en 0 (gana a UI_V2_DEFAULT=1)", async () => {
    const res = await get("?v=0&next=%2Fes%2Flists");
    expect(res.cookies.get(UI_V2_COOKIE)?.value).toBe("0");
  });

  it("next externo o ausente: vuelve a la raíz (sin open redirect)", async () => {
    expect((await get("?v=1&next=https%3A%2F%2Fevil.com")).headers.get("location")).toBe("https://k.test/");
    expect((await get("?v=1&next=%2F%2Fevil.com")).headers.get("location")).toBe("https://k.test/");
    expect((await get("?v=1")).headers.get("location")).toBe("https://k.test/");
  });

  it("v inválido → 400 sin cookie", async () => {
    const res = await get("?v=2");
    expect(res.status).toBe(400);
    expect(res.cookies.get(UI_V2_COOKIE)).toBeUndefined();
  });

  it("next hacia otra ruta de API: vuelve a la raíz", async () => {
    expect((await get("?v=1&next=%2Fapi%2Fui-v2%3Fv%3D0")).headers.get("location")).toBe("https://k.test/");
    expect((await get("?v=1&next=%2Fapi")).headers.get("location")).toBe("https://k.test/");
  });

  it("sin sesión → al login con la página como next, sin cookie", async () => {
    h.user = null;
    const res = await get("?v=1&next=%2Fen%2Flists");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://k.test/en/login?next=%2Fen%2Flists");
    expect(res.cookies.get(UI_V2_COOKIE)).toBeUndefined();
  });

  it("limita los intentos por IP", async () => {
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await get("?v=1")).status;
    expect(last).toBe(429);
  });
});

describe("/lists: conmutador", () => {
  it("por defecto pinta la vieja", async () => {
    render(await page());
    expect(screen.getByTestId("ui-v1")).toBeTruthy();
  });

  it("con la cookie ui_v2=1 pinta la nueva con los mismos datos", async () => {
    h.cookie = "1";
    const { container } = render(await page());
    expect(container.querySelector('[data-ui="v2"]')).toBeTruthy();
    expect(screen.queryByTestId("ui-v1")).toBeNull();
    expect(screen.getByText("Pelis de domingo").closest("a")?.getAttribute("href")).toBe("/es/lists/l1");
    expect(screen.getByText(es.uiV2.exit).getAttribute("href")).toBe("/api/ui-v2?v=0&next=%2Fes%2Flists");
  });

  it("UI_V2_DEFAULT=1 pinta la nueva; la cookie 0 la apaga", async () => {
    process.env.UI_V2_DEFAULT = "1";
    const first = render(await page());
    expect(first.container.querySelector('[data-ui="v2"]')).toBeTruthy();
    first.unmount();

    h.cookie = "0";
    render(await page());
    expect(screen.getByTestId("ui-v1")).toBeTruthy();
  });

  it("sin sesión redirige al login antes de mirar el interruptor", async () => {
    h.user = null;
    h.cookie = "1";
    await expect(ListsPage()).rejects.toThrow("REDIRECT /login");
  });
});
