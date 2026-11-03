import { describe, it, expect } from "vitest";
import { referrerReturnPath } from "@/app/[locale]/login/return-path";

const ORIGIN = "https://kulturaapp.vercel.app";

describe("referrerReturnPath: vuelta a la página de origen sin `next`", () => {
  it("devuelve la ruta relativa con query y hash si es del mismo origen", () => {
    expect(referrerReturnPath(`${ORIGIN}/es/best/anime/2025?f=1#4`, ORIGIN)).toBe("/es/best/anime/2025?f=1#4");
    expect(referrerReturnPath(`${ORIGIN}/es/media/movie/603`, ORIGIN)).toBe("/es/media/movie/603");
  });

  it("otro origen (o un subdominio) no cuenta", () => {
    expect(referrerReturnPath("https://evil.example/es/library", ORIGIN)).toBe("");
    expect(referrerReturnPath("https://x.kulturaapp.vercel.app/es/library", ORIGIN)).toBe("");
    expect(referrerReturnPath("http://kulturaapp.vercel.app/es/library", ORIGIN)).toBe("");
  });

  it("no vuelve al acceso, a la contraseña nueva, a los correos ni a la API", () => {
    for (const path of ["/es/login?mode=register", "/login", "/en/reset-password", "/es/email/confirm?t=x", "/api/auth/callback"]) {
      expect(referrerReturnPath(`${ORIGIN}${path}`, ORIGIN)).toBe("");
    }
  });

  it("sin referrer, basura o sin origen: nada", () => {
    expect(referrerReturnPath("", ORIGIN)).toBe("");
    expect(referrerReturnPath(null, ORIGIN)).toBe("");
    expect(referrerReturnPath("no es una url", ORIGIN)).toBe("");
    expect(referrerReturnPath(`${ORIGIN}/es/library`, "")).toBe("");
  });
});
