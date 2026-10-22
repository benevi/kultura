/**
 * MOV-1 — PWA instalable: manifest, iconos y favicon. La comprobación en
 * navegador (`Page.getInstallabilityErrors` vacío) va en la descripción del PR.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import es from "../../../messages/es.json";
import manifest from "@/app/manifest";
import { SHELL_VIEWPORT, SURFACE_BASE_HEX } from "@/i18n/metadata";

const ROOT = path.resolve(__dirname, "../../..");

/** Ancho y alto de un PNG (cabecera IHDR). */
function pngSize(file: string) {
  const buf = fs.readFileSync(file);
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("MOV-1 — PWA instalable", () => {
  const m = manifest();

  it("arranca en la portada (sin sesión no acaba en el login), independiente y con el color real del fondo", () => {
    expect(m).toMatchObject({
      name: "KULTURA",
      short_name: "KULTURA",
      start_url: "/es",
      scope: "/",
      display: "standalone",
      theme_color: "#0c0d14",
      background_color: "#0c0d14",
      lang: "es",
      description: es.meta.description,
    });
  });

  it("el color de la barra del navegador es el mismo que el del manifest", () => {
    expect(SURFACE_BASE_HEX).toBe("#0c0d14");
    expect(SHELL_VIEWPORT.themeColor).toBe(m.theme_color);
  });

  it("iconos 192 y 512 + maskable 512 que existen con ese tamaño", () => {
    const icons = m.icons ?? [];
    expect(icons.map((i) => `${i.sizes}:${i.purpose}`)).toEqual(["192x192:any", "512x512:any", "512x512:maskable"]);
    for (const icon of icons) {
      const [w, h] = String(icon.sizes).split("x").map(Number);
      expect(pngSize(path.join(ROOT, "public", icon.src))).toEqual({ width: w, height: h });
    }
  });

  it("atajos a Biblioteca y Descubrir", () => {
    expect(m.shortcuts?.map((s) => [s.name, s.url])).toEqual([
      [es.nav.library, "/es/library"],
      [es.nav.discover, "/es/discover"],
    ]);
  });

  it("apple-icon de 180 px, icono SVG y favicon servido desde public/", () => {
    expect(pngSize(path.join(ROOT, "src/app/apple-icon.png"))).toEqual({ width: 180, height: 180 });
    expect(fs.readFileSync(path.join(ROOT, "src/app/icon.svg"), "utf8")).toContain("<svg");
    // En src/app/ Next le fija su propio Cache-Control (REN-10): tiene que vivir en public/.
    expect(fs.existsSync(path.join(ROOT, "public/favicon.ico"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "src/app/favicon.ico"))).toBe(false);
  });
});
