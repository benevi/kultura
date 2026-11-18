"use client";

// Dirección A «Sala» — la sala: la portada a pantalla completa y el título
// dentro de ella. El HTML del servidor ya trae el `h1` y la portada; este
// componente solo añade, en el navegador:
//   1. el velo justo para que el título cumpla contraste sobre ESTA portada,
//   2. el encaje del título (tamaño hasta llenar el ancho en pocas líneas),
//   3. las letras fundidas: las partes de la portada que destacan del fondo
//      pasan por delante de las letras (capa de adorno, `aria-hidden`),
//   4. la profundidad en 2D al mover el puntero.
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
/** Como mucho, esta parte de la zona del título puede quedar tapada por la portada. */
const FUSE_MAX_COVERAGE = 0.22;

const parseHex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mix = (px: number, s: number, a: number) => px * (1 - a) + s * a;

interface Analysis {
  /** Imagen legible por canvas (la mostrada o la miniatura). */
  img: HTMLImageElement;
  /** Píxeles reducidos, para el velo. */
  small: ImageData;
  dominant: RGB;
  light: { scrim: RGB; ink: RGB; alpha: number }; // tinta clara sobre velo oscuro
  dark: { scrim: RGB; ink: RGB; alpha: number }; // tinta oscura sobre velo claro
}

/** Velo mínimo para que `ink` tenga `TITLE_RATIO` sobre el 98 % de los píxeles de la portada. */
function minAlpha(px: Uint8ClampedArray, scrim: RGB, ink: RGB): number {
  const ok = (a: number) => {
    let bad = 0;
    const n = px.length / 4;
    for (let i = 0; i < px.length; i += 4) {
      const c: RGB = [mix(px[i], scrim[0], a), mix(px[i + 1], scrim[1], a), mix(px[i + 2], scrim[2], a)];
      if (contrast(ink, c) < TITLE_RATIO) bad++;
    }
    return bad / n <= 0.02;
  };
  let lo = 0.12, hi = 0.94;
  if (ok(lo)) return lo;
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
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
  /** Texto del interruptor de prueba «Letras fundidas». */
  fuseLabel: string;
}

export function Stage({ title, titleLang, cover, fuseLabel }: StageProps) {
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

  // Estimación del servidor para el primer pintado (el encaje real va después).
  const words = title.split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length));
  const len = title.length;
  const wdth = len <= 6 ? 135 : len <= 10 ? 112 : len <= 16 ? 94 : len <= 28 ? 80 : 68;

  // ── 2. Encaje del título y 3b. posición de la capa fundida ──────────────
  const layout = () => {
    const stage = stageRef.current, h1 = titleRef.current, box = boxRef.current, fuse = fuseRef.current;
    if (!stage || !h1) return;
    const desktop = window.matchMedia("(min-width: 720px)").matches;
    const maxLines = desktop ? 2 : 3;
    const stageH = stage.clientHeight;
    const maxFs = desktop ? Math.min(stageH * 0.36, 320) : 132;
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
      h1.style.fontSize = `${Math.floor(lo)}px`;
    }
    // Velo: macizo detrás de todo el título, y se desvanece por encima.
    const s = stage.getBoundingClientRect(), t = h1.getBoundingClientRect();
    stage.style.setProperty("--a-band", `${Math.round(s.bottom - t.top + 20)}px`);
    if (box) {
      const b = box.getBoundingClientRect();
      stage.style.setProperty("--a-band-cover", `${Math.max(0, Math.round(b.bottom - t.top + 20))}px`);
      if (fuse) {
        fuse.style.backgroundSize = `${b.width}px ${b.height}px`;
        fuse.style.backgroundPosition = `${b.left - t.left}px ${b.top - t.top}px`;
      }
    }
  };

  useIsoLayoutEffect(() => {
    layout();
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => {
      layout();
      applyRef.current();
    });
    ro.observe(stage);
    document.fonts?.ready.then(layout).catch(() => {});
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // ── 1. Análisis de la portada (una vez) ─────────────────────────────────
  useEffect(() => {
    if (!cover) return;
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
      const lightInk = { scrim: parseHex(palette.dark.bg), ink: parseHex(palette.dark.ink) };
      const darkInk = { scrim: parseHex(palette.light.bg), ink: parseHex(palette.light.ink) };
      analysisRef.current = {
        img,
        small,
        dominant: swatches[0]?.rgb ?? [128, 128, 128],
        light: { ...lightInk, alpha: minAlpha(small.data, lightInk.scrim, lightInk.ink) },
        dark: { ...darkInk, alpha: minAlpha(small.data, darkInk.scrim, darkInk.ink) },
      };
      layout();
      applyRef.current();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover?.original]);

  // ── 1b + 3. Velo y capa fundida según el tema ───────────────────────────
  useEffect(() => {
    applyRef.current = () => {
      const a = analysisRef.current, stage = stageRef.current, box = boxRef.current;
      if (!a || !stage || !theme) return;
      // Manda la portada, no el tema: tinta clara sobre velo oscuro (se lee como
      // sombra) salvo que la portada sea clara y la tinta oscura necesite bastante
      // menos velo (un velo claro sobre una portada oscura la deja lechosa).
      const pick = a.dark.alpha < a.light.alpha - 0.1 ? "dark" : "light";
      const { scrim, ink, alpha } = a[pick];
      stage.dataset.ink = pick;
      stage.style.setProperty("--a-scrim", scrim.join(" "));
      stage.style.setProperty("--a-scrim-a", alpha.toFixed(3));
      stage.style.setProperty("--a-ink", `rgb(${ink.join(" ")})`);

      // Capa fundida: la portada recortada como se ve, con el mismo velo, y
      // opaca solo donde se aparta del color de fondo dominante.
      if (!box) return;
      const b = box.getBoundingClientRect();
      if (!b.width || !b.height) return;
      const { img } = a;
      const cw = 360, ch = Math.max(1, Math.round((cw * b.height) / b.width));
      const boxAr = b.width / b.height, imgAr = img.naturalWidth / img.naturalHeight;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (imgAr > boxAr) {
        sw = sh * boxAr;
        sx = (img.naturalWidth - sw) / 2;
      } else {
        sh = sw / boxAr;
        sy = (img.naturalHeight - sh) / 2;
      }
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      let data: ImageData;
      try {
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
        data = ctx.getImageData(0, 0, cw, ch);
      } catch {
        return;
      }
      const px = data.data;
      const hist = new Uint32Array(64);
      // Filas de la portada que quedan detrás del título (si no se sabe, la mitad baja).
      const tr = titleRef.current?.getBoundingClientRect();
      const top = tr ? Math.min(0.9, Math.max(0, (tr.top - b.top) / b.height)) : 0.5;
      const zoneStart = Math.floor(ch * top) * cw;
      // «Fondo» = el color que más hay DETRÁS del título (no el de toda la portada).
      const zoneMain = extractSwatches(px.subarray(zoneStart * 4), 1)[0]?.rgb ?? a.dominant;
      const dom = rgbToOklab(zoneMain);
      const dist = new Float32Array(cw * ch);
      // Umbral: en la zona del título no se tapa más de FUSE_MAX_COVERAGE.
      let zone = 0;
      for (let i = 0, p = 0; i < px.length; i += 4, p++) {
        const lab = rgbToOklab([px[i], px[i + 1], px[i + 2]]);
        const d = Math.hypot(lab[0] - dom[0], lab[1] - dom[1], lab[2] - dom[2]);
        dist[p] = d;
        if (p >= zoneStart) {
          hist[Math.min(63, Math.floor(d * 100))]++;
          zone++;
        }
      }
      let acc = 0, cut = 63;
      for (let k = 63; k >= 0; k--) {
        acc += hist[k];
        if (acc / zone > FUSE_MAX_COVERAGE) {
          cut = k + 1;
          break;
        }
        cut = k;
      }
      // La rampa va por ENCIMA del corte: lo tapado nunca pasa del límite.
      const t0 = Math.max(0.14, cut / 100), t1 = t0 + 0.035;
      for (let i = 0, p = 0; i < px.length; i += 4, p++) {
        const k = Math.min(1, Math.max(0, (dist[p] - t0) / (t1 - t0)));
        px[i] = mix(px[i], scrim[0], alpha);
        px[i + 1] = mix(px[i + 1], scrim[1], alpha);
        px[i + 2] = mix(px[i + 2], scrim[2], alpha);
        px[i + 3] = Math.round(255 * k * k * (3 - 2 * k));
      }
      ctx.putImageData(data, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob || !stageRef.current) return;
        const url = URL.createObjectURL(blob);
        stageRef.current.style.setProperty("--a-fuse-img", `url("${url}")`);
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        blobRef.current = url;
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
      data-shape={cover?.shape ?? "none"}
      data-ink="light"
      data-fuse={fuse ? "on" : "off"}
      style={style}
    >
      {cover && (
        <div className="a-back" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Mismo modo CORS que la portada: si no, la caché del navegador sirve la copia sin CORS al canvas. */}
          <img src={cover.small} alt="" decoding="async" crossOrigin={cover.canvasSafe ? "anonymous" : undefined} />
        </div>
      )}
      <div className="a-backscrim" aria-hidden="true" />
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
                sizes={cover.shape === "landscape" ? "100vw" : "(min-width: 720px) 60vh, 100vw"}
                alt=""
                fetchPriority="high"
                crossOrigin={cover.canvasSafe ? "anonymous" : undefined}
              />
            </div>
          )}
          <h1 ref={titleRef} className="a-title" lang={titleLang}>
            <span className="a-title-text">{title}</span>
            <span ref={fuseRef} className="a-fuse" aria-hidden="true">
              {title}
            </span>
          </h1>
        </div>
      </div>
      {cover && (
        <button type="button" className="a-fuse-toggle" aria-pressed={fuse} onClick={() => setFuse((v) => !v)}>
          {fuseLabel}
        </button>
      )}
    </header>
  );
}
