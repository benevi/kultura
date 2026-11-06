// ============================================================
// KULTURA — Portadas de la fila de Entrar / Crear cuenta («El hueco»)
//
// Dos vueltas por los siete formatos con las imágenes de la semana. Lo que falte
// sale del respaldo fijo. `landing_media` no trae libros ni cómics: esos dos
// formatos tienen su propia imagen en `public/landing/fallback/`.
// ============================================================

import type { LandingMedia } from "./media";
import { FALLBACK_MEDIA } from "./scenes";

export const LOGIN_TOUR = ["movie", "tv", "anime", "manga", "game", "book", "comic"] as const;
export type LoginFormat = (typeof LOGIN_TOUR)[number];

export interface LoginCover {
  key: string;
  format: LoginFormat;
  title: string;
  /** «Película», «Serie»… ya traducido. */
  label: string;
  image: string;
  /** Sin mapa de profundidad la portada se pinta plana. */
  depth: string | null;
  width: number;
  height: number;
  threshold: number;
  focus: [number, number];
  /** Color del botón y de la palabra del formato. */
  scene: string;
  /** Fondo de la contraportada. */
  back: string;
}

const INK = "#f2f2f0";

/** Acento con cuerpo, sin neón y con contraste sobre tinta negra. Si no tiene color, tinta. */
export function sceneColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  const d = hi - lo;
  let l = (hi + lo) / 2;
  const s0 = d / (1 - Math.abs(2 * l - 1) || 1);
  if (d === 0 || s0 < 0.22) return INK;
  const h = hi === r ? ((g - b) / d + 6) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
  let hue = h * 60;
  let s = Math.min(Math.max(s0, 0.55), 0.72);
  // El violeta tampoco es de la marca: se lleva al azul frío más cercano.
  if (hue >= 235 && hue <= 300) hue = 222;
  // El terracota es un tono vetado por la marca: se lleva a un ámbar limpio.
  if (hue >= 6 && hue <= 31) {
    hue = 33;
    s = 0.9;
  }
  const rgb = (light: number) => {
    const H = hue / 60;
    const c = (1 - Math.abs(2 * light - 1)) * s;
    const x = c * (1 - Math.abs((H % 2) - 1));
    const m = light - c / 2;
    return [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(H)].map((v) => v + m);
  };
  const lum = (c: number[]) => {
    const [R, G, B] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };
  l = Math.min(Math.max(l, 0.5), 0.6);
  while (l < 0.85 && (lum(rgb(l)) + 0.05) / 0.053 < 6.2) l += 0.01;
  return `rgb(${rgb(l).map((v) => Math.round(v * 255)).join(",")})`;
}

type Source = Pick<LandingMedia, "type" | "title" | "image" | "depth" | "width" | "height" | "threshold" | "focus" | "accent">;

const PRINT_FALLBACK: (Omit<Source, "depth"> & { depth: string | null })[] = [
  { type: "book", title: "Project Hail Mary", image: "/landing/fallback/book-0.jpg", depth: null, width: 325, height: 500, threshold: 0.5, focus: [0.5, 0.5], accent: "#e0531d" },
  { type: "comic", title: "Watchmen", image: "/landing/fallback/comic-0.jpg", depth: null, width: 265, height: 400, threshold: 0.5, focus: [0.5, 0.5], accent: "#e0c23a" },
];

function toCover(m: Omit<Source, "depth"> & { depth: string | null }, format: LoginFormat, label: string, round: number): LoginCover {
  const scene = sceneColor(m.accent);
  return {
    key: `${format}-${round}-${m.image}`,
    format,
    title: m.title,
    label,
    image: m.image,
    depth: m.depth,
    width: m.width,
    height: m.height,
    threshold: m.threshold,
    focus: m.focus,
    scene,
    back: scene === INK ? "#1f1f1f" : `color-mix(in srgb, ${scene} 34%, #0a0a0a)`,
  };
}

/** Dos vueltas a los siete formatos; donde hay más de una obra, sin repetir. */
export function buildLoginCovers(media: LandingMedia[], labels: Record<LoginFormat, string>): LoginCover[] {
  const covers: LoginCover[] = [];
  for (const round of [0, 1]) {
    for (const format of LOGIN_TOUR) {
      const seen = new Set<string>();
      const pool = [...media, ...FALLBACK_MEDIA, ...PRINT_FALLBACK].filter((m) => {
        if (m.type !== format || seen.has(m.image)) return false;
        seen.add(m.image);
        return true;
      });
      if (pool.length) covers.push(toCover(pool[round % pool.length], format, labels[format], round));
    }
  }
  return covers;
}
