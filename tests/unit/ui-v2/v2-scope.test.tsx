import { describe, expect, it, vi } from "vitest";

vi.unmock("@/v2/V2Scope");

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (cookieValue.current ? { value: cookieValue.current } : undefined) }),
}));
vi.mock("@/app/fonts", () => ({ kulturaDisplay: { variable: "font-var" }, bricolagePortada: { variable: "font-swap" } }));

import { V2Scope } from "@/v2/V2Scope";

const child = <p>hola</p>;

describe("V2Scope", () => {
  it("sin el interruptor no añade ningún nodo", async () => {
    cookieValue.current = undefined;
    const el = (await V2Scope({ children: child })) as { props: { children: unknown }; type: unknown };
    expect(el.props.children).toBe(child);
    expect(el.type).not.toBe("div");
  });

  it("con la cookie marca el árbol y no altera la maquetación", async () => {
    cookieValue.current = "1";
    const el = (await V2Scope({ children: child })) as {
      type: string;
      props: Record<string, unknown> & { style: { display: string } };
    };
    expect(el.type).toBe("div");
    expect(el.props["data-ui"]).toBe("v2");
    expect(el.props.style.display).toBe("contents");
    expect(String(el.props.className)).toContain("font-var");
  });

  it("la cookie a 0 gana a UI_V2_DEFAULT=1", async () => {
    vi.stubEnv("UI_V2_DEFAULT", "1");
    cookieValue.current = "0";
    const el = (await V2Scope({ children: child })) as { type: unknown };
    expect(el.type).not.toBe("div");
    vi.unstubAllEnvs();
  });
});

describe("el bloque del acceso no se filtra a la UI vieja", () => {
  it("la regla de `.k2-blocks` no le gana a `.hidden`", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/v2/tokens.css", "utf8");
    expect(css).toContain(".k2-blocks:not(.hidden)");
    // El resto de la regla (las siete columnas) sí vale también para `.hidden`.
    const base = /\.k2-blocks\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(base).toContain("grid-template-columns");
    expect(base).not.toContain("display");
  });
});
