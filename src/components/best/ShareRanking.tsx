"use client";

// ============================================================
// KULTURA — Compartir un ranking público (/best) · DIS-10, ACC-10
// Un único botón "Compartir": abre la hoja nativa del sistema (Web Share)
// y, si no la hay o falla, despliega un menú con "Copiar enlace", X y
// WhatsApp. Patrón disclosure (botón con `aria-expanded` que muestra un
// grupo de botones), no `role="menu"`: Esc lo cierra y devuelve el foco.
// Sin ToastProvider (la página vive fuera de `(app)`): el aviso de "copiado"
// es una región `aria-live` propia.
// ============================================================

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { preloadShareImage, prepareShareImage, shareNative } from "@/components/pwa/share";

interface ShareRankingProps {
  /** Ruta con locale, p. ej. "/es/best/anime/2026". */
  path: string;
  title: string;
}

const FOCUS =
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
const MAIN =
  `inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-elevated px-5 text-[14px] font-bold text-text-primary hover:text-accent-pink transition-colors ${FOCUS}`;
const OPTION =
  `inline-flex min-h-11 items-center rounded-full border-2 border-stroke px-4 text-[13px] font-bold text-text-primary hover:bg-surface-elevated transition-colors ${FOCUS}`;

export function ShareRanking({ path, title }: ShareRankingProps) {
  const t = useTranslations("best.share");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const fullUrl = () => new URL(path, window.location.origin).toString();
  const text = t("text", { title });

  // La tarjeta OG tiene que estar descargada ANTES del toque (Safari).
  useEffect(() => preloadShareImage(path), [path]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  async function share() {
    if (open) {
      setOpen(false);
      return;
    }
    // Hoja nativa con la tarjeta del ranking (MOV-9); si no la hay de verdad
    // (p. ej. sin gesto), menú.
    if ((await shareNative({ title, text, url: fullUrl(), imagePath: path })) !== "unavailable") return;
    setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  function openWindow(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div ref={rootRef} role="group" aria-label={t("label")} className="flex flex-wrap items-center gap-2">
      <button
        ref={toggleRef}
        type="button"
        className={MAIN}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={share}
        onPointerEnter={() => void prepareShareImage(path)}
        onFocus={() => void prepareShareImage(path)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </svg>
        {t("action")}
      </button>
      {/* Atributo `hidden` (lo respeta el árbol de accesibilidad) y además la
          clase: con `flex` siempre puesta, la clase ganaría al atributo. */}
      <div
        id={menuId}
        hidden={!open}
        aria-label={t("menu")}
        role="group"
        className={`${open ? "flex" : "hidden"} flex-wrap items-center gap-2`}
      >
        <button type="button" className={OPTION} onClick={copy}>
          {t("copy")}
        </button>
        <button
          type="button"
          className={OPTION}
          aria-label={t("onX")}
          onClick={() =>
            openWindow(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(fullUrl())}`)
          }
        >
          X
        </button>
        <button
          type="button"
          className={OPTION}
          aria-label={t("onWhatsApp")}
          onClick={() => openWindow(`https://wa.me/?text=${encodeURIComponent(`${text} ${fullUrl()}`)}`)}
        >
          WhatsApp
        </button>
      </div>
      <span role="status" aria-live="polite" className="text-[13px] font-bold text-accent-positive">
        {copied ? t("copied") : ""}
      </span>
    </div>
  );
}
