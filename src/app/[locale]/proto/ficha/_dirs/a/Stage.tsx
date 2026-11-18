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
import { DEPTH } from "./sala3d/depth";
// Solo tipos: el motor 3D se carga con `import()` cuando hace falta.
import type { SalaHandle, Stats, Tone3D } from "./sala3d/engine";

type Mode3D = "off" | "capas" | "fondo";

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
function readBehind(img: HTMLImageElement, s: Box, t: Box, b: Box | null, pad = 2): Behind | null {
  const behind = new Behind();
  try {
    if (b) {
      const l = Math.max(t.left - pad, b.left), r = Math.min(t.right + pad, b.right);
      const top = Math.max(t.top - pad, b.top), bot = Math.min(t.bottom + pad, b.bottom);
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
  /** El lienzo pintado (la capa 3D lo usa como textura del título). */
  canvas: HTMLCanvasElement;
  /** Pintada con la fuente real; si no, son las cajas de los caracteres. */
  exact: boolean;
  a: Uint8ClampedArray;
  w: number;
  h: number;
  /** Fila (en píxeles de la máscara) donde empieza cada línea del título. */
  lines: number[];
  /** Caja de cada carácter (píxeles de la máscara): x, y, ancho, alto. */
  chars: [number, number, number, number][];
  /** Otro lienzo igual, solo con las letras marcadas (mismo orden que `chars`). */
  subset(ok: boolean[]): HTMLCanvasElement;
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
  const chars: [number, number, number, number][] = [];
  const ops: ((c: CanvasRenderingContext2D) => void)[] = [];
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i) ?? 32);
    if (ch.trim()) {
      range.setStart(node, i);
      range.setEnd(node, i + ch.length);
      const r = range.getClientRects()[0];
      if (r && r.width) {
        const y = Math.round((r.top - t.top) * k);
        if (!lines.some((l) => Math.abs(l - y) < 3)) lines.push(y);
        chars.push([Math.floor((r.left - t.left) * k), y, Math.ceil(r.width * k), Math.ceil(r.height * k)]);
        const x = (r.left - t.left) * k, yy = (r.top - t.top) * k, rw = r.width * k, rh = r.height * k;
        const op = fam && Number.isFinite(asc)
          ? (c2: CanvasRenderingContext2D) => c2.fillText(ch, x, yy + asc)
          : (c2: CanvasRenderingContext2D) => c2.fillRect(x, yy, rw, rh); // sin la fuente: la caja del carácter
        ops.push(op);
        op(ctx);
      }
    }
    i += ch.length;
  }
  lines.sort((x, y) => x - y);
  return {
    canvas: c.canvas,
    exact: Boolean(fam && Number.isFinite(asc)),
    a: ctx.getImageData(0, 0, c.canvas.width, c.canvas.height).data,
    w: c.canvas.width,
    h: c.canvas.height,
    lines,
    chars,
    subset(ok) {
      const s = canvas2d(c.canvas.width, c.canvas.height);
      if (!s) return c.canvas;
      s.ctx.font = ctx.font;
      s.ctx.textBaseline = "alphabetic";
      s.ctx.fillStyle = "#000";
      ops.forEach((op, i) => ok[i] && op(s.ctx));
      return s.canvas;
    },
  };
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
  /** `tipo/id externo`: clave de los mapas de profundidad del prototipo. */
  depthKey: string;
  /** Manga: el lomo va a la derecha. */
  spineRight: boolean;
  es: boolean;
}

export function Stage({
  title,
  titleLang,
  cover,
  mode,
  fuseLabel,
  depthKey,
  spineRight,
  es,
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
  const refreshRef = useRef<() => void>(() => {});
  const runRef = useRef(0);
  // Capa 3D (`?3d=capas|fondo`): ver sala3d/engine.ts.
  const planeRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SalaHandle | null>(null);
  const toneRef = useRef<Omit<Tone3D, "band" | "bandLo"> | null>(null);
  const bandRef = useRef(0);
  const bandLoRef = useRef(0);
  const mode3dRef = useRef<Mode3D>("off");

  const fpsRef = useRef<HTMLDivElement>(null);
  const [mode3d, setMode3d] = useState<Mode3D>("off");
  const [state3d, setState3d] = useState<{ on: boolean; why?: string }>({ on: false });
  const [flags, setFlags] = useState({ fps: false, loop: false, gl: false, gyro: false });
  const [gyroOn, setGyroOn] = useState(false);
  const [gyroNote, setGyroNote] = useState("");
  const [campo, setCampo] = useState<"1" | "2">("1");

  mode3dRef.current = mode3d;

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
    // En móvil el título va DENTRO de la imagen (no a caballo de su borde): dos líneas como mucho.
    const maxLines = desktop || !piece ? 2 : 3;
    const stageH = stage.clientHeight;
    // Con la portada como pieza, el título cede alto a la portada.
    const maxFs = desktop ? Math.min(stageH * (piece ? 0.24 : 0.36), piece ? 240 : 320) : piece ? 132 : 112;
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
      bandRef.current = Math.max(0, Math.round(b.bottom - t.top + 20));
      stage.style.setProperty("--a-band-cover", `${bandRef.current}px`);
      // Por debajo del título (si está subido) el velo se aclara: no hace falta ahí.
      bandLoRef.current = Math.max(0, Math.round(b.bottom - t.bottom - 16));
      stage.style.setProperty("--a-band-lo", `${bandLoRef.current}px`);
    }
  };

  // Cualquier cambio de tamaño (o de fuente) vuelve a encajar el título y a
  // calcular velo y fundido: el tope se cumple en cualquier ancho.
  const refresh = () => {
    layout();
    applyRef.current();
    engineRef.current?.sync();
  };
  refreshRef.current = refresh;
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
  }, [title, mode3d]);

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
      const { img } = a;
      // Mientras la imagen cambia de archivo (llega la versión mayor) no hay píxeles
      // que leer: un lienzo vacío daría un velo mínimo. Se espera al siguiente aviso.
      if (!img.complete || !img.naturalWidth) return;
      const run = ++runRef.current;
      const s = stage.getBoundingClientRect(), t = h1.getBoundingClientRect();
      const b = box?.getBoundingClientRect() ?? null;

      // 1b. Velo: el mínimo para que TODA la letra tenga contraste con lo que
      // tiene detrás a este ancho (la portada y la copia borrosa del fondo).
      // Con la capa 3D la imagen se mueve bajo el título (parallax y acercamiento, hasta
      // ~40 px en una pantalla ancha): el velo se calcula con todo lo que puede llegar a quedar detrás.
      const behind = readBehind(img, s, t, b && b.width && b.height ? b : null, mode3dRef.current === "off" ? 2 : 44);
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
      toneRef.current = { scrim, ink, alpha, pick };
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

  // ── 4b. Carga segura de la imagen ───────────────────────────────────────
  // (1) Si la imagen falla: se esconde (queda el campo de color, nunca el icono
  //     roto), se reintenta con espera y, si sigue fallando, se baja a un tamaño
  //     menor. (2) Cuando la página ya está cargada y la pantalla pide más de lo
  //     que hay, se trae la versión mayor EN SERIE (nunca a la vez que la primera:
  //     MangaDex corta la conexión con dos descargas simultáneas) y se cambia sin
  //     parpadeo. Si la mayor falla, se queda la que ya se ve.
  useEffect(() => {
    const img = imgRef.current, stage = stageRef.current;
    if (!img || !stage || !cover) return;
    const smaller = (cover.srcSet || "").split(",").map((c) => c.trim().split(/\s+/)[0]).filter(Boolean).reverse();
    const chain = [cover.src, ...smaller.filter((u) => u !== cover.src), cover.small].filter((u, i, a) => a.indexOf(u) === i);
    let step = 0, tries = 0, dead = false, upgraded = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(() => !dead && fn(), ms));
    const setSrc = (url: string) => {
      // Un solo candidato en `srcset` y el mismo en `src`: el navegador no pasa por
      // ninguna URL intermedia (quitar el `srcset` le hacía pedir otra y cancelarla).
      if (img.hasAttribute("srcset")) img.srcset = url;
      img.src = url;
    };
    const onError = () => {
      if (dead) return;
      img.style.visibility = "hidden";
      stage.dataset.img = "retry";
      if (tries < 2) {
        tries++;
        later(() => setSrc(chain[step]), tries === 1 ? 800 : 2500);
      } else if (step + 1 < chain.length) {
        step++;
        tries = 0;
        setSrc(chain[step]);
      } else {
        stage.dataset.img = "failed"; // se queda el campo de color con el título
      }
    };
    const upgrade = async () => {
      if (upgraded || dead || cover.hi === img.currentSrc || step > 0) return;
      const r = img.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      // ¿Hace falta? Lo que se ve (× DPR) frente a los píxeles reales del archivo actual.
      let real = 0;
      try {
        const bmp = await createImageBitmap(img);
        real = bmp.width;
        bmp.close();
      } catch {
        return;
      }
      const ar = img.naturalWidth / Math.max(1, img.naturalHeight);
      const shownW = piece ? r.width : Math.max(r.width, r.height * ar);
      if (dead || shownW * dpr <= real * 1.02) return;
      upgraded = true;
      for (let attempt = 0; attempt < 2 && !dead; attempt++) {
        const ok = await new Promise<boolean>((resolve) => {
          const big = new Image();
          if (cover.canvasSafe) big.crossOrigin = "anonymous";
          big.onload = () => resolve(big.naturalWidth > 0);
          big.onerror = () => resolve(false);
          big.src = cover.hi;
        });
        if (ok && !dead) {
          setSrc(cover.hi); // ya está en caché: el cambio es inmediato
          stage.dataset.img = "hi";
          await img.decode().catch(() => {});
          if (dead) return;
          refreshRef.current(); // velo y fundido, con los píxeles definitivos
          engineRef.current?.reloadImage();
          return;
        }
        await new Promise((res) => setTimeout(res, 3000));
      }
    };
    const onLoad = () => {
      if (dead) return;
      img.style.visibility = "";
      if (stage.dataset.img === "retry") stage.dataset.img = "ok";
      if (document.readyState === "complete") later(upgrade, 300);
      else window.addEventListener("load", () => later(upgrade, 300), { once: true });
    };
    img.addEventListener("error", onError);
    img.addEventListener("load", onLoad);
    if (img.complete) {
      if (img.naturalWidth) onLoad();
      else onError(); // falló antes de que llegara este script
    }
    return () => {
      dead = true;
      timers.forEach((t) => clearTimeout(t));
      img.removeEventListener("error", onError);
      img.removeEventListener("load", onLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover?.original]);

  // ── 5. Capa 3D (prototipo P-3D) ─────────────────────────────────────────
  // `?3d=capas` (sin mapa de profundidad) o `?3d=fondo` (con mapa). `?fps=1`
  // enseña el contador; `?loop=1` fuerza la deriva automática (para medir) y
  // `?gl=1` acepta una GPU por software (pruebas).
  useIsoLayoutEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const m = q.get("3d");
    if (m === "capas" || m === "fondo") setMode3d(m);
    if (q.get("campo") === "2") setCampo("2");
    setFlags({
      fps: q.get("fps") === "1",
      loop: q.get("loop") === "1",
      gl: q.get("gl") === "1",
      gyro: "DeviceOrientationEvent" in window && window.matchMedia("(pointer: coarse)").matches,
    });
  }, []);

  const pick3d = (m: Mode3D) => {
    setMode3d(m);
    const url = new URL(window.location.href);
    if (m === "off") url.searchParams.delete("3d");
    else url.searchParams.set("3d", m);
    window.history.replaceState(null, "", url);
  };

  const depth = DEPTH[depthKey] ?? null;
  // Pieza con movimiento reducido: girar es todo lo que añade el 3D → se queda el 2D.
  const skip3d = piece && reducedMotion;
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    const stage = stageRef.current, plane = planeRef.current, box = boxRef.current, img = imgRef.current, h1 = titleRef.current;
    if (mode3d === "off" || !cover || !stage || !plane || !box || !img || !h1) return;
    const off = (why: string) => setState3d({ on: false, why });
    if (skip3d) return off(es ? "movimiento reducido" : "reduced motion");
    if (!cover.canvasSafe) return off(es ? "imagen sin CORS" : "image without CORS");
    if (mode3d === "fondo" && !depth && !piece) return off(es ? "esta obra no tiene mapa" : "no depth map for this title");
    // Contraste alto o colores forzados: manda el texto real, sin capa encima.
    if (!piece && window.matchMedia("(prefers-contrast: more), (forced-colors: active)").matches) return off("contraste");
    let dead = false;
    let handle: SalaHandle | null = null;
    const canvas = document.createElement("canvas");
    canvas.className = "a-3d";
    canvas.setAttribute("aria-hidden", "true");
    let lastFps = 0;
    (async () => {
      // Después de que la página sea usable: `load`, un rato libre y las entradas acabadas.
      if (document.readyState !== "complete") await new Promise((r) => window.addEventListener("load", r, { once: true }));
      await new Promise<void>((r) => {
        const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
        if (ric) ric(() => r(), { timeout: 1500 });
        else setTimeout(r, 200);
      });
      await Promise.all(
        stage
          .getAnimations({ subtree: true })
          .filter((a) => /^a-(cover|title)-in$/.test((a as CSSAnimation).animationName ?? ""))
          .map((a) => a.finished.catch(() => {})),
      );
      if (!(await waitImage(img)) || dead) return;
      performance.mark("kp3d:start");
      const { mountSala } = await import("./sala3d/engine");
      if (dead) return;
      plane.appendChild(canvas);
      handle = await mountSala({
        kind: piece ? "piece" : "wide",
        mode: mode3d,
        spineRight,
        stage, box, img, h1, canvas, depth,
        getTone: () => (toneRef.current ? { ...toneRef.current, band: bandRef.current, bandLo: bandLoRef.current } : null),
        titleMask: (k) => glyphMask(h1, h1.querySelector(".a-title-text"), k),
        reduced: reducedRef.current,
        forceLoop: flags.loop,
        forceGl: flags.gl,
        onState: (on, why) => {
          if (dead) return;
          if (on) stage.dataset.k3dOn = piece ? "piece" : "wide";
          else delete stage.dataset.k3dOn;
          setState3d({ on, why });
        },
        onStats: flags.fps
          ? (st: Stats) => {
              const now = performance.now();
              if (now - lastFps < 400 || !fpsRef.current) return;
              lastFps = now;
              fpsRef.current.textContent =
                `${st.moving ? st.fps.toFixed(0) : "–"} fps · p95 ${st.p95.toFixed(1)} ms · largos ${st.long}/${st.frames}` +
                `\ncpu ${st.cpu.toFixed(2)} ms · dpr ${st.dpr} · tex ${st.texMB.toFixed(1)} MB · tapado ${(st.cover * 100).toFixed(0)} %` +
                `\n${st.renderer.replace(/^ANGLE \(|\)$/g, "").slice(0, 70)}`;
            }
          : undefined,
      });
      if (!handle) canvas.remove(); // sin 3D: no queda nada suyo en la página
      if (dead) handle?.destroy();
      else {
        engineRef.current = handle;
        (window as unknown as { __kp3d?: SalaHandle | null }).__kp3d = handle;
      }
    })();
    return () => {
      dead = true;
      (handle ?? engineRef.current)?.destroy();
      engineRef.current = null;
      (window as unknown as { __kp3d?: SalaHandle | null }).__kp3d = null;
      canvas.remove();
      delete stage.dataset.k3dOn;
      setState3d({ on: false });
      setGyroOn(false);
      setGyroNote("");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode3d, skip3d, cover?.original, flags.loop, flags.gl, flags.fps]);

  useEffect(() => {
    reducedRef.current = reducedMotion;
    engineRef.current?.setReduced(reducedMotion);
    if (reducedMotion) {
      engineRef.current?.disableGyro();
      setGyroOn(false);
    }
  }, [reducedMotion]);

  // Giroscopio: solo tras pulsar, y con permiso donde el sistema lo pide (iOS 13+:
  // `requestPermission()` tiene que salir de un toque). Android no pide permiso.
  // Los sensores exigen contexto seguro (HTTPS o localhost). Nunca hace falta:
  // sin sensor, sin permiso o sin HTTPS queda el parallax por scroll y la deriva.
  const askGyro = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (gyroOn) {
      engine.disableGyro();
      setGyroOn(false);
      return;
    }
    const no = (why: string) => setGyroNote(why);
    setGyroNote("");
    if (!window.isSecureContext) return no(es ? "El sensor necesita HTTPS." : "The sensor needs HTTPS.");
    try {
      const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof D?.requestPermission === "function" && (await D.requestPermission()) !== "granted") {
        return no(es ? "Sin permiso para el sensor de movimiento." : "Motion sensor permission denied.");
      }
      if (await engine.enableGyro()) setGyroOn(true);
      else no(es ? "Este dispositivo no da datos de orientación." : "This device gives no orientation data.");
    } catch {
      no(es ? "Sin permiso para el sensor de movimiento." : "Motion sensor permission denied.");
    }
  };

  const style = {
    // Tope de ampliación: la sala no pasa de 1,25× el tamaño natural de su imagen.
    ...(!piece && cover?.natural ? { "--a-max-w": `${Math.round(cover.natural.w * 1.25)}px`, "--a-max-h": `${Math.round(cover.natural.h * 1.25)}px` } : null),
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
      data-campo={piece ? campo : undefined}
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
        <div ref={planeRef} className="a-plane">
          {cover && (
            <div ref={boxRef} className="a-coverbox">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                data-kp-cover=""
                className="a-cover"
                // Pieza: una sola URL, sin `srcset`: el tamaño natural del `<img>` es el real
                // y el CSS (`width: auto`) no puede ampliarla. Sala: el navegador elige entre
                // tamaños razonables; en móvil la imagen se ve más ancha que la pantalla
                // (recorte 4:5), y `sizes` lo dice. La versión mayor (`cover.hi`) llega
                // después, sin competir con la primera carga (ver «Carga segura»).
                src={cover.src}
                srcSet={piece ? undefined : cover.srcSet}
                sizes={piece ? undefined : `(min-width: 720px) 100vw, ${Math.round(125 * (cover.natural ? cover.natural.w / cover.natural.h : 16 / 9))}vw`}
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
      {/* Controles del prototipo (no son parte del diseño). */}
      <div className="a-tools">
        {cover && (
          <div className="a-3d-pick" role="group" aria-label={es ? "Capa 3D" : "3D layer"}>
            {(["off", "capas", "fondo"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode3d === m} onClick={() => pick3d(m)}>
                {m === "off" ? "2D" : m === "capas" ? (es ? "3D capas" : "3D layers") : es ? "3D fondo" : "3D depth"}
              </button>
            ))}
          </div>
        )}
        {!piece && mode3d === "off" && (
          <button type="button" className="a-fuse-toggle" aria-pressed={fuse} onClick={() => setFuse((v) => !v)}>
            {fuseLabel}
          </button>
        )}
        {mode3d !== "off" && state3d.on && flags.gyro && !reducedMotion && (
          <button type="button" className="a-fuse-toggle" aria-pressed={gyroOn} onClick={askGyro}>
            {es ? "Mover con el móvil" : "Move with the phone"}
          </button>
        )}
        {gyroNote && mode3d !== "off" && (
          <p className="a-3d-why" role="status">
            {gyroNote}
          </p>
        )}
        {mode3d !== "off" && !state3d.on && state3d.why && (
          <p className="a-3d-why" role="status">
            {es ? "3D no disponible: " : "3D unavailable: "}
            {state3d.why}
          </p>
        )}
      </div>
      {flags.fps && mode3d !== "off" && <div ref={fpsRef} className="a-fps" aria-hidden="true" />}
    </header>
  );
}
