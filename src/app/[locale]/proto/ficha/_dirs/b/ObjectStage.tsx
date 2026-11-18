"use client";

// Dirección B «Objeto» — la vitrina: la portada como objeto con cuerpo (CSS 3D,
// sin three.js). Se inclina hacia el puntero (o con el scroll donde no hay
// puntero fino), un brillo cruza la cubierta y, si la obra tiene tráiler, al
// PULSAR la portada el reproductor de youtube-nocookie ocupa su hueco, en
// silencio y con sus controles a la vista. Nada se carga de YouTube antes.
// El marcado sale ya completo del servidor; aquí solo se añaden las variables
// `--b-rx`, `--b-ry` y `--b-sc`.

import { useEffect, useRef, useState } from "react";
import { useProto } from "../../_base/ProtoShell";
import type { CoverSource } from "../../_base/types";

export type ObjectKind = "poster" | "book" | "manga" | "comic" | "game";

interface Props {
  kind: ObjectKind;
  cover: CoverSource | null;
  /** Texto del formato («Videojuego»): solo adorno en la caja o en el objeto sin portada. */
  typeLabel: string;
  trailerKey: string | null;
  playLabel: string;
  closeLabel: string;
  trailerTitle: string;
}

const SIZES = "(min-width: 960px) 400px, 60vw";
const SIZES_WIDE = "(min-width: 960px) 540px, 86vw";

export function ObjectStage({ kind, cover, typeLabel, trailerKey, playLabel, closeLabel, trailerTitle }: Props) {
  const { reducedMotion } = useProto();
  const stageRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);

  // Inclinación: puntero fino → hacia el puntero; si no, con el scroll.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reset = () => {
      stage.style.removeProperty("--b-rx");
      stage.style.removeProperty("--b-ry");
      stage.style.removeProperty("--b-sc");
    };
    if (reducedMotion || open) {
      reset();
      return;
    }
    let raf = 0;
    let rx = 0, ry = 0, sc = 0;
    const apply = () => {
      raf = 0;
      stage.style.setProperty("--b-rx", rx.toFixed(2));
      stage.style.setProperty("--b-ry", ry.toFixed(2));
      stage.style.setProperty("--b-sc", sc.toFixed(3));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = stage.getBoundingClientRect();
      const nx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      const ny = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      ry = nx * 13;
      rx = -ny * 8;
      queue();
    };
    const onLeave = () => {
      rx = 0;
      ry = 0;
      queue();
    };
    const onScroll = () => {
      const h = stage.offsetHeight || 1;
      sc = Math.max(0, Math.min(1, window.scrollY / (h * 0.9)));
      queue();
    };
    if (fine) {
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerleave", onLeave);
    } else {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      reset();
    };
  }, [reducedMotion, open]);

  // Foco: al abrir, al botón de cerrar (el reproductor queda justo antes); al cerrar, de vuelta a la portada.
  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) playRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const cross = cover?.canvasSafe ? "anonymous" : undefined;
  const hasBody = kind === "book" || kind === "manga" || kind === "game" || kind === "comic";

  return (
    <div
      ref={stageRef}
      className="b-stage"
      data-kind={kind}
      data-shape={cover ? cover.shape : "none"}
      data-open={open ? "" : undefined}
    >
      <div className="b-halo" aria-hidden="true" />

      <div className="b-scene" hidden={open}>
        <div className="b-shadow" aria-hidden="true" />
        <div className="b-obj">
          {hasBody && (
            <>
              <div className="b-face b-back" aria-hidden="true" />
              <div className="b-face b-spine" aria-hidden="true">
                {cover && (kind === "book" || kind === "manga") && (
                  // Mismo `crossOrigin` que la portada principal: si no, se envenena la caché del canvas.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="b-spine-img" src={cover.small} alt="" crossOrigin={cross} decoding="async" />
                )}
              </div>
              <div className="b-face b-edge" aria-hidden="true" />
              <div className="b-face b-top" aria-hidden="true" />
            </>
          )}
          <div className="b-front">
            {kind === "game" && (
              <span className="b-case-band" aria-hidden="true">
                {typeLabel}
              </span>
            )}
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="b-cover"
                data-kp-cover=""
                src={cover.src}
                srcSet={cover.srcSet}
                sizes={cover.shape === "landscape" ? SIZES_WIDE : SIZES}
                alt=""
                crossOrigin={cross}
                decoding="async"
                fetchPriority="high"
              />
            ) : (
              <span className="b-blank" aria-hidden="true">
                {typeLabel}
              </span>
            )}
            <span className="b-gloss" aria-hidden="true" />
            {trailerKey && (
              <button ref={playRef} type="button" className="b-play" aria-label={playLabel} onClick={() => setOpen(true)}>
                <span className="b-play-glyph" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="26" height="26" focusable="false">
                    <path d="M8.2 4.6v14.8a.9.9 0 0 0 1.37.77l11.6-7.4a.9.9 0 0 0 0-1.54L9.57 3.83A.9.9 0 0 0 8.2 4.6Z" fill="currentColor" />
                  </svg>
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {open && trailerKey && (
        <div className="b-trailer" data-kp-slot="trailer">
          <div className="b-player">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailerKey)}?autoplay=1&mute=1&controls=1&playsinline=1&rel=0`}
              title={trailerTitle}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <button ref={closeRef} type="button" className="b-close" onClick={() => setOpen(false)}>
            {closeLabel}
          </button>
        </div>
      )}
    </div>
  );
}
