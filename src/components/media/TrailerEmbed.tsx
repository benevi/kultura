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

export function TrailerEmbed({ youtubeKey, title }: TrailerEmbedProps) {
  const t = useTranslations("media_detail");
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const noticeId = useId();
  const labelId = useId();

  useEffect(() => {
    if (playing) iframeRef.current?.focus();
  }, [playing]);

  if (!YOUTUBE_ID.test(youtubeKey)) return null;

  return (
    <div className="relative aspect-video w-full rounded-[24px] overflow-hidden bg-surface-elevated">
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
          className="group absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-pink"
        >
          {/* Miniatura decorativa: el botón ya dice qué hace. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={trailerThumbnailUrl(youtubeKey)}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span aria-hidden="true" className="absolute inset-0 bg-black/60 group-hover:bg-black/50 transition-colors" />
          <span className="relative inline-flex items-center gap-2 rounded-full bg-accent-pink text-on-accent-pink font-extrabold text-sm px-5 h-11">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-4 h-4">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
            </svg>
            <span id={labelId}>{t("trailerPlay")}</span>
          </span>
          <span id={noticeId} className="relative text-xs text-white px-4 text-center">
            {t("trailerNotice")}
          </span>
        </button>
      )}
    </div>
  );
}
