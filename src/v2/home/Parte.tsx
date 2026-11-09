"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { canQuickAdvance } from "@/components/home/ContinueProgress";
import { FinishPrompt } from "@/components/library/FinishPrompt";
import { useProgressAdvance } from "@/components/library/useProgressAdvance";
import { useProgressLabel } from "@/components/library/useProgressLabel";
import { Link } from "@/i18n/navigation";
import { posterLoader } from "@/lib/images/poster-url";
import { progressFromJson, progressPercent, quickUnit, type ProgressValue } from "@/lib/library/progress";
import type { LibraryStatus } from "@/types/library";
import { formatVar } from "../Blocks";

// ============================================================
// KULTURA v2 — Parte de Inicio
//
// La primera obra va grande; las demás, en filas. Es la misma lógica de avance
// que la pantalla vieja (`useProgressAdvance`): solo cambia cómo se pinta.
// El botón va fuera del enlace: un botón dentro de un enlace no es HTML válido.
// ============================================================

export interface ParteItem {
  mediaId: string;
  title: string;
  poster: string | null;
  type: string;
  status: LibraryStatus;
  year?: number | null;
  progress: unknown;
}

/** Tamaños que acepta el optimizador (`imageSizes` y `deviceSizes` de Next). */
const LEAD_WIDTHS = [256, 384, 640];
const ROW_WIDTHS = [64, 128];

function Cover({ item, first }: { item: ParteItem; first: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  // Una portada puede fallar antes de hidratar, y entonces `onError` ya no llega.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (!item.poster || failed) {
    return (
      <span className="k2h-cover k2h-cover--plain" aria-hidden="true">
        {item.title}
      </span>
    );
  }
  const poster = item.poster;
  const widths = first ? LEAD_WIDTHS : ROW_WIDTHS;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      className="k2h-cover"
      src={posterLoader({ src: poster, width: widths[widths.length - 1] })}
      srcSet={widths.map((width) => `${posterLoader({ src: poster, width })} ${width}w`).join(", ")}
      sizes={first ? "(max-width: 700px) 112px, 220px" : "56px"}
      onError={() => setFailed(true)}
      alt=""
      width={500}
      height={750}
      decoding="async"
      loading={first ? "eager" : "lazy"}
      fetchPriority={first ? "high" : "auto"}
    />
  );
}

function Entry({ item, lead, fullProgress }: { item: ParteItem; lead: boolean; fullProgress: boolean }) {
  const t = useTranslations("progress");
  const td = useTranslations("diary");
  const tl = useTranslations("library");
  const tm = useTranslations("media");
  const th = useTranslations("home.v2");
  const label = useProgressLabel();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const descId = useId();
  const state = useProgressAdvance({
    mediaId: item.mediaId,
    mediaType: item.type,
    title: item.title,
    progress: progressFromJson(item.progress) as ProgressValue | null,
    status: item.status,
  });
  const { progress, status } = state;
  const done = status === "completed";

  const quick = canQuickAdvance(item.type, fullProgress);
  const percent = quick ? progressPercent(item.type, progress) : null;
  const unit = quick ? quickUnit(item.type, progress) : null;
  const href = `/media/${item.type}/${item.mediaId.split("_").slice(1).join("_")}`;
  const format = tm(item.type as Parameters<typeof tm>[0]);
  const where = done
    ? tl("status.completed")
    : quick && progress
      ? label(item.type, progress)
      : tl(`status.${item.status}` as Parameters<typeof tl>[0]);

  return (
    <li
      className={lead ? "k2h-entry k2h-entry--lead" : "k2h-entry"}
      style={{ "--c": formatVar(item.type) } as React.CSSProperties}
    >
      <Link href={href} className="k2h-entry__cover" tabIndex={-1} aria-hidden="true">
        <Cover item={item} first={lead} />
      </Link>

      <div className="k2h-entry__body">
        <h2 className="k2h-entry__title">
          <Link href={href}>{item.title}</Link>
        </h2>
        <p className="k2h-entry__format">
          <i aria-hidden="true" />
          {lead && item.year ? `${format} · ${item.year}` : format}
        </p>
      </div>

      <div className="k2h-entry__progress">
        <p>
          <b data-testid="progress-label">{where}</b>
        </p>
        {/* Sin total no hay barra: una vacía diría 0 % de algo que no se sabe. */}
        {done || percent !== null ? (
          <div className="k2h-bar" aria-hidden="true">
            <span data-testid="progress-fill" style={{ width: `${done ? 100 : percent}%` }} />
          </div>
        ) : null}
      </div>

      <div className="k2h-entry__actions">
        {unit && !done ? (
          <button
            ref={buttonRef}
            type="button"
            className="k2-btn k2h-next"
            onClick={state.advance}
            aria-busy={state.busy || undefined}
            aria-describedby={descId}
            data-testid="progress-next"
          >
            {t("quick", { unit })}
            <span id={descId} hidden>
              {t("quickLabel", { unit, title: item.title })}
            </span>
          </button>
        ) : null}
        {done ? (
          <span className="k2h-stamp">
            {td("stamp", { type: item.type })}
          </span>
        ) : null}
        {/* Con +1 o sello ya hay qué hacer aquí, y a la ficha se llega por el título. */}
        {lead && !unit && !done ? (
          <Link href={href} className="k2h-link">
            {th("open")}
          </Link>
        ) : null}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {state.announcement?.tone === "polite" ? state.announcement.text : ""}
      </span>
      <p role="alert" className="k2h-entry__alert">
        {state.announcement?.tone === "alert" ? state.announcement.text : ""}
      </p>

      <FinishPrompt
        open={state.finish !== null}
        title={item.title}
        mediaType={item.type}
        diary={state.finish?.diary ?? false}
        loading={state.completing}
        error={state.finishError}
        onConfirm={state.complete}
        onCancel={state.dismissFinish}
        finalFocusRef={buttonRef}
      />
    </li>
  );
}

export function Parte({ items, fullProgress }: { items: ParteItem[]; fullProgress: boolean }) {
  return (
    <ul className="k2h-parte">
      {items.map((item, i) => (
        // Sin nada empezado no hay obra principal: un «Pendiente» no es por dónde vas.
        <Entry key={item.mediaId} item={item} lead={i === 0 && item.status === "in_progress"} fullProgress={fullProgress} />
      ))}
    </ul>
  );
}
