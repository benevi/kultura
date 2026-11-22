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
import { KButton } from "@/components/ui/KButton";
import { SalaButtonLazy as SalaButton } from "@/components/sala/SalaButtonLazy";
import { cn } from "@/lib/utils/index";
import { shareNative } from "@/components/pwa/share";

interface Props {
  /** Ruta con idioma y firma, p. ej. "/es/u/benevi/r/movie/438631?s=…". */
  path: string;
  title: string;
  /** Nota ya formateada en la escala de su dueño ("9/10", "4,5★"). */
  rating: string;
  /**
   * `sala`: los botones son `SalaButton` y el aviso va en la tinta de la obra
   * (ficha con «Sala», F2c). El comportamiento es el mismo.
   */
  skin?: "sala";
}

const SHARE_ICON = (size: number) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

export function ShareRatingButton({ path, title, rating, skin }: Props) {
  const sala = skin === "sala";
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
      {sala ? (
        <SalaButton
          ref={toggleRef}
          variant="secondary"
          icon={SHARE_ICON(20)}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={share}
        >
          {t("action")}
        </SalaButton>
      ) : (
        <KButton
          ref={toggleRef}
          type="button"
          variant="tonal"
          size="lg"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={share}
        >
          {SHARE_ICON(18)}
          {t("action")}
        </KButton>
      )}
      {/* En móvil, rejilla de 2 columnas («Copiar enlace» ocupa la fila
          entera; X y WhatsApp debajo, a medias) para que ninguna opción quede
          sola en otra línea. Desde `sm`, en fila. */}
      <div
        id={menuId}
        hidden={!open}
        aria-label={t("menu")}
        role="group"
        className={`${open ? "grid sm:flex" : "hidden"} w-full grid-cols-2 gap-2 sm:w-auto sm:flex-wrap sm:items-center`}
      >
        {(
          [
            { key: "copy", text: t("copy"), label: undefined, onClick: copy, wide: true },
            {
              key: "x",
              text: "X",
              label: t("onX"),
              onClick: () =>
                openWindow(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(fullUrl())}`),
              wide: false,
            },
            {
              key: "whatsapp",
              text: "WhatsApp",
              label: t("onWhatsApp"),
              onClick: () => openWindow(`https://wa.me/?text=${encodeURIComponent(`${text} ${fullUrl()}`)}`),
              wide: false,
            },
          ] as const
        ).map((b) =>
          sala ? (
            <SalaButton key={b.key} variant="quiet" aria-label={b.label} className={cn(b.wide && "col-span-2")} onClick={b.onClick}>
              {b.text}
            </SalaButton>
          ) : (
            <KButton
              key={b.key}
              type="button"
              variant="secondary"
              size="lg"
              aria-label={b.label}
              className={b.wide ? "col-span-2" : undefined}
              onClick={b.onClick}
            >
              {b.text}
            </KButton>
          )
        )}
      </div>
      <span
        role="status"
        aria-live="polite"
        className={sala ? "sala-type-small text-sala-ink" : "text-meta font-bold text-accent-positive"}
      >
        {copied ? t("copied") : ""}
      </span>
    </div>
  );
}
