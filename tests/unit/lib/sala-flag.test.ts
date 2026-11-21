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
  salaFichaEnabled,
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

describe("salaTestNext", () => {
  it("solo rutas de este sitio", () => {
    expect(salaTestNext("/es/media/movie/496243")).toBe("/es/media/movie/496243");
    expect(salaTestNext("/es/media/movie/1?x=1")).toBe("/es/media/movie/1?x=1");
    for (const raw of [null, "", "https://x.com", "//x.com", "/\\x.com", "es/media"]) expect(salaTestNext(raw)).toBe("/");
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
  });
  it("sin on válido: 400 y sin cookie", () => {
    const res = call("?on=si");
    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
