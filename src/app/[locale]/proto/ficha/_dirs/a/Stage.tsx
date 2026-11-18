"use client";

// Dirección A «Sala» — la sala: la imagen a pantalla completa y el título
// dentro de ella (modo `wide`: arte apaisado sin rótulo). Si la obra solo tiene
// portada con su rótulo (modo `piece`), la portada va entera como pieza y nada
// de lo de abajo (velo, fundido) se aplica. El HTML del servidor ya trae el `h1` y la portada; este
// componente solo añade, en el navegador:
//   1. el velo justo para que el título cumpla contraste sobre ESTA portada,
//   2. el encaje del título (tamaño hasta llenar el ancho en pocas líneas),
//   3. las letras fundidas: las partes de la portada que destacan del fondo
//      pasan por delante de las letras (capa de adorno, `aria-hidden`),
//   4. la profundidad en 2D al mover el puntero.
// La sala es solo portada y título: el tráiler va aparte, en su sección (Trailer.tsx).
// Sin mapas de profundidad ni copias: todo sale de la portada ya cargada.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { contrast, rgbToOklab, type RGB } from "../../_base/color";
import { readPixels } from "../../_base/CoverColor";
import { derivePalette, extractSwatches } from "../../_base/cover-palette";
import { useProto } from "../../_base/ProtoShell";
import type { CoverSource } from "../../_base/types";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Contraste mínimo del título con lo que tiene detrás (texto grande: AA pide 3:1; se deja margen). */
const TITLE_RATIO = 3.6;
/** Si solo se puede leer una miniatura de la portada (Google Books), más margen: el detalle fino no se ve. */
const TITLE_RATIO_THUMB = 4.2;
/** Tope: como mucho, esta parte de los PÍXELES DE LETRA puede quedar tapada por la portada (en el título y en cada línea). */
const FUSE_MAX_COVERAGE = 0.22;
/** Lo que se busca (un poco por debajo del tope: la máscara de letra del canvas no es idéntica a la pintada). */
const FUSE_TARGET = 0.2;
/** Distancia mínima (OKLab) al color de fondo para que algo pase por delante de las letras. */
const FUSE_MIN_DIST = 0.14;

const parseHex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mix = (px: number, s: number, a: number) => px * (1 - a) + s * a;

interface Tone {
  scrim: RGB;
  ink: RGB;
}
interface Analysis {
  /** Imagen legible por canvas (la mostrada o la miniatura). */
  img: HTMLImageElement;
  /** Solo hay miniatura: la portada mostrada no se puede leer. */
  thumb: boolean;
  dominant: RGB;
  light: Tone; // tinta clara sobre velo oscuro
  dark: Tone; // tinta oscura sobre velo claro
}

/**
 * Colores que el título puede tener detrás, en cubos de 4 bits por canal; de
 * cada cubo se guardan el máximo y el mínimo reales de cada canal (el peor caso
 * para tinta clara y para tinta oscura).
 */
class Behind {
  used = new Uint8Array(4096);
  max = new Uint8Array(4096 * 3);
  min = new Uint8Array(4096 * 3).fill(255);
  add(r: number, g: number, b: number) {
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4), o = k * 3;
    this.used[k] = 1;
    if (r > this.max[o]) this.max[o] = r;
    if (g > this.max[o + 1]) this.max[o + 1] = g;
    if (b > this.max[o + 2]) this.max[o + 2] = b;
    if (r < this.min[o]) this.min[o] = r;
    if (g < this.min[o + 1]) this.min[o + 1] = g;
    if (b < this.min[o + 2]) this.min[o + 2] = b;
  }
  addPixels(px: Uint8ClampedArray) {
    for (let i = 0; i < px.length; i += 4) this.add(px[i], px[i + 1], px[i + 2]);
  }
}

/** Velo mínimo para que `ink` tenga `ratio` sobre TODO lo que hay detrás del título. */
function minAlpha(behind: Behind, { scrim, ink }: Tone, ratio: number): number {
  const lightInk = contrast(ink, [255, 255, 255]) < contrast(ink, [0, 0, 0]);
  const worst = lightInk ? behind.max : behind.min;
  const ok = (a: number) => {
    for (let k = 0; k < 4096; k++) {
      if (!behind.used[k]) continue;
      const o = k * 3;
      const c: RGB = [mix(worst[o], scrim[0], a), mix(worst[o + 1], scrim[1], a), mix(worst[o + 2], scrim[2], a)];
      if (contrast(ink, c) < ratio) return false;
    }
    return true;
  };
  let lo = 0.12, hi = 0.94;
  if (ok(lo)) return lo;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Dónde cae la imagen ENTERA dentro de una caja de `w × h` con `object-fit: cover`.
 * Se pinta siempre entera (`drawImage` de 5 argumentos) y el canvas recorta: con
 * `srcset`, `naturalWidth` no son los píxeles reales del archivo y un recorte
 * en coordenadas de origen se sale de la imagen.
 */
function coverFit(img: HTMLImageElement, w: number, h: number) {
  const ar = img.naturalWidth / img.naturalHeight;
  const dw = Math.max(w, h * ar), dh = dw / ar;
  return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
}

function canvas2d(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return ctx ? { canvas, ctx } : null;
}

type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };

/**
 * Lo que el título tiene detrás, sin velo: (1) la portada, donde el título la
 * pisa, a resolución de pantalla; (2) la copia borrosa del fondo (`.a-back`),
 * donde no la pisa. La copia se lee a 1/12 sin desenfocar del todo (los
 * extremos salen algo mayores que los pintados: del lado seguro) y con el
 * `saturate(1.25)` del CSS; se mira un margen alrededor del título por el
 * movimiento del fondo con el puntero y con el scroll.
 */
function readBehind(img: HTMLImageElement, s: Box, t: Box, b: Box | null): Behind | null {
  const behind = new Behind();
  try {
    if (b) {
      const l = Math.max(t.left - 2, b.left), r = Math.min(t.right + 2, b.right);
      const top = Math.max(t.top - 2, b.top), bot = Math.min(t.bottom + 2, b.bottom);
      if (r > l && bot > top) {
        const k = Math.min(1, 1400 / (r - l));
        const c = canvas2d((r - l) * k, (bot - top) * k);
        if (!c) return null;
        const { dx, dy, dw, dh } = coverFit(img, b.width, b.height);
        c.ctx.drawImage(img, (dx - (l - b.left)) * k, (dy - (top - b.top)) * k, dw * k, dh * k);
        behind.addPixels(c.ctx.getImageData(0, 0, c.canvas.width, c.canvas.height).data);
      }
    }
    const CELL = 12;
    const c = canvas2d(s.width / CELL, s.height / CELL);
    if (!c) return null;
    const { dx, dy, dw, dh } = coverFit(img, s.width, s.height);
    const cw = c.canvas.width, ch = c.canvas.height;
    c.ctx.imageSmoothingQuality = "high";
    // `scale(1.2)` desde el centro, como en a.css.
    const z = 1.2 / CELL, cx = s.width / 2, cy = s.height / 2;
    c.ctx.drawImage(img, cw / 2 + (dx - cx) * z, ch / 2 + (dy - cy) * z, dw * z, dh * z);
    const px = c.ctx.getImageData(0, 0, cw, ch).data;
    const sat = 1.25, u8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const x0 = Math.max(0, Math.floor((t.left - s.left - 30) / CELL)), x1 = Math.min(cw, Math.ceil((t.right - s.left + 30) / CELL));
    const y0 = Math.max(0, Math.floor((t.top - s.top - 30) / CELL)), y1 = Math.min(ch, Math.ceil((t.bottom - s.top + 90) / CELL));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (b) {
          const cx = s.left + (x + 0.5) * CELL, cy = s.top + (y + 0.5) * CELL;
          if (cx > b.left + 12 && cx < b.right - 12 && cy > b.top + 12 && cy < b.bottom - 12) continue; // tapado por la portada
        }
        const i = (y * cw + x) * 4, r = px[i], g = px[i + 1], bl = px[i + 2];
        behind.add(
          u8((0.213 + 0.787 * sat) * r + (0.715 - 0.715 * sat) * g + (0.072 - 0.072 * sat) * bl),
          u8((0.213 - 0.213 * sat) * r + (0.715 + 0.285 * sat) * g + (0.072 - 0.072 * sat) * bl),
          u8((0.213 - 0.213 * sat) * r + (0.715 - 0.715 * sat) * g + (0.072 + 0.928 * sat) * bl),
        );
      }
    }
  } catch {
    return null; // lienzo «manchado»
  }
  return behind;
}

// ── Máscara de letra ───────────────────────────────────────────────────────
// El tope del fundido se mide sobre los píxeles de letra. El canvas no admite
// `font-variation-settings`, así que la misma fuente se registra otra vez con
// la anchura puesta en la propia cara (`variationSettings`), y cada carácter se
// pinta donde el navegador lo ha colocado en el `h1` (Range.getClientRects).
const fitFaces = new Map<string, Promise<string | null>>();
const unquote = (v: string) => v.trim().replace(/^["']|["']$/g, "");

function fitFamily(cs: CSSStyleDeclaration): Promise<string | null> {
  const family = unquote(cs.fontFamily.split(",")[0]);
  const wdth = /"wdth"\s+(-?[\d.]+)/.exec(cs.fontVariationSettings)?.[1];
  if (!wdth || typeof FontFace === "undefined") return Promise.resolve(null);
  const name = `kp-a-fit-${wdth.replace(".", "_")}`;
  let p = fitFaces.get(name);
  if (!p) {
    p = (async () => {
      let n = 0;
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          if (!(rule instanceof CSSFontFaceRule)) continue;
          const st = rule.style;
          if (unquote(st.getPropertyValue("font-family")) !== family) continue;
          const base = sheet.href || location.href;
          const src = st
            .getPropertyValue("src")
            .replace(/url\((["']?)([^"')]+)\1\)/g, (_m, _q, u: string) => `url("${new URL(u, base).href}")`);
          if (!src) continue;
          document.fonts.add(
            new FontFace(name, src, {
              weight: st.getPropertyValue("font-weight") || "normal",
              style: st.getPropertyValue("font-style") || "normal",
              unicodeRange: st.getPropertyValue("unicode-range") || "U+0-10FFFF",
              variationSettings: `"wdth" ${wdth}`,
            } as FontFaceDescriptors),
          );
          n++;
        }
      }
      return n ? name : null;
    })().catch(() => null);
    fitFaces.set(name, p);
  }
  return p;
}

/** Media de caja separable (radio `r`) sobre un mapa `w × h`, en el sitio. */
function smooth(map: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(map.length);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass ? tmp : map, dst = pass ? map : tmp;
    const n = pass ? h : w, m = pass ? w : h, step = pass ? w : 1, line = pass ? 1 : w;
    for (let j = 0; j < m; j++) {
      const o = j * line;
      let sum = 0, cnt = 0;
      for (let i = 0; i <= r && i < n; i++) { sum += src[o + i * step]; cnt++; }
      for (let i = 0; i < n; i++) {
        dst[o + i * step] = sum / cnt;
        const add = i + r + 1, del = i - r;
        if (add < n) { sum += src[o + add * step]; cnt++; }
        if (del >= 0) { sum -= src[o + del * step]; cnt--; }
      }
    }
  }
}

interface Mask {
  a: Uint8ClampedArray;
  w: number;
  h: number;
  /** Fila (en píxeles de la máscara) donde empieza cada línea del título. */
  lines: number[];
}

/** Letras del título pintadas a escala `k` (píxeles de canvas por píxel CSS), con origen en la esquina del `h1`. */
async function glyphMask(h1: HTMLElement, textEl: Element | null, k: number): Promise<Mask | null> {
  const node = textEl?.firstChild;
  if (!(node instanceof Text)) return null;
  const fam = await fitFamily(getComputedStyle(h1));
  const cs = getComputedStyle(h1);
  const fs = parseFloat(cs.fontSize);
  const font = (size: number) => `${cs.fontStyle} ${cs.fontWeight} ${size}px ${fam ? `"${fam}", ` : ""}${cs.fontFamily}`;
  if (fam) await document.fonts.load(font(40), node.data).catch(() => {});
  const t = h1.getBoundingClientRect();
  const c = canvas2d(t.width * k, t.height * k);
  if (!c || !fs) return null;
  const { ctx } = c;
  ctx.font = font(fs * k);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#000";
  const asc = ctx.measureText("Hg").fontBoundingBoxAscent;
  const range = document.createRange();
  const text = node.data;
  const lines: number[] = [];
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i) ?? 32);
    if (ch.trim()) {
      range.setStart(node, i);
      range.setEnd(node, i + ch.length);
      const r = range.getClientRects()[0];
      if (r && r.width) {
        const y = Math.round((r.top - t.top) * k);
        if (!lines.some((l) => Math.abs(l - y) < 3)) lines.push(y);
        if (fam && Number.isFinite(asc)) ctx.fillText(ch, (r.left - t.left) * k, (r.top - t.top) * k + asc);
        else ctx.fillRect((r.left - t.left) * k, (r.top - t.top) * k, r.width * k, r.height * k); // sin la fuente: la caja del carácter
      }
    }
    i += ch.length;
  }
  lines.sort((x, y) => x - y);
  return { a: ctx.getImageData(0, 0, c.canvas.width, c.canvas.height).data, w: c.canvas.width, h: c.canvas.height, lines };
}

function waitImage(img: HTMLImageElement): Promise<boolean> {
  if (img.complete) return Promise.resolve(img.naturalWidth > 0);
  return new Promise((resolve) => {
    img.addEventListener("load", () => resolve(true), { once: true });
    img.addEventListener("error", () => resolve(false), { once: true });
  });
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

interface StageProps {
  title: string;
  titleLang?: string;
  cover: CoverSource | null;
  /**
   * `wide`: `cover` es arte apaisado sin rótulo, a sangre, con el título fundido dentro.
   * `piece`: `cover` es la portada (trae su propio rótulo): entera, sin recortar,
   * centrada sobre un campo de su color; el título va debajo y no se funde.
   */
  mode: "wide" | "piece";
  /** Texto del interruptor de prueba «Letras fundidas». */
  fuseLabel: string;
}

export function Stage({
  title,
  titleLang,
  cover,
  mode,
  fuseLabel,
}: StageProps) {
  const piece = mode === "piece" || !cover;
  const { theme, reducedMotion } = useProto();
  // [P] Letras fundidas: interruptor de prueba para decidir viéndolo.
  const [fuse, setFuse] = useState(true);
  const stageRef = useRef<HTMLElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const fuseRef = useRef<HTMLSpanElement>(null);
  const analysisRef = useRef<Analysis | null>(null);
  const blobRef = useRef<string | null>(null);
  const applyRef = useRef<() => void>(() => {});
  const runRef = useRef(0);

  // Estimación del servidor para el primer pintado (el encaje real va después).
  const words = title.split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length));
  const len = title.length;
  const wdth = len <= 6 ? 135 : len <= 10 ? 112 : len <= 16 ? 94 : len <= 28 ? 80 : 68;

  // ── 2. Encaje del título y 3b. posición de la capa fundida ──────────────
  const layout = () => {
    const stage = stageRef.current, h1 = titleRef.current, box = boxRef.current;
    if (!stage || !h1) return;
    const desktop = window.matchMedia("(min-width: 720px)").matches;
    const maxLines = desktop ? 2 : 3;
    const stageH = stage.clientHeight;
    // Con la portada como pieza, el título cede alto a la portada.
    const maxFs = desktop ? Math.min(stageH * (piece ? 0.24 : 0.36), piece ? 240 : 320) : 132;
    // El tamaño se busca SIN partir palabras; `overflow-wrap: anywhere` (a.css)
    // solo actúa si una palabra no cabe ni al tamaño mínimo.
    h1.style.overflowWrap = "normal";
    const fits = (fs: number) => {
      h1.style.fontSize = `${fs}px`;
      const lh = parseFloat(getComputedStyle(h1).lineHeight) || fs * 0.9;
      return h1.scrollWidth <= h1.clientWidth + 1 && h1.scrollHeight <= lh * maxLines + 2;
    };
    let lo = 30, hi = maxFs;
    if (!fits(lo)) {
      h1.style.fontSize = `${lo}px`;
    } else {
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      // Un pelo menos: `scrollWidth` redondea, y con `overflow-wrap: anywhere` medio
      // píxel de más partiría la palabra.
      h1.style.fontSize = `${Math.floor(lo * 0.985)}px`;
    }
    h1.style.removeProperty("overflow-wrap");
    // Velo: macizo detrás de todo el título, y se desvanece por encima.
    const s = stage.getBoundingClientRect(), t = h1.getBoundingClientRect();
    stage.style.setProperty("--a-band", `${Math.round(s.bottom - t.top + 20)}px`);
    stage.style.setProperty("--a-title-h", `${Math.round(t.height)}px`);
    if (box) {
      const b = box.getBoundingClientRect();
      stage.style.setProperty("--a-band-cover", `${Math.max(0, Math.round(b.bottom - t.top + 20))}px`);
    }
  };

  // Cualquier cambio de tamaño (o de fuente) vuelve a encajar el título y a
  // calcular velo y fundido: el tope se cumple en cualquier ancho.
  const refresh = () => {
    layout();
    applyRef.current();
  };
  useIsoLayoutEffect(() => {
    refresh();
    const stage = stageRef.current;
    if (!stage) return;
    let raf = 0;
    const later = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(refresh);
    };
    const ro = new ResizeObserver(later);
    ro.observe(stage);
    // Las entradas mueven portada y título: al acabar, se mide otra vez.
    stage.addEventListener("animationend", later);
    document.fonts?.ready.then(later).catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.removeEventListener("animationend", later);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // ── 1. Análisis de la portada (una vez) ─────────────────────────────────
  useEffect(() => {
    if (!cover || piece) return;
    let alive = true;
    (async () => {
      let img: HTMLImageElement | null = null;
      const shown = imgRef.current;
      if (shown && cover.canvasSafe && (await waitImage(shown))) img = shown;
      let small = img ? readPixels(img, 48) : null;
      if (!small) {
        img = await loadImage(cover.sample);
        small = img ? readPixels(img, 48) : null;
      }
      if (!alive || !img || !small) return;
      if (shown?.naturalWidth && boxRef.current && cover.shape === "portrait") {
        stageRef.current?.style.setProperty("--a-ar", `${shown.naturalWidth} / ${shown.naturalHeight}`);
      }
      const swatches = extractSwatches(small.data);
      const palette = derivePalette(swatches);
      analysisRef.current = {
        img,
        thumb: img !== shown,
        dominant: swatches[0]?.rgb ?? [128, 128, 128],
        light: { scrim: parseHex(palette.dark.bg), ink: parseHex(palette.dark.ink) },
        dark: { scrim: parseHex(palette.light.bg), ink: parseHex(palette.light.ink) },
      };
      refresh();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover?.original]);

  // ── 1b + 3. Velo y capa fundida según el tema ───────────────────────────
  useEffect(() => {
    applyRef.current = () => {
      const a = analysisRef.current, stage = stageRef.current, box = boxRef.current, h1 = titleRef.current;
      if (!a || !stage || !h1 || !theme) return;
      const run = ++runRef.current;
      const { img } = a;
      const s = stage.getBoundingClientRect(), t = h1.getBoundingClientRect();
      const b = box?.getBoundingClientRect() ?? null;

      // 1b. Velo: el mínimo para que TODA la letra tenga contraste con lo que
      // tiene detrás a este ancho (la portada y la copia borrosa del fondo).
      const behind = readBehind(img, s, t, b && b.width && b.height ? b : null);
      const ratio = a.thumb ? TITLE_RATIO_THUMB : TITLE_RATIO;
      const alphaL = behind ? minAlpha(behind, a.light, ratio) : 0.94;
      const alphaD = behind ? minAlpha(behind, a.dark, ratio) : 0.94;
      // Manda la portada, no el tema: tinta clara sobre velo oscuro (se lee como
      // sombra) salvo que la portada sea clara y la tinta oscura necesite bastante
      // menos velo (un velo claro sobre una portada oscura la deja lechosa).
      const pick = alphaD < alphaL - 0.1 ? "dark" : "light";
      const { scrim, ink } = a[pick];
      const alpha = pick === "dark" ? alphaD : alphaL;
      stage.dataset.ink = pick;
      stage.style.setProperty("--a-scrim", scrim.join(" "));
      stage.style.setProperty("--a-scrim-a", alpha.toFixed(3));
      stage.style.setProperty("--a-ink", `rgb(${ink.join(" ")})`);

      // 3. Capa fundida: la portada recortada como se ve, con el mismo velo, y
      // opaca solo donde se aparta del color de fondo dominante.
      const fuseOff = () => {
        if (run !== runRef.current) return;
        stage.style.removeProperty("--a-fuse-img");
        stage.dataset.fuseCover = "0";
      };
      if (!b || !b.width || !b.height) return fuseOff();
      const cw = Math.round(Math.min(640, Math.max(240, b.width)));
      const k = cw / b.width;
      const c = canvas2d(cw, b.height * k);
      if (!c) return fuseOff();
      const { canvas, ctx } = c;
      const ch = canvas.height;
      let data: ImageData;
      try {
        const { dx, dy, dw, dh } = coverFit(img, b.width, b.height);
        ctx.drawImage(img, dx * k, dy * k, dw * k, dh * k);
        data = ctx.getImageData(0, 0, cw, ch);
      } catch {
        return fuseOff();
      }
      const px = data.data;
      // «Fondo» = el color que más hay DETRÁS del título (no el de toda la portada).
      const top = Math.min(0.9, Math.max(0, (t.top - b.top) / b.height));
      const zoneStart = Math.floor(ch * top) * cw;
      const zoneMain = extractSwatches(px.subarray(zoneStart * 4), 1)[0]?.rgb ?? a.dominant;
      const dom = rgbToOklab(zoneMain);
      const dist = new Float32Array(cw * ch);
      for (let i = 0, p = 0; i < px.length; i += 4, p++) {
        const lab = rgbToOklab([px[i], px[i + 1], px[i + 2]]);
        dist[p] = Math.hypot(lab[0] - dom[0], lab[1] - dom[1], lab[2] - dom[2]);
      }
      // Se suaviza un poco: pasan por delante formas enteras, no motas sueltas.
      smooth(dist, cw, ch, Math.max(1, Math.round(cw / 320)));

      glyphMask(h1, h1.querySelector(".a-title-text"), k)
        .catch(() => null)
        .then((mask) => {
          if (run !== runRef.current || !stageRef.current) return;
          if (!mask) return fuseOff();
          // Umbral: lo tapado no pasa de FUSE_TARGET de los píxeles de letra, ni
          // en el título entero (también cuenta la letra que no pisa la portada)
          // ni en ninguna de sus líneas (que no se lleve una sola todo el fundido).
          const BINS = 256, SCALE = 400;
          const nl = Math.max(1, mask.lines.length);
          const hist = Array.from({ length: nl + 1 }, () => new Uint32Array(BINS)); // [nl] = el título entero
          const glyph = new Uint32Array(nl + 1);
          const ox = Math.round((t.left - b.left) * k), oy = Math.round((t.top - b.top) * k);
          const at: number[] = [], atLine: number[] = [];
          for (let y = 0, li = 0; y < mask.h; y++) {
            while (li + 1 < nl && y >= mask.lines[li + 1]) li++;
            for (let x = 0; x < mask.w; x++) {
              if (mask.a[(y * mask.w + x) * 4 + 3] < 128) continue;
              glyph[li]++;
              glyph[nl]++;
              const fx = x + ox, fy = y + oy;
              if (fx < 0 || fy < 0 || fx >= cw || fy >= ch) continue;
              const p = fy * cw + fx, bin = Math.min(BINS - 1, Math.floor(dist[p] * SCALE));
              at.push(p);
              atLine.push(li);
              hist[li][bin]++;
              hist[nl][bin]++;
            }
          }
          if (!glyph[nl]) return fuseOff();
          let cut = 0;
          for (let g = 0; g <= nl; g++) {
            if (!glyph[g]) continue;
            let acc = 0, c = BINS;
            for (let bin = BINS - 1; bin >= 0; bin--) {
              if ((acc + hist[g][bin]) / glyph[g] > FUSE_TARGET) break;
              acc += hist[g][bin];
              c = bin;
            }
            cut = Math.max(cut, c);
          }
          // La rampa va por ENCIMA del corte: lo tapado nunca pasa del límite.
          const t0 = Math.max(FUSE_MIN_DIST, cut / SCALE), t1 = t0 + 0.035;
          const cov = new Uint32Array(nl + 1);
          for (let i = 0; i < at.length; i++) {
            if (dist[at[i]] > t0) {
              cov[atLine[i]]++;
              cov[nl]++;
            }
          }
          // Si ni así cabe (o no hay nada que fundir), esta obra va sin fundido.
          if (!cov[nl] || cov.some((n, g) => n / (glyph[g] || 1) > FUSE_MAX_COVERAGE)) return fuseOff();
          const covered = cov[nl], total = glyph[nl];
          for (let i = 0, p = 0; i < px.length; i += 4, p++) {
            const v = Math.min(1, Math.max(0, (dist[p] - t0) / (t1 - t0)));
            px[i] = mix(px[i], scrim[0], alpha);
            px[i + 1] = mix(px[i + 1], scrim[1], alpha);
            px[i + 2] = mix(px[i + 2], scrim[2], alpha);
            px[i + 3] = Math.round(255 * v * v * (3 - 2 * v));
          }
          ctx.putImageData(data, 0, 0);
          canvas.toBlob((blob) => {
            if (!blob || !stageRef.current || run !== runRef.current) return;
            const url = URL.createObjectURL(blob);
            const fuse = fuseRef.current;
            if (fuse) {
              fuse.style.backgroundSize = `${b.width}px ${b.height}px`;
              fuse.style.backgroundPosition = `${b.left - t.left}px ${b.top - t.top}px`;
            }
            stageRef.current.style.setProperty("--a-fuse-img", `url("${url}")`);
            stageRef.current.dataset.fuseCover = ((covered / total) * 100).toFixed(1);
            if (blobRef.current) URL.revokeObjectURL(blobRef.current);
            blobRef.current = url;
          });
        });
    };
    applyRef.current();
  }, [theme]);

  useEffect(
    () => () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    },
    [],
  );

  // ── 4. Profundidad con el puntero (solo ratón, solo con movimiento) ─────
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || reducedMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0, x = 0, y = 0;
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      x = ((e.clientX - r.left) / r.width) * 2 - 1;
      y = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          stage.style.setProperty("--a-px", x.toFixed(3));
          stage.style.setProperty("--a-py", y.toFixed(3));
        });
      }
    };
    const onLeave = () => {
      stage.style.setProperty("--a-px", "0");
      stage.style.setProperty("--a-py", "0");
    };
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  }, [reducedMotion]);

  const style = {
    "--a-wdth": wdth,
    "--a-k": (86 / (Math.max(longest, Math.ceil(len / 2)) * 0.6 * (wdth / 100))).toFixed(2),
  } as React.CSSProperties;

  return (
    <header
      ref={stageRef}
      className="a-stage"
      data-shape={cover ? (piece ? "piece" : cover.shape) : "none"}
      data-ink="light"
      data-fuse={fuse ? "on" : "off"}
      style={style}
    >
      {cover && !piece && (
        <div className="a-back" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Mismo modo CORS que la portada: si no, la caché del navegador sirve la copia sin CORS al canvas. */}
          <img src={cover.small} alt="" decoding="async" crossOrigin={cover.canvasSafe ? "anonymous" : undefined} />
        </div>
      )}
      {!piece && <div className="a-backscrim" aria-hidden="true" />}
      <div className="a-rise">
        <div className="a-plane">
          {cover && (
            <div ref={boxRef} className="a-coverbox">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                data-kp-cover=""
                className="a-cover"
                src={cover.src}
                srcSet={cover.srcSet}
                sizes={piece ? "(min-width: 720px) 40vh, 72vw" : "100vw"}
                alt=""
                fetchPriority="high"
                crossOrigin={cover.canvasSafe ? "anonymous" : undefined}
              />
            </div>
          )}
          <h1 ref={titleRef} className="a-title" lang={titleLang}>
            <span className="a-title-text">{title}</span>
            {!piece && (
              <span ref={fuseRef} className="a-fuse" aria-hidden="true">
                {title}
              </span>
            )}
          </h1>
        </div>
      </div>
      {!piece && (
        <button
          type="button"
          className="a-fuse-toggle"
          aria-pressed={fuse}
          onClick={() => setFuse((v) => !v)}
        >
          {fuseLabel}
        </button>
      )}
    </header>
  );
}
