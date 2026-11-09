"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useToastContext } from "@/components/ui/ToastProvider";
import { Link } from "@/i18n/navigation";
import { deleteDiaryLog } from "@/lib/library/actions";
import { formatDiaryDate, formatDiaryMonth } from "@/lib/library/dates";
import { formatRating } from "@/lib/library/rating";
import type { DiaryLog, RatingScale } from "@/types/library";
import { formatVar } from "../Blocks";
import { Cover } from "./Cover";

// ============================================================
// KULTURA v2 — Diario de la Biblioteca
//
// Apuntes por mes, del más reciente al más antiguo. La misma lógica que
// `DiaryList` (borrar y reseñas con spoilers ocultas): lo que cambia es el dibujo.
// Solo lo ve su dueño.
// ============================================================

const WIDTHS = [64, 128];

export function splitMediaId(mediaId: string) {
  const i = mediaId.indexOf("_");
  return { type: mediaId.slice(0, i), externalId: mediaId.slice(i + 1) };
}

function byMonth(logs: DiaryLog[]) {
  const groups: Array<{ month: string; logs: DiaryLog[] }> = [];
  for (const log of logs) {
    const month = log.watchedOn.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.logs.push(log);
    else groups.push({ month, logs: [log] });
  }
  return groups;
}

export function Diario({
  logs,
  scale,
  onRemoved,
}: {
  logs: DiaryLog[];
  scale: RatingScale;
  onRemoved: (id: string) => void;
}) {
  const t = useTranslations("diary");
  const locale = useLocale();
  const { show, showError } = useToastContext();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(log: DiaryLog) {
    setDeleting(log.id);
    try {
      await deleteDiaryLog(log.id);
      onRemoved(log.id);
      show({ message: t("deleted", { title: log.title ?? log.mediaId }), type: "success" });
    } catch {
      showError(t("deleteFailed"));
    } finally {
      setDeleting(null);
    }
  }

  function toggleSpoiler(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (logs.length === 0) {
    return (
      <section className="k2b-empty">
        <h2>{t("emptyTitle")}</h2>
        <p>{t("emptyHint")}</p>
      </section>
    );
  }

  return (
    <div className="k2b-diary" role="region" aria-label={t("listLabel")}>
      {byMonth(logs).map((group) => (
        <section key={group.month} aria-labelledby={`k2b-m-${group.month}`} className="k2b-month">
          <h2 id={`k2b-m-${group.month}`}>{formatDiaryMonth(group.month, locale)}</h2>
          <ul>
            {group.logs.map((log) => {
              const { type, externalId } = splitMediaId(log.mediaId);
              const date = formatDiaryDate(log.watchedOn, locale);
              const title = log.title ?? log.mediaId;
              const hidden = log.spoiler && !revealed.has(log.id);
              const reviewId = `k2b-review-${log.id}`;
              return (
                <li key={log.id} className="k2b-log" style={{ "--c": formatVar(type) } as React.CSSProperties}>
                  <Link href={`/media/${type}/${externalId}`} className="k2b-log__cover" prefetch={false} tabIndex={-1} aria-hidden="true">
                    <Cover poster={log.poster} title={title} widths={WIDTHS} sizes="56px" />
                  </Link>
                  <div className="k2b-log__body">
                    <h3>
                      <Link href={`/media/${type}/${externalId}`} prefetch={false}>
                        {title}
                      </Link>
                      {log.year ? <span> {log.year}</span> : null}
                    </h3>
                    <p className="k2b-log__meta">
                      <span>
                        <time dateTime={log.watchedOn}>{date}</time>
                        {log.rewatch ? ` · ${t("rewatchShort", { type })}` : ""}
                      </span>
                      {log.rating10 !== null ? (
                        <b>{formatRating(log.rating10, scale, locale)}</b>
                      ) : null}
                    </p>
                    {log.review ? (
                      hidden ? (
                        <p className="k2b-log__hidden">{t("spoilerHidden")}</p>
                      ) : (
                        <p id={reviewId} className="k2b-log__review">
                          {log.review}
                        </p>
                      )
                    ) : null}
                    {log.review && log.spoiler ? (
                      <button
                        type="button"
                        className="k2b-text-btn"
                        onClick={() => toggleSpoiler(log.id)}
                        aria-expanded={!hidden}
                        aria-controls={hidden ? undefined : reviewId}
                      >
                        {hidden ? t("showSpoiler") : t("hideSpoiler")}
                      </button>
                    ) : null}
                    {log.privateNote ? (
                      <p className="k2b-log__note">
                        <b>{t("privateNote")}:</b> {log.privateNote}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="k2b-text-btn k2b-log__delete"
                    onClick={() => remove(log)}
                    disabled={deleting !== null}
                    aria-busy={deleting === log.id || undefined}
                    aria-label={t("deleteLog", { title, date })}
                  >
                    {t("delete")}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
