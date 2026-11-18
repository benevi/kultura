"use client";

// Prototipo fase 8.3 — lee la portada ya cargada (el `<img data-kp-cover>` de
// la dirección) con un canvas, saca su paleta y la pone como variables CSS en
// el contenedor `.kp`. Hasta entonces (y si la portada no se puede leer) valen
// los tokens neutros de `proto.css`. Nada sale del navegador.

import { useEffect, useRef } from "react";
import { derivePalette, extractSwatches, paletteToVars, type CoverPalette } from "./cover-palette";
import type { CoverSource } from "./types";

/** Píxeles RGBA de una imagen ya cargada, reducida a `size` px de lado mayor. `null` si el canvas no puede leerla. */
export function readPixels(img: HTMLImageElement, size = 40): ImageData | null {
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) return null;
  const k = size / Math.max(w, h);
  const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, cw, ch);
    return ctx.getImageData(0, 0, cw, ch);
  } catch {
    return null; // lienzo «manchado» (imagen sin CORS)
  }
}

function whenLoaded(img: HTMLImageElement): Promise<boolean> {
  if (img.complete) return Promise.resolve(img.naturalWidth > 0);
  return new Promise((resolve) => {
    img.addEventListener("load", () => resolve(true), { once: true });
    img.addEventListener("error", () => resolve(false), { once: true });
  });
}

function loadSample(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Evento en `.kp` cuando la paleta está puesta: `detail` = `CoverPalette`. */
export const COVER_EVENT = "kp:cover";

export function CoverColor({ cover }: { cover: CoverSource | null }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>(".kp");
    if (!root || !cover) return;
    let alive = true;
    const applied: string[] = [];

    (async () => {
      let pixels: ImageData | null = null;
      const shown = root.querySelector<HTMLImageElement>("img[data-kp-cover]");
      if (shown && cover.canvasSafe && (await whenLoaded(shown))) pixels = readPixels(shown);
      if (!pixels) {
        const sample = await loadSample(cover.sample);
        if (sample) pixels = readPixels(sample);
      }
      if (!alive) return;
      let palette: CoverPalette | null = null;
      if (pixels) {
        palette = derivePalette(extractSwatches(pixels.data));
        for (const [name, value] of Object.entries(paletteToVars(palette))) {
          root.style.setProperty(name, value);
          applied.push(name);
        }
      }
      root.dataset.cover = palette ? (palette.neutral ? "neutral" : "color") : "unread";
      root.dispatchEvent(new CustomEvent(COVER_EVENT, { detail: palette }));
    })();

    return () => {
      alive = false;
      for (const name of applied) root.style.removeProperty(name);
      delete root.dataset.cover;
    };
  }, [cover]);

  return <span ref={ref} hidden />;
}
