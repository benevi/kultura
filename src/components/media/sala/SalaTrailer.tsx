"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { SalaButton } from "@/components/sala/SalaButton";
import { backdropLoader, posterLoader } from "@/lib/images/poster-url";
import { trailerEmbedUrl } from "@/lib/media/trailer";
import { paletteReadable } from "./SalaFichaImage";

/**
 * El tráiler al final de la ficha con «Sala» (fase 8.5, F3; biblia §1 y §9).
 *
 * - **Nada de YouTube antes de pulsar** (D-01, D-12 y lo que dice `/privacy`):
 *   el marco 16:9 lleva de fondo la imagen de la propia obra (la apaisada, o la
 *   portada), no la miniatura de YouTube. Al pulsar se monta el iframe de
 *   `youtube-nocookie.com` ya en reproducción y el foco pasa al reproductor.
 * - **El botón dice qué tráiler**: su nombre accesible lleva el título
 *   («Reproducir el tráiler de Matrix») y empieza por el texto que se ve
 *   (WCAG 2.5.3). El aviso de YouTube va debajo del marco, en texto, y es su
 *   descripción.
 * - **Sala**: esquinas rectas, sin sombras, `SalaButton` y los papeles
 *   `--sala-*`; el velo que asienta el botón es el fondo de la obra, no negro.
 *   Nada se mueve solo; con movimiento reducido, ni las transiciones.
 *
 * `MediaDetail` lo carga por `SalaTrailerLazy`: con la bandera `SALA_FICHA`
 * apagada la ficha de hoy no descarga este código.
 */
export interface SalaTrailerProps {
  /** Clave de YouTube ya validada (`youtubeTrailerKey`). */
  youtubeKey: string;
  /** Título de la obra: entra en el nombre del botón y del reproductor. */
  title: string;
  /** Imagen de fondo del marco: la apaisada de la obra o, si no hay, la portada. */
  image?: { src: string; wide: boolean } | null;
}

const PLAY_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);

export function SalaTrailer({ youtubeKey, title, image }: SalaTrailerProps) {
  const t = useTranslations("media_detail");
  const [playing, setPlaying] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const noticeId = useId();

  useEffect(() => {
    if (playing) iframeRef.current?.focus();
  }, [playing]);

  const background = image && !imageFailed ? image : null;

  return (
    <div data-sala-trailer={playing ? "playing" : "idle"} className="w-full lg:w-2/3">
      <div className="relative aspect-video w-full overflow-hidden bg-sala-panel">
        {playing ? (
          <iframe
            ref={iframeRef}
            src={trailerEmbedUrl(youtubeKey)}
            title={t("trailerTitle", { title })}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0 sala-focused:sala-focus sala-focused:[outline-offset:calc(-1*var(--sala-focus-width))]"
          />
        ) : (
          <>
            {background && (
              <Image
                // La misma carga que la sala (`SalaFichaImage`): con `sizes="100vw"`
                // y el mismo modo CORS, la apaisada sale de la caché.
                loader={background.wide ? backdropLoader : posterLoader}
                src={background.src}
                alt=""
                fill
                sizes={background.wide ? "100vw" : "(max-width: 1024px) 100vw, 66vw"}
                crossOrigin={paletteReadable(background.src) ? "anonymous" : undefined}
                className="object-cover"
                onError={() => setImageFailed(true)}
              />
            )}
            {/* Velo del fondo de la obra hacia abajo: asienta el botón sin sombras. */}
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-sala-background/75 to-transparent to-65%"
            />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
              <SalaButton
                variant="primary"
                icon={PLAY_ICON}
                aria-label={t("salaTrailerPlay", { title })}
                aria-describedby={noticeId}
                onClick={() => setPlaying(true)}
              >
                {t("trailerPlay")}
              </SalaButton>
            </div>
          </>
        )}
      </div>
      <p id={noticeId} className="sala-type-small mt-3 text-sala-ink-secondary">
        {t("trailerNotice")}
      </p>
    </div>
  );
}
