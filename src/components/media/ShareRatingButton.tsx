"use client";

// ============================================================
// KULTURA — "Compartir mi nota" en la ficha (F-29)
// Comparte `/u/{usuario}/r/{tipo}/{id}?s={firma}`: la página y su tarjeta OG
// ("benevi le da 9/10 a Dune") solo enseñan la nota con esa firma, que solo
// genera el servidor para el dueño. Hoja nativa en móvil; si no, copia.
// Textos desde el servidor (la ficha no lleva este namespace al cliente).
// ============================================================

import { useState } from "react";
import { KButton } from "@/components/ui/KButton";

export interface ShareRatingLabels {
  button: string;
  shareText: string;
  copied: string;
  copyError: string;
}

type Status = "idle" | "copied" | "error";

export function ShareRatingButton({ path, labels }: { path: string; labels: ShareRatingLabels }) {
  const [status, setStatus] = useState<Status>("idle");
  const [url, setUrl] = useState("");

  async function handleClick() {
    const full = new URL(path, window.location.origin).toString();
    setUrl(full);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: labels.shareText, url: full });
        setStatus("idle");
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(full);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <KButton variant="secondary" size="sm" onClick={handleClick}>
        {labels.button}
      </KButton>
      <p role="status" className="text-[13px] text-text-secondary max-w-xs">
        {status === "copied" ? labels.copied : null}
        {status === "error" ? (
          <>
            {labels.copyError}{" "}
            <span className="break-all font-semibold text-text-primary select-all">{url}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}
