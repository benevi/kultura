#!/usr/bin/env node
// Fase 8.5 · M1 — PNG e ICO del logo de «Sala» a partir de los SVG de
// `public/brand/` (que salen de `src/lib/brand/sala-logo.ts`; `npm run brand:sala`).
// Rasteriza con el Chromium de Playwright, sin servicios externos:
//   public/icons/sala/icon-{192,512}.png       iconos de la PWA («any»)
//   public/icons/sala/maskable-{192,512}.png   iconos de la PWA («maskable»)
//   public/icons/sala/apple-icon-180.png       icono de iOS
//   public/brand/favicon.ico                   16 y 32 px, de respaldo del SVG
// Uso: node scripts/gen-sala-brand.mjs
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brand = (f) => readFileSync(resolve(root, "public/brand", f), "utf8");

// En el favicon el símbolo ocupa el 80 % (en el icono de la app, el 62 %):
// a 16 px, más pequeño no se lee la K. Se amplía el icono y se recorta.
const FAVICON_ZOOM = 0.8 / 0.62;

const browser = await chromium.launch();
async function render(svg, size, zoom = 1) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const inner = Math.round(size * zoom);
  const off = (size - inner) / 2;
  await page.setContent(
    `<html><body style="margin:0;overflow:hidden"><img style="position:absolute;left:${off}px;top:${off}px;width:${inner}px;height:${inner}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></body></html>`,
  );
  await page.waitForFunction(() => document.images[0]?.complete);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  return png;
}

/** ICO con PNG dentro (válido desde Windows Vista y en todos los navegadores). */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size % 256, e);
    head.writeUInt8(size % 256, e + 1);
    head.writeUInt16LE(1, e + 4); // planos
    head.writeUInt16LE(32, e + 6); // bits por píxel
    head.writeUInt32LE(png.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.png)]);
}

const icons = resolve(root, "public/icons/sala");
mkdirSync(icons, { recursive: true });
const any = brand("kultura-icono.svg");
const maskable = brand("kultura-icono-maskable.svg");
for (const size of [192, 512]) {
  writeFileSync(resolve(icons, `icon-${size}.png`), await render(any, size));
  writeFileSync(resolve(icons, `maskable-${size}.png`), await render(maskable, size));
}
writeFileSync(resolve(icons, "apple-icon-180.png"), await render(any, 180));
const fav = [];
for (const size of [16, 32]) fav.push({ size, png: await render(any, size, FAVICON_ZOOM) });
writeFileSync(resolve(root, "public/brand/favicon.ico"), ico(fav));
await browser.close();
console.log("PNG e ICO de «Sala» escritos en public/icons/sala/ y public/brand/favicon.ico");
