// ============================================================
// KULTURA — APIs asíncronas de Next 15 (F-20)
//
// En Next 15 `cookies()`, `headers()`, `params` y `searchParams` son
// asíncronos. Usarlos como en 14 compila a medias (hay compatibilidad
// temporal con avisos) y se rompe en 16. Lo que se protege:
//   - `createClient()` de servidor es async y espera a `cookies()`;
//   - ningún archivo de `src/` llama a `cookies()`/`headers()` sin `await`;
//   - ningún uso del cliente de servidor se queda sin `await createClient()`;
//   - `params`/`searchParams` de páginas, layouts y rutas se tipan como Promise.
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const { cookieStore, cookiesMock, serverClientMock } = vi.hoisted(() => {
  const cookieStore = {
    getAll: vi.fn(() => [{ name: "sb-access-token", value: "x" }]),
    set: vi.fn(),
  };
  return {
    cookieStore,
    cookiesMock: vi.fn(async () => cookieStore),
    serverClientMock: vi.fn((_url: string, _key: string, opts: unknown) => ({ opts })),
  };
});

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@supabase/ssr", () => ({ createServerClient: serverClientMock }));

import { createClient } from "@/lib/supabase/server";

const ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const files = walk(SRC).map((file) => ({
  file: path.relative(ROOT, file),
  code: readFileSync(file, "utf8"),
}));

/** Quita comentarios para no confundir la documentación con código. */
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("createClient de servidor (Next 15)", () => {
  it("es async y lee las cookies a través de `await cookies()`", async () => {
    const pending = createClient();
    expect(pending).toBeInstanceOf(Promise);
    const client = (await pending) as unknown as {
      opts: { cookies: { getAll: () => unknown; setAll: (c: unknown[]) => void } };
    };
    expect(cookiesMock).toHaveBeenCalledTimes(1);
    expect(client.opts.cookies.getAll()).toEqual([{ name: "sb-access-token", value: "x" }]);
    client.opts.cookies.setAll([{ name: "a", value: "b", options: {} }]);
    expect(cookieStore.set).toHaveBeenCalledWith("a", "b", {});
  });

  it("si un Server Component no puede escribir cookies, no rompe", async () => {
    cookieStore.set.mockImplementationOnce(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler");
    });
    const client = (await createClient()) as unknown as {
      opts: { cookies: { setAll: (c: unknown[]) => void } };
    };
    expect(() => client.opts.cookies.setAll([{ name: "a", value: "b", options: {} }])).not.toThrow();
  });
});

describe("uso de las APIs asíncronas en src/", () => {
  it("`cookies()` y `headers()` de next/headers siempre con await", () => {
    const offenders: string[] = [];
    for (const { file, code } of files) {
      if (!/from ["']next\/headers["']/.test(code)) continue;
      const body = stripComments(code);
      for (const m of body.matchAll(/\b(cookies|headers|draftMode)\(\)/g)) {
        const before = body.slice(Math.max(0, m.index! - 7), m.index);
        if (!/await\s*\(?$/.test(before)) offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("el cliente de Supabase de servidor siempre con `await createClient()`", () => {
    const offenders: string[] = [];
    for (const { file, code } of files) {
      if (!/from ["']@\/lib\/supabase\/server["']/.test(code)) continue;
      const body = stripComments(code);
      for (const m of body.matchAll(/\bcreateClient\(\)/g)) {
        const before = body.slice(Math.max(0, m.index! - 6), m.index);
        if (!/await\s$/.test(before)) offenders.push(`${file}:${body.slice(0, m.index).split("\n").length}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("`params` y `searchParams` de páginas, layouts y rutas se tipan como Promise", () => {
    const offenders: string[] = [];
    const segmentFile = /src\/app\/.*\/(page|layout|route|template|default)\.tsx?$/;
    for (const { file, code } of files) {
      if (!segmentFile.test(file.split(path.sep).join("/"))) continue;
      const body = stripComments(code);
      for (const m of body.matchAll(/\b(params|searchParams)\??\s*:\s*([^;\n]+)/g)) {
        const type = m[2].trim();
        // Desestructuraciones (`{ params }: Props`) y tipos con nombre se
        // comprueban por su definición, que también cae en este barrido.
        if (/^[A-Z]\w*\b/.test(type) && !type.startsWith("Promise")) continue;
        if (!type.startsWith("Promise<")) offenders.push(`${file}: ${m[0].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
