"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { progressPercent, type LibraryEntryWithProgress } from "@/lib/library/progress";
import type { DiaryLog, RatingScale } from "@/types/library";
import { formatVar } from "../Blocks";
import { Cover } from "./Cover";
import { Diario, splitMediaId } from "./Diario";
import "./library.css";

// ============================================================
// KULTURA v2 — Biblioteca
//
// Un raíl con lo que hay (estado y formato, con sus cuentas) y una pared de
// portadas. Recibe los mismos datos que la pantalla vieja y lee los mismos
// parámetros de la URL, así que un enlace guardado sigue valiendo. Filtrar no va
// al servidor: `pushState` cambia la URL y `useSearchParams` la sigue, con lo que
// el botón Atrás funciona y la pared responde al momento.
// ============================================================

const STATUS = [
  { value: "in_progress", counter: "inProgress" },
  { value: "pending", counter: "pending" },
  { value: "completed", counter: "completed" },
  { value: "abandoned", counter: "dropped" },
] as const;

const FORMATS = ["movie", "tv", "anime", "book", "comic", "manga", "game"] as const;

const SCORES = [
  { value: "5", label: "5" },
  { value: "4", label: "4+" },
  { value: "3", label: "3+" },
  { value: "2", label: "2+" },
];

/** Tamaños que acepta el optimizador (`imageSizes` y `deviceSizes` de Next). */
const COVER_WIDTHS = [128, 256, 384];

/** Lo que se ve sin hacer scroll en móvil: el resto carga al acercarse. */
const EAGER_COVERS = 6;

function Work({ entry, index }: { entry: LibraryEntryWithProgress; index: number }) {
  const tl = useTranslations("library");
  const tm = useTranslations("media");
  const { type, externalId } = splitMediaId(entry.mediaId);
  const title = entry.title ?? entry.mediaId;
  // Solo lo que se lleva a medias y tiene total: una barra sin total no dice nada.
  const percent = entry.status === "in_progress" ? progressPercent(type, entry.progress) : null;

  return (
    <li
      className="k2b-work"
      data-status={entry.status}
      style={{ "--c": formatVar(type) } as React.CSSProperties}
    >
      <Link href={`/media/${type}/${externalId}`} className="k2b-work__link" prefetch={false}>
        <span className="k2b-work__frame">
          <Cover
            poster={entry.poster}
            title={title}
            widths={COVER_WIDTHS}
            sizes="(max-width: 700px) 33vw, 180px"
            loading={index < EAGER_COVERS ? "eager" : "lazy"}
            priority={index === 0}
          />
          {percent !== null ? (
            <span className="k2b-work__bar" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </span>
          ) : null}
        </span>
        <h2 className="k2b-work__title">{title}</h2>
        <span className="k2b-work__meta">
          <i aria-hidden="true" />
          <span>
            {tm(type as Parameters<typeof tm>[0])}
            {entry.year ? <span className="k2b-work__year"> · {entry.year}</span> : null}
            {/* El estado se ve en el raíl y en cómo está la portada; aquí, para quien no la ve. */}
            <span className="sr-only">
              {" · "}
              {tl(`status.${entry.status}` as Parameters<typeof tl>[0])}
              {percent !== null ? ` · ${percent} %` : ""}
            </span>
          </span>
        </span>
      </Link>
    </li>
  );
}

function RailButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="k2b-rail__item" aria-pressed={active} onClick={onClick}>
      <span className="k2b-rail__label">{children}</span>
      {count !== undefined ? <span className="k2b-rail__count">{count}</span> : null}
    </button>
  );
}

export function LibraryScreen({
  entries,
  diary = null,
}: {
  entries: LibraryEntryWithProgress[];
  /** `null` sin RATING_SCALE_10 o sin la migración: sin diario ni favoritos. */
  diary?: { logs: DiaryLog[]; scale: RatingScale } | null;
}) {
  const t = useTranslations("library");
  const tF = useTranslations("filters");
  const td = useTranslations("diary");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const type = searchParams.get("type") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const score = searchParams.get("score") ?? "all";
  const onlyFavorites = diary !== null && searchParams.get("fav") === "1";
  const view = diary !== null && searchParams.get("view") === "diary" ? "diary" : "collection";

  // Los apuntes viven aquí: `pushState` no vuelve al servidor, así que un apunte
  // borrado reaparecería al ir a Títulos y volver si solo lo supiera el diario.
  const [logs, setLogs] = useState(diary?.logs ?? []);
  // En móvil, puntuación y favoritos se pliegan: antes de la pared caben dos filas.
  const [moreOpen, setMoreOpen] = useState(score !== "all" || onlyFavorites);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);

  function navigate(url: string) {
    // La misma URL otra vez apilaría entradas y Atrás parecería no hacer nada.
    if (url === window.location.pathname + window.location.search) return;
    window.history.pushState(null, "", url);
    // Con la pared bajada, cambiar el filtro te deja en mitad de otra cosa.
    const shelf = shelfRef.current;
    if (shelf && shelf.getBoundingClientRect().top < 0) shelf.scrollIntoView({ block: "start" });
  }

  function go(next: Record<string, string>) {
    const merged = { type, status, score, fav: onlyFavorites ? "1" : "all", view, ...next };
    const params = new URLSearchParams();
    if (merged.view === "diary") params.set("view", "diary");
    if (merged.type !== "all") params.set("type", merged.type);
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.score !== "all") params.set("score", merged.score);
    if (merged.fav === "1") params.set("fav", "1");
    const qs = params.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname);
  }

  function reset() {
    navigate(pathname);
    // El botón pulsado desaparece: sin esto, el foco caería al principio de la página.
    titleRef.current?.focus();
  }

  function removeLog(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    titleRef.current?.focus();
  }

  // Pulsar el filtro activo lo quita, como en la pantalla vieja.
  const toggle = (key: string, current: string, value: string) => go({ [key]: current === value ? "all" : value });

  const filtered = useMemo(
    () =>
      entries
        .filter((e) => type === "all" || e.mediaId.startsWith(`${type}_`))
        .filter((e) => status === "all" || e.status === status)
        .filter((e) => {
          if (score === "all") return true;
          const min = parseInt(score, 10);
          return e.score !== null && e.score >= min;
        })
        .filter((e) => !onlyFavorites || e.favorite === true),
    [entries, type, status, score, onlyFavorites]
  );

  // Cuentan la biblioteca entera, no la vista filtrada: son el resumen, no el resultado.
  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const e of entries) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
      const f = splitMediaId(e.mediaId).type;
      byType[f] = (byType[f] ?? 0) + 1;
    }
    return { byStatus, byType };
  }, [entries]);

  const hasScores = entries.some((e) => e.score !== null);
  const hasFilters = type !== "all" || status !== "all" || score !== "all" || onlyFavorites;
  const hasExtra = hasScores || score !== "all" || diary !== null;

  const title = (
    <h1 ref={titleRef} className="k2b-title" tabIndex={-1}>
      {t("title")}
    </h1>
  );

  const viewSwitch = diary ? (
    <div className="k2b-views" role="group" aria-label={td("view")}>
      <button type="button" aria-pressed={view === "collection"} onClick={() => go({ view: "collection" })}>
        {td("viewCollection")}
      </button>
      <button type="button" aria-pressed={view === "diary"} onClick={() => go({ view: "diary" })}>
        {td("viewDiary")}
      </button>
    </div>
  ) : null;

  if (diary && view === "diary") {
    return (
      <main className="k2b k2b--plain page-grid">
        <header className="k2b-head">
          {title}
          {viewSwitch}
        </header>
        <Diario logs={logs} scale={diary.scale} onRemoved={removeLog} />
      </main>
    );
  }

  if (entries.length === 0) {
    return (
      <main className="k2b k2b--plain page-grid">
        <header className="k2b-head">
          {title}
          {viewSwitch}
        </header>
        <section className="k2b-empty">
          <h2>{t("empty.title")}</h2>
          <p>{t("empty.hint")}</p>
          <Link href="/discover" className="k2-btn">
            {t("empty.cta")}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="k2b page-grid">
      <header className="k2b-head">
        {title}
        {viewSwitch}
        {hasExtra ? (
          <button
            type="button"
            className="k2b-more"
            aria-expanded={moreOpen}
            aria-controls="k2b-extra"
            onClick={() => setMoreOpen((v) => !v)}
          >
            {tF("filters")}
          </button>
        ) : null}
      </header>

      <aside className="k2b-rail" aria-label={tF("filters")}>
        <div className="k2b-rail__group" role="group" aria-label={tF("status")}>
          <RailButton active={status === "all"} onClick={() => go({ status: "all" })} count={entries.length}>
            {tF("all")}
          </RailButton>
          {STATUS.map((s) => (
            <RailButton
              key={s.value}
              active={status === s.value}
              onClick={() => toggle("status", status, s.value)}
              count={counts.byStatus[s.value] ?? 0}
            >
              {t(`counters.${s.counter}`)}
            </RailButton>
          ))}
        </div>

        <div className="k2b-rail__group" role="group" aria-label={tF("type")}>
          {FORMATS.filter((f) => counts.byType[f] || type === f).map((f) => (
            <RailButton
              key={f}
              active={type === f}
              onClick={() => toggle("type", type, f)}
              count={counts.byType[f] ?? 0}
            >
              <i aria-hidden="true" style={{ background: formatVar(f) }} />
              {tF(f)}
            </RailButton>
          ))}
        </div>

        {hasExtra ? (
          <div id="k2b-extra" className="k2b-rail__extra" data-open={moreOpen}>
            {hasScores || score !== "all" ? (
              <div className="k2b-score" role="group" aria-labelledby="k2b-score">
                <span id="k2b-score">{tF("minScore")}</span>
                {SCORES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    aria-pressed={score === s.value}
                    onClick={() => toggle("score", score, s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : null}
            {diary ? (
              <button
                type="button"
                className="k2b-fav"
                aria-pressed={onlyFavorites}
                onClick={() => go({ fav: onlyFavorites ? "all" : "1" })}
              >
                {td("favorites")}
              </button>
            ) : null}
          </div>
        ) : null}
      </aside>

      <div className="k2b-shelf" ref={shelfRef}>
        <div className="k2b-shelf__head">
          <p role="status">{t("items", { count: filtered.length })}</p>
          {/* La cabecera tiene alto fijo: aparezca o no, la pared no se mueve. */}
          <button type="button" className="k2b-reset" onClick={reset} hidden={!hasFilters || filtered.length === 0}>
            {tF("reset")}
          </button>
        </div>

        {filtered.length > 0 ? (
          <ul className="k2b-wall">
            {filtered.map((entry, i) => (
              <Work key={entry.id} entry={entry} index={i} />
            ))}
          </ul>
        ) : (
          <section className="k2b-empty">
            <h2>{t("empty.filtered")}</h2>
            <p>{t("empty.filteredHint")}</p>
            <button type="button" className="k2-btn k2b-empty__reset" onClick={reset}>
              {tF("reset")}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
