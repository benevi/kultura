"use client";

// ============================================================
// KULTURA — TrailerEmbed (fachada de YouTube)
//
// La ficha es pública (D-01) y no tiene banner de cookies (D-12): el
// reproductor de YouTube no se carga hasta que alguien lo pide. Hasta
// entonces solo hay una miniatura (`i.ytimg.com`, una imagen sin cookies) y
// un botón; al pulsarlo se monta el iframe de `youtube-nocookie.com` (modo de
// privacidad mejorada) ya en reproducción y el foco pasa al reproductor.
// De paso, la ficha deja de descargar ~1 MB de JavaScript de YouTube que casi
// nadie usa.
// ============================================================

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

interface TrailerEmbedProps {
  youtubeKey: string;
  /** Título accesible del reproductor (`iframe title`). */
  title: string;
}

/** Ids de YouTube: 11 caracteres de `[A-Za-z0-9_-]`. Otra cosa no se pinta. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

export function trailerEmbedUrl(youtubeKey: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeKey)}?autoplay=1&rel=0`;
}

export function trailerThumbnailUrl(youtubeKey: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeKey)}/hqdefault.jpg`;
}

export function TrailerEmbed({ youtubeKey: rawKey, title }: TrailerEmbedProps) {
  // AniList manda ids con espacios o tabuladores al final ("LHtdKWJdif4\t").
  const youtubeKey = rawKey.trim();
  const t = useTranslations("media_detail");
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const noticeId = useId();
  const labelId = useId();

  useEffect(() => {
    if (playing) iframeRef.current?.focus();
  }, [playing]);

  if (!YOUTUBE_ID.test(youtubeKey)) return null;

  // Sin velos ni degradados sobre la miniatura (DISENO.md): el botón va en
  // una pastilla blanca con tinta marina y el aviso, debajo.
  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-bento bg-surface-elevated">
        {playing ? (
          <iframe
            ref={iframeRef}
            src={trailerEmbedUrl(youtubeKey)}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-labelledby={labelId}
            aria-describedby={noticeId}
            className="group absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus-ring"
          >
            {/* Miniatura decorativa: el botón ya dice qué hace. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trailerThumbnailUrl(youtubeKey)}
              alt=""
              width={480}
              height={360}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <span className="relative inline-flex h-11 items-center gap-2 rounded-button border-2 border-album-navy bg-album-white px-5 text-sm font-bold text-album-navy transition-transform duration-fast ease-out group-hover:-translate-y-0.5">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-4 h-4">
                <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
              </svg>
              <span id={labelId}>{t("trailerPlay")}</span>
            </span>
          </button>
        )}
      </div>
      {playing ? null : (
        <p id={noticeId} className="mt-2 text-xs text-text-tertiary">
          {t("trailerNotice")}
        </p>
      )}
    </div>
  );
}
