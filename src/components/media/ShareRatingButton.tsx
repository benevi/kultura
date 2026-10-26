"use client";

// ============================================================
// KULTURA — "Compartir mi nota" en la ficha (CRE-8a, F-29)
// Solo lo ve el dueño de la nota. Comparte su enlace FIRMADO
// (`/u/{yo}/r/{tipo}/{id}?s=…`), que es lo que deja ver esa nota (y su
// tarjeta "benevi le da 9/10 a Dune") a quien no puede ver su biblioteca.
// Mismo patrón que `ShareRanking`: hoja nativa del sistema y, si no la hay,
// menú (disclosure) con copiar, X y WhatsApp; aviso en `aria-live`.
// La tarjeta va en la vista previa del enlace (no se adjunta como archivo:
// su URL lleva la firma y no sigue la convención de `ogImagePath`).
// ============================================================

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { shareNative } from "@/components/pwa/share";

interface Props {
  /** Ruta con idioma y firma, p. ej. "/es/u/benevi/r/movie/438631?s=…". */
  path: string;
  title: string;
  /** Nota ya formateada en la escala de su dueño ("9/10", "4,5★"). */
  rating: string;
}

const FOCUS =
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";
const MAIN = `inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-elevated px-5 text-sm font-bold text-text-primary hover:text-accent-pink transition-colors ${FOCUS}`;
const OPTION = `inline-flex min-h-11 items-center rounded-full border-2 border-stroke px-4 text-meta font-bold text-text-primary hover:bg-surface-elevated transition-colors ${FOCUS}`;

export function ShareRatingButton({ path, title, rating }: Props) {
  const t = useTranslations("share.rating");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const fullUrl = () => new URL(path, window.location.origin).toString();
  const text = t("text", { title, rating });

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
    if ((await shareNative({ title, text, url: fullUrl() })) !== "unavailable") return;
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
    <div ref={rootRef} role="group" aria-label={t("label", { title })} className="flex flex-wrap items-center gap-2">
      <button
        ref={toggleRef}
        type="button"
        className={MAIN}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={share}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </svg>
        {t("action")}
      </button>
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
      <span role="status" aria-live="polite" className="text-meta font-bold text-accent-positive">
        {copied ? t("copied") : ""}
      </span>
    </div>
  );
}
