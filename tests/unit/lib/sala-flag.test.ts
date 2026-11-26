// ============================================================
// Fase 8.5 · F1: bandera SALA_FICHA (0 / prueba / 1) y cookie de prueba.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

import {
  SALA_TEST_COOKIE,
  SALA_TEST_COOKIE_MAX_AGE,
  salaEnabled,
  salaBibliotecaEnabled,
  salaDescubrirEnabled,
  salaFichaEnabled,
  salaInicioEnabled,
  salaPerfilEnabled,
  salaFlagMode,
  salaTestCookie,
  salaTestNext,
} from "@/lib/flags/sala";
import { GET } from "@/app/api/sala-prueba/route";

describe("salaFlagMode", () => {
  it("sin definir, vacío, 0 o cualquier otra cosa: apagada", () => {
    for (const raw of [undefined, "", "0", "no", "true", "2"]) expect(salaFlagMode(raw)).toBe("off");
  });
  it("1 (con espacios): para todos", () => {
    expect(salaFlagMode("1")).toBe("on");
    expect(salaFlagMode(" 1\n")).toBe("on");
  });
  it("prueba (sin importar mayúsculas): solo con la cookie", () => {
    expect(salaFlagMode("prueba")).toBe("test");
    expect(salaFlagMode(" Prueba ")).toBe("test");
  });
});

describe("salaEnabled", () => {
  it("apagada: nunca, ni con la cookie", () => {
    expect(salaEnabled("off", "1")).toBe(false);
  });
  it("encendida: siempre, sin cookie", () => {
    expect(salaEnabled("on", undefined)).toBe(true);
  });
  it("prueba: solo con la cookie a 1", () => {
    expect(salaEnabled("test", "1")).toBe(true);
    expect(salaEnabled("test", undefined)).toBe(false);
    expect(salaEnabled("test", "")).toBe(false);
    expect(salaEnabled("test", "0")).toBe(false);
  });
});

describe("salaFichaEnabled (lee process.env.SALA_FICHA y la cookie)", () => {
  const before = process.env.SALA_FICHA;
  beforeEach(() => cookieStore.get.mockReset());
  afterEach(() => {
    if (before === undefined) delete process.env.SALA_FICHA;
    else process.env.SALA_FICHA = before;
  });

  it("sin definir: apagada y sin mirar la cookie", async () => {
    delete process.env.SALA_FICHA;
    expect(await salaFichaEnabled()).toBe(false);
    expect(cookieStore.get).not.toHaveBeenCalled();
  });
  it("0: apagada y sin mirar la cookie", async () => {
    process.env.SALA_FICHA = "0";
    cookieStore.get.mockReturnValue({ value: "1" });
    expect(await salaFichaEnabled()).toBe(false);
    expect(cookieStore.get).not.toHaveBeenCalled();
  });
  it("1: encendida", async () => {
    process.env.SALA_FICHA = "1";
    expect(await salaFichaEnabled()).toBe(true);
  });
  it("prueba: según la cookie", async () => {
    process.env.SALA_FICHA = "prueba";
    cookieStore.get.mockReturnValue({ value: "1" });
    expect(await salaFichaEnabled()).toBe(true);
    expect(cookieStore.get).toHaveBeenCalledWith(SALA_TEST_COOKIE);
    cookieStore.get.mockReturnValue(undefined);
    expect(await salaFichaEnabled()).toBe(false);
  });
});

describe("salaBibliotecaEnabled (lee process.env.SALA_BIBLIOTECA, misma cookie)", () => {
  const before = { ficha: process.env.SALA_FICHA, biblioteca: process.env.SALA_BIBLIOTECA };
  beforeEach(() => cookieStore.get.mockReset());
  afterEach(() => {
    for (const [k, v] of [["SALA_FICHA", before.ficha], ["SALA_BIBLIOTECA", before.biblioteca]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("sin definir o 0: apagada y sin mirar la cookie, aunque la ficha esté encendida", async () => {
    process.env.SALA_FICHA = "1";
    delete process.env.SALA_BIBLIOTECA;
    expect(await salaBibliotecaEnabled()).toBe(false);
    process.env.SALA_BIBLIOTECA = "0";
    cookieStore.get.mockReturnValue({ value: "1" });
    expect(await salaBibliotecaEnabled()).toBe(false);
    expect(cookieStore.get).not.toHaveBeenCalled();
  });
  it("1: encendida, aunque la ficha esté apagada", async () => {
    process.env.SALA_FICHA = "0";
    process.env.SALA_BIBLIOTECA = "1";
    expect(await salaBibliotecaEnabled()).toBe(true);
  });
  it("prueba: según la misma cookie de prueba", async () => {
    process.env.SALA_BIBLIOTECA = "prueba";
    cookieStore.get.mockReturnValue({ value: "1" });
    expect(await salaBibliotecaEnabled()).toBe(true);
    expect(cookieStore.get).toHaveBeenCalledWith(SALA_TEST_COOKIE);
    cookieStore.get.mockReturnValue(undefined);
    expect(await salaBibliotecaEnabled()).toBe(false);
  });
});

describe("salaDescubrirEnabled (lee process.env.SALA_DESCUBRIR, misma cookie)", () => {
  const before = { biblioteca: process.env.SALA_BIBLIOTECA, descubrir: process.env.SALA_DESCUBRIR };
  beforeEach(() => cookieStore.get.mockReset());
  afterEach(() => {
    for (const [k, v] of [["SALA_BIBLIOTECA", before.biblioteca], ["SALA_DESCUBRIR", before.descubrir]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("sin definir o 0: apagada y sin mirar la cookie, aunque la biblioteca esté encendida", async () => {
    process.env.SALA_BIBLIOTECA = "1";
    delete process.env.SALA_DESCUBRIR;
    expect(await salaDescubrirEnabled()).toBe(false);
    process.env.SALA_DESCUBRIR = "0";
    cookieStore.get.mockReturnValue({ value: "1" });
    expect(await salaDescubrirEnabled()).toBe(false);
    expect(cookieStore.get).not.toHaveBeenCalled();
  });
  it("1: encendida, aunque la biblioteca esté apagada", async () => {
    process.env.SALA_BIBLIOTECA = "0";
    process.env.SALA_DESCUBRIR = "1";
    expect(await salaDescubrirEnabled()).toBe(true);
  });
  it("prueba: según la misma cookie de prueba", async () => {
    process.env.SALA_DESCUBRIR = "prueba";
    cookieStore.get.mockReturnValue({ value: "1" });
    expect(await salaDescubrirEnabled()).toBe(true);
    expect(cookieStore.get).toHaveBeenCalledWith(SALA_TEST_COOKIE);
    cookieStore.get.mockReturnValue(undefined);
    expect(await salaDescubrirEnabled()).toBe(false);
  });
});

describe("salaInicioEnabled (lee process.env.SALA_INICIO, misma cookie)", () => {
  const before = { descubrir: process.env.SALA_DESCUBRIR, inicio: process.env.SALA_INICIO };
  beforeEach(() => cookieStore.get.mockReset());
  afterEach(() => {
    for (const [k, v] of [["SALA_DESCUBRIR", before.descubrir], ["SALA_INICIO", before.inicio]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("sin definir o 0: apagada y sin mirar la cookie, aunque Descubrir esté encendida", async () => {
    process.env.SALA_DESCUBRIR = "1";
    delete process.env.SALA_INICIO;
    expect(await salaInicioEnabled()).toBe(false);
    process.env.SALA_INICIO = "0";
    cookieStore.get.mockReturnValue({ value: "1" });
    expect(await salaInicioEnabled()).toBe(false);
    expect(cookieStore.get).not.toHaveBeenCalled();
  });
  it("1: encendida, aunque Descubrir esté apagada", async () => {
    process.env.SALA_DESCUBRIR = "0";
    process.env.SALA_INICIO = "1";
    expect(await salaInicioEnabled()).toBe(true);
  });
  it("prueba: según la misma cookie de prueba", async () => {
    process.env.SALA_INICIO = "prueba";
    cookieStore.get.mockReturnValue({ value: "1" });
    expect(await salaInicioEnabled()).toBe(true);
    expect(cookieStore.get).toHaveBeenCalledWith(SALA_TEST_COOKIE);
    cookieStore.get.mockReturnValue(undefined);
    expect(await salaInicioEnabled()).toBe(false);
  });
});

describe("salaPerfilEnabled (lee process.env.SALA_PERFIL, misma cookie)", () => {
  const before = { inicio: process.env.SALA_INICIO, perfil: process.env.SALA_PERFIL };
  beforeEach(() => cookieStore.get.mockReset());
  afterEach(() => {
    for (const [k, v] of [["SALA_INICIO", before.inicio], ["SALA_PERFIL", before.perfil]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("sin definir o 0: apagada y sin mirar la cookie, aunque Inicio esté encendida", async () => {
    process.env.SALA_INICIO = "1";
    delete process.env.SALA_PERFIL;
    expect(await salaPerfilEnabled()).toBe(false);
    process.env.SALA_PERFIL = "0";
    cookieStore.get.mockReturnValue({ value: "1" });
    expect(await salaPerfilEnabled()).toBe(false);
    expect(cookieStore.get).not.toHaveBeenCalled();
  });
  it("1: encendida sin leer la cookie", async () => {
    process.env.SALA_INICIO = "0";
    process.env.SALA_PERFIL = "1";
    expect(await salaPerfilEnabled()).toBe(true);
    expect(cookieStore.get).not.toHaveBeenCalled();
  });
  it("prueba: según la misma cookie de prueba", async () => {
    process.env.SALA_PERFIL = "prueba";
    cookieStore.get.mockReturnValue({ value: "1" });
    expect(await salaPerfilEnabled()).toBe(true);
    expect(cookieStore.get).toHaveBeenCalledWith(SALA_TEST_COOKIE);
    cookieStore.get.mockReturnValue(undefined);
    expect(await salaPerfilEnabled()).toBe(false);
  });
});

describe("salaTestNext", () => {
  it("solo rutas de este sitio", () => {
    expect(salaTestNext("/es/media/movie/496243")).toBe("/es/media/movie/496243");
    expect(salaTestNext("/es/media/movie/1?x=1")).toBe("/es/media/movie/1?x=1");
    for (const raw of [null, "", "https://x.com", "//x.com", "/\\x.com", "es/media", "/\t/x.com", "/\n/x.com", "/\r/x.com", "/x\u0000"]) expect(salaTestNext(raw)).toBe("/");
  });
});

describe("salaTestCookie", () => {
  it("pone 1, httpOnly, lax, toda la web y 60 días", () => {
    expect(salaTestCookie(true, true)).toEqual({
      name: SALA_TEST_COOKIE,
      value: "1",
      options: { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: SALA_TEST_COOKIE_MAX_AGE },
    });
    expect(SALA_TEST_COOKIE_MAX_AGE).toBe(60 * 24 * 60 * 60);
  });
  it("quitarla: vacía y caducada", () => {
    const c = salaTestCookie(false, false);
    expect(c.value).toBe("");
    expect(c.options.maxAge).toBe(0);
  });
});

describe("GET /api/sala-prueba", () => {
  const call = (query: string) => GET(new NextRequest(`http://localhost:3000/api/sala-prueba${query}`));

  it("on=1: pone la cookie y vuelve a next", () => {
    const res = call("?on=1&next=%2Fes%2Fmedia%2Fmovie%2F496243");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/es/media/movie/496243");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SALA_TEST_COOKIE}=1`);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain(`Max-Age=${SALA_TEST_COOKIE_MAX_AGE}`);
  });
  it("on=0: la quita y, sin next, vuelve a la portada", () => {
    const res = call("?on=0");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("next de otra web: a la portada", () => {
    expect(call("?on=1&next=%2F%2Fevil.example").headers.get("location")).toBe("http://localhost:3000/");
    for (const next of ["%2F%09%2Fevil.example", "%2F%0A%2Fevil.example", "%2F%0D%2Fevil.example"])
      expect(call(`?on=1&next=${next}`).headers.get("location")).toBe("http://localhost:3000/");
  });
  it("sin on válido: 400 y sin cookie", () => {
    const res = call("?on=si");
    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
