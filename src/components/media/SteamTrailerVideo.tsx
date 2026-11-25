"use client";

// ============================================================
// KULTURA — SteamTrailerVideo
//
// El reproductor del tráiler de la tienda de Steam, ya pedido por el usuario
// (los marcos `TrailerEmbed` y `SalaTrailer` solo lo montan al pulsar, así que
// antes no se descarga nada). Es un `<video>` nativo con la lista HLS de
// Steam, servida directo desde `video.akamai.steamstatic.com` (ni nuestro
// servidor ni el optimizador de imágenes). Sin `autoplay`: arranca con
// `play()` porque el usuario acaba de pulsar «Reproducir»; si el navegador lo
// rechaza, quedan los controles. Sin HLS nativo (Firefox, Chrome antiguo),
// `hls.js` por import dinámico: solo se descarga al pulsar y solo en esos
// navegadores (Safari y Chrome reciente no lo bajan). Build completa, no la
// `light`: Steam sirve el audio como pista aparte (EXT-X-MEDIA TYPE=AUDIO) y la
// `light` no trae audio alternativo. `enableWorker: false` para no necesitar
// `worker-src blob:`; MSE sí usa una URL `blob:` (de ahí `media-src blob:`).
// Si nada de eso funciona, enlace a la página de Steam.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { SteamTrailer } from "@/lib/api/steam";

const HLS_TYPE = "application/vnd.apple.mpegurl";

interface SteamTrailerVideoProps {
  trailer: SteamTrailer;
  /** Nombre accesible del reproductor («Tráiler de Hades»). */
  title: string;
  /** Página de la tienda, para quien no puede reproducir HLS. */
  storeUrl: string;
  className?: string;
}

export function SteamTrailerVideo({ trailer, title, storeUrl, className }: SteamTrailerVideoProps) {
  const t = useTranslations("media_detail");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const start = () => {
      video.play()?.catch(() => {
        /* Sin permiso para reproducir: quedan los controles. */
      });
    };
    video.focus();
    if (video.canPlayType(HLS_TYPE)) {
      video.src = trailer.src;
      start();
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            setFailed(true);
            return;
          }
          const hls = new Hls({ enableWorker: false });
          destroy = () => hls.destroy();
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setFailed(true);
          });
          hls.on(Hls.Events.MANIFEST_PARSED, start);
          hls.loadSource(trailer.src);
          hls.attachMedia(video);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [trailer.src]);

  if (failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm">{t("steamTrailerUnsupported")}</p>
        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="underline font-bold">
          {t("steamTrailerOpen")}
        </a>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      preload="none"
      poster={trailer.poster}
      aria-label={title}
      tabIndex={0}
      onError={() => setFailed(true)}
      className={className ?? "absolute inset-0 h-full w-full bg-black"}
    />
  );
}
