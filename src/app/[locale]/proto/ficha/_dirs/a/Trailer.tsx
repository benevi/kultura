"use client";

// Dirección A «Sala» — el tráiler, aparte de la sala: un marco 16:9 en su
// sección. En reposo es un botón con una imagen de la obra y la orden «Ver el
// tráiler»; al pulsarlo (clic, toque, Intro) el mismo marco pasa a ser el
// reproductor de youtube-nocookie, en silencio, con sus controles y su marca y
// sin nada encima. Antes de pulsar no se pide nada a YouTube. Escape o «Cerrar
// el tráiler» (debajo del marco, fuera del iframe) lo cierran y el foco vuelve
// al botón.

import { useEffect, useRef, useState } from "react";

interface Props {
  trailerKey: string;
  /** Imagen del marco en reposo (fotograma apaisado si lo hay; si no, la portada). */
  image?: string;
  imageCross?: "anonymous";
  /** Texto visible del botón («Ver el tráiler»). */
  playText: string;
  /** Nombre accesible del botón («Ver el tráiler de …»). */
  playLabel: string;
  closeLabel: string;
  /** `title` del reproductor. */
  frameTitle: string;
}

export function Trailer({ trailerKey, image, imageCross, playText, playLabel, closeLabel, frameTitle }: Props) {
  const [playing, setPlaying] = useState(false);
  const wasPlaying = useRef(false);
  const playRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Foco: al abrir, al botón de cerrar (fuera del marco: Escape sigue llegando
  // a la página); al cerrar, de vuelta al botón del marco.
  useEffect(() => {
    if (playing) closeRef.current?.focus({ preventScroll: true });
    else if (wasPlaying.current) playRef.current?.focus({ preventScroll: true });
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

  return (
    <div className="a-tr" data-kp-slot="trailer" data-playing={playing ? "" : undefined}>
      <div className="a-tr-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailerKey)}?autoplay=1&mute=1&controls=1&playsinline=1&rel=0`}
            title={frameTitle}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button ref={playRef} type="button" className="a-tr-shot" aria-label={playLabel} onClick={() => setPlaying(true)}>
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" loading="lazy" decoding="async" crossOrigin={imageCross} />
            )}
            <span className="a-tr-play" aria-hidden="true">
              <svg viewBox="0 0 12 12" width="13" height="13" focusable="false">
                <path d="M2 1l9 5-9 5z" fill="currentColor" />
              </svg>
              {playText}
            </span>
          </button>
        )}
      </div>
      {playing && (
        <button ref={closeRef} type="button" className="a-tr-close" onClick={() => setPlaying(false)}>
          {closeLabel}
        </button>
      )}
    </div>
  );
}
