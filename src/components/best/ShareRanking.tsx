"use client";

// ============================================================
// KULTURA — Compartir un ranking público (/best)
// Sin ToastProvider (la página vive fuera de `(app)`): el aviso de "copiado"
// es un estado local. Hoja nativa en móvil; X y WhatsApp por enlace directo.
// ============================================================

import { useState } from "react";
import { useTranslations } from "next-intl";

interface ShareRankingProps {
  /** Ruta con locale, p. ej. "/es/best/anime/2026". */
  path: string;
  title: string;
}

const PILL =
  "rounded-full bg-surface-elevated px-4 py-2 text-[13px] font-bold text-text-primary";

export function ShareRanking({ path, title }: ShareRankingProps) {
  const t = useTranslations("best");
  const [copied, setCopied] = useState(false);

  const fullUrl = () => new URL(path, window.location.origin).toString();
  const text = t("shareText", { title });

  async function nativeOrCopy() {
    const url = fullUrl();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  function open(base: string) {
    window.open(base, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t("shareLabel")}>
      <button type="button" className={PILL} onClick={nativeOrCopy}>
        {copied ? t("copied") : t("share")}
      </button>
      <button
        type="button"
        className={PILL}
        onClick={() =>
          open(
            `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(fullUrl())}`
          )
        }
      >
        X
      </button>
      <button
        type="button"
        className={PILL}
        onClick={() =>
          open(`https://wa.me/?text=${encodeURIComponent(`${text} ${fullUrl()}`)}`)
        }
      >
        WhatsApp
      </button>
    </div>
  );
}
