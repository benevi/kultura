"use client";

// Dirección C «Pliego» — la ventana de la portada.
// · Marco fijo 4:5; la portada es algo mayor y deriva despacio dentro (CSS,
//   propiedades registradas en c.css). Con ratón, se recoloca hacia el puntero.
// · Botón de pausa propio (WCAG 2.2.2) además del interruptor de la base.
// · Si hay tráiler, la ventana es un botón: al pulsarla (clic, toque, Intro) se
//   monta en el mismo marco el reproductor de youtube-nocookie, en silencio,
//   con sus controles y su marca, y sin nada encima. Antes de pulsar no se pide
//   nada a YouTube. Escape o «Volver a la portada» lo cierran y el foco vuelve.
// · Afina el acento de la portada contra el suelo neutro de C (los tokens de la
//   base garantizan el contraste contra SU fondo teñido, no contra este).

import { useCallback, useEffect, useRef, useState } from "react";
import { contrast, hex, lchToRgb, rgbToLch, type RGB } from "../../_base/color";
import { COVER_EVENT } from "../../_base/CoverColor";
import type { CoverPalette } from "../../_base/cover-palette";
import { useProto } from "../../_base/ProtoShell";
import type { CoverSource } from "../../_base/types";

// Suelo y panel de C (los mismos valores que c.css).
const GROUND: Record<"l" | "d", RGB[]> = {
  l: [[216, 215, 210], [204, 203, 197]],
  d: [[28, 29, 31], [39, 40, 43]],
};
const PAPER: RGB = [243, 242, 238];
const INK: RGB = [27, 27, 25];

const parseHex = (h: string): RGB | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

/** Mueve la luminosidad del acento hasta 4.5:1 contra el suelo de C y contra su propio texto. */
function fitAccent(start: RGB, mode: "l" | "d"): { fill: RGB; ink: RGB } {
  let lch = rgbToLch(start);
  const step = mode === "l" ? -0.01 : 0.01;
  for (let i = 0; i < 100; i++) {
    const fill = lchToRgb(lch);
    const onPaper = contrast(PAPER, fill), onInk = contrast(INK, fill);
    if (GROUND[mode].every((g) => contrast(fill, g) >= 4.5) && Math.max(onPaper, onInk) >= 4.5) {
      return { fill, ink: onPaper >= onInk ? PAPER : INK };
    }
    const l = lch.l + step;
    if (l < 0 || l > 1) break;
    lch = { ...lch, l };
  }
  return mode === "l" ? { fill: INK, ink: PAPER } : { fill: PAPER, ink: INK };
}

const ACCENT_VARS = ["--c-accent-l", "--c-accent-ink-l", "--c-accent-d", "--c-accent-ink-d"];

interface Props {
  cover: CoverSource;
  title: string;
  trailerKey?: string;
  locale: string;
}

export function Ventana({ cover, title, trailerKey, locale }: Props) {
  const { reducedMotion } = useProto();
  const es = locale !== "en";
  const winRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const shotRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasPlaying = useRef(false);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);

  // Acento de la portada, ajustado al suelo de C.
  useEffect(() => {
    const root = winRef.current?.closest<HTMLElement>(".kp");
    if (!root) return;
    const apply = (light: string | undefined, dark: string | undefined, neutral: boolean) => {
      const l = light && !neutral ? parseHex(light) : null;
      const d = dark && !neutral ? parseHex(dark) : null;
      if (!l || !d) {
        for (const v of ACCENT_VARS) root.style.removeProperty(v);
        return;
      }
      const fl = fitAccent(l, "l"), fd = fitAccent(d, "d");
      root.style.setProperty("--c-accent-l", hex(fl.fill));
      root.style.setProperty("--c-accent-ink-l", hex(fl.ink));
      root.style.setProperty("--c-accent-d", hex(fd.fill));
      root.style.setProperty("--c-accent-ink-d", hex(fd.ink));
    };
    const onCover = (e: Event) => {
      const p = (e as CustomEvent<CoverPalette | null>).detail;
      apply(p?.light.accent, p?.dark.accent, !p || p.neutral);
    };
    root.addEventListener(COVER_EVENT, onCover);
    // Por si la base ya había leído la portada antes de montar esto.
    if (root.dataset.cover === "color") {
      apply(root.style.getPropertyValue("--cv-accent-l"), root.style.getPropertyValue("--cv-accent-d"), false);
    }
    return () => {
      root.removeEventListener(COVER_EVENT, onCover);
      for (const v of ACCENT_VARS) root.style.removeProperty(v);
    };
  }, []);

  // Foco: al abrir, a «Volver a la portada» (fuera del marco: Escape sigue
  // llegando a la página); al cerrar, de vuelta a la ventana.
  useEffect(() => {
    if (playing) closeRef.current?.focus();
    else if (wasPlaying.current) shotRef.current?.focus();
    wasPlaying.current = playing;
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlaying(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  // Con ratón, la imagen se recoloca hacia el puntero (y la deriva espera).
  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (reducedMotion || e.pointerType !== "mouse") return;
      const frame = frameRef.current;
      if (!frame) return;
      const r = frame.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      frame.style.setProperty("--c-px", x.toFixed(3));
      frame.style.setProperty("--c-py", y.toFixed(3));
      frame.dataset.held = "";
    },
    [reducedMotion],
  );
  const onLeave = useCallback(() => {
    if (frameRef.current) delete frameRef.current.dataset.held;
  }, []);

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-kp-cover=""
      className="c-cover"
      src={cover.src}
      srcSet={cover.srcSet}
      sizes={cover.shape === "landscape" ? "(min-width: 900px) 1100px, 160vw" : "(min-width: 900px) 480px, 70vw"}
      alt=""
      decoding="async"
      fetchPriority="high"
      crossOrigin={cover.canvasSafe ? "anonymous" : undefined}
    />
  );

  return (
    <figure
      ref={winRef}
      className="c-win"
      data-shape={cover.shape}
      data-playing={playing ? "" : undefined}
      data-paused={paused ? "" : undefined}
    >
      <div
        ref={frameRef}
        className="c-frame"
        data-kp-slot={trailerKey ? "trailer" : undefined}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        {trailerKey ? (
          <button
            ref={shotRef}
            type="button"
            className="c-shot"
            hidden={playing}
            onClick={() => setPlaying(true)}
            aria-label={es ? `Ver el tráiler de ${title}` : `Watch the trailer for ${title}`}
          >
            {img}
            <span className="c-play" aria-hidden="true">
              <svg viewBox="0 0 12 12" width="11" height="11" focusable="false">
                <path d="M2 1l9 5-9 5z" fill="currentColor" />
              </svg>
              {es ? "Tráiler" : "Trailer"}
            </span>
          </button>
        ) : (
          <div className="c-shot">{img}</div>
        )}
        {playing && trailerKey && (
          <iframe
            className="c-player"
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailerKey)}?autoplay=1&mute=1&playsinline=1&rel=0`}
            title={es ? `Tráiler de ${title}` : `Trailer for ${title}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>

      <figcaption className="c-cap">
        {playing ? (
          <button ref={closeRef} type="button" className="c-capbtn" onClick={() => setPlaying(false)}>
            {es ? "Volver a la portada" : "Back to the cover"}
          </button>
        ) : (
          <button
            type="button"
            className="c-capbtn"
            hidden={reducedMotion}
            data-on={paused ? "" : undefined}
            onClick={() => setPaused((v) => !v)}
          >
            {/* El estado va en el nombre (no en `aria-pressed`): el botón dice lo que hará. */}
            {paused ? (es ? "Reanudar la portada" : "Resume the cover") : es ? "Pausar la portada" : "Pause the cover"}
          </button>
        )}
        <span className="c-strip" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </figcaption>
    </figure>
  );
}
