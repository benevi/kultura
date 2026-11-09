"use client";

import { useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { IconClose, IconDice } from "@/components/icons";
import { SearchBar } from "@/components/search/SearchBar";
import { useDiscoverQuery } from "@/hooks/useDiscoverQuery";
import { useDiscoverUrl } from "@/hooks/useDiscoverUrl";
import { useFilterGroups } from "@/hooks/useFilterGroups";
import { isDiscoverType } from "@/lib/discover/discover-config";
import type { DiscoverType } from "@/lib/discover/type-filters";
import type { MediaItem } from "@/types/media";
import { formatVar } from "../Blocks";
import { Filters } from "./Filters";
import { Formats } from "./Formats";
import { Pages } from "./Pages";
import { Pick } from "./Pick";
import { Message, Wall, WallSkeleton } from "./Results";
import "./discover.css";

// ============================================================
// KULTURA v2 — Descubrir
//
// Una banda con los formatos arriba: el elegido tiñe la pantalla. Debajo, las
// portadas en columnas que bajan a distinta altura, como las letras del logotipo.
// Mismos datos, mismos parámetros de URL y misma función que la pantalla vieja.
// La URL se escribe con `pushState`: el cliente pide los datos él solo, así que no
// hace falta ir al servidor, no se remonta nada y Atrás funciona.
// ============================================================

/** Alto de la cabecera fija de la app. */
const HEADER = 56;

export function DiscoverScreen() {
  const t = useTranslations("discover");
  const tS = useTranslations("search");
  const tV = useTranslations("discover.v2");
  const tF = useTranslations("filters");
  const tC = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawType = searchParams.get("type") ?? "movie";
  const type: DiscoverType = isDiscoverType(rawType) ? rawType : "movie";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const q = searchParams.get("q")?.trim() ?? "";

  const titleRef = useRef<HTMLHeadingElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const diceRef = useRef<HTMLButtonElement>(null);

  // El campo se monta de nuevo solo si la búsqueda cambia desde fuera (Atrás); si
  // la ha escrito la persona, conserva el foco.
  const known = useRef(q);
  const fieldKey = useRef(0);
  if (known.current !== q) {
    known.current = q;
    fieldKey.current += 1;
  }

  function navigate(search: string) {
    const target = `${pathname}?${search}`;
    // La misma URL otra vez apilaría entradas y Atrás parecería no hacer nada.
    if (target === window.location.pathname + window.location.search) return;
    window.history.pushState(null, "", target);
    // Con la pared bajada, lo nuevo empezaría fuera de la vista.
    const results = resultsRef.current;
    // En pantallas bajas los controles no se pegan: el tope es entonces la cabecera.
    const stuck = Math.max(controlsRef.current?.getBoundingClientRect().bottom ?? 0, HEADER);
    if (results) {
      const top = results.getBoundingClientRect().top;
      if (top < stuck) window.scrollBy(0, top - stuck - 16);
    }
  }

  const url = useDiscoverUrl(type, q, navigate);
  const groups = useFilterGroups(type);

  const [pick, setPick] = useState<MediaItem | null>(null);
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());

  const { items, hasMore, totalPages, fetchErrorKind, loading } = useDiscoverQuery({
    type,
    page,
    filterQuery: url.filterQuery,
    query: q,
    locale,
    retryKey: retry,
    onSettled: () => setPick(null),
  });

  // Ni la que llega sin portada ni la que no carga: el catálogo no enseña huecos.
  const visible = items.filter((i) => i.poster && !failed.has(i.id));
  const firstLoad = loading && items.length === 0;
  const error = !loading && fetchErrorKind !== null;

  function surprise() {
    // Saldría una obra de lo anterior, y se iría sola al llegar lo nuevo.
    if (loading || visible.length === 0) return;
    // Pedir otra y que salga la misma parece que el botón no hace nada.
    const pool = visible.length > 1 ? visible.filter((i) => i.id !== pick?.id) : visible;
    setPick(pool[Math.floor(Math.random() * pool.length)]);
  }

  function closePick() {
    setPick(null);
    diceRef.current?.focus();
  }

  function onFail(id: string) {
    setFailed((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    if (pick?.id !== id) return;
    // La elegida no carga: otra en su lugar; sin más, de vuelta a la lista.
    const pool = visible.filter((i) => i.id !== id);
    if (pool.length > 0) setPick(pool[Math.floor(Math.random() * pool.length)]);
    else closePick();
  }

  /** El botón pulsado desaparece: sin esto, el foco caería al principio de la página. */
  function focusResults() {
    resultsRef.current?.focus({ preventScroll: true });
  }

  function clearSearch() {
    known.current = "";
    url.resetToCatalog();
  }

  let status = "";
  if (loading) status = tC("loading");
  else if (!error) {
    status = tV("results", { count: visible.length });
    if (page > 1) status += `. ${t("pageN", { n: page })}`;
  }
  if (pick) status = `${tS("showingRandom", { count: visible.length })}. ${pick.title}`;

  return (
    <main className="k2d page-grid" style={{ "--k-accent": type === "all" ? "var(--k-bone)" : formatVar(type) } as React.CSSProperties}>
      <header className="k2d-head">
        <h1 ref={titleRef} className="k2d-title" tabIndex={-1}>
          {t("title")}
        </h1>
        <div className="k2d-search" data-searching={q ? "true" : undefined}>
          <SearchBar
            key={fieldKey.current}
            mode="inline"
            defaultValue={q}
            type={type}
            settleOnSubmit
            className="k2d-search__field"
            onSubmit={(value) => {
              known.current = value;
              url.submitSearch(value);
            }}
            onClear={() => {
              if (q) clearSearch();
            }}
          />
          {q ? (
            <button
              type="button"
              className="k2d-search__clear"
              aria-label={tV("clearSearch")}
              title={tV("clearSearch")}
              onClick={() => {
                fieldKey.current += 1;
                clearSearch();
                titleRef.current?.focus();
              }}
            >
              <IconClose className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {/* Siempre visible: sin nada entre lo que elegir, solo se apaga. */}
        <button
          ref={diceRef}
          type="button"
          className="k2d-dice"
          disabled={visible.length === 0}
          aria-label={tS("randomize")}
          title={tS("randomize")}
          onClick={surprise}
        >
          <IconDice className="h-4 w-4" aria-hidden="true" />
          <span>{tS("randomize")}</span>
        </button>
      </header>

      <div className="k2d-controls" ref={controlsRef}>
        <Formats type={type} onChange={url.changeType} />
        {/* Los buscadores de los proveedores no aceptan filtros: buscando, fuera. */}
        {!q ? (
          <Filters
            groups={groups}
            active={url.activeFilters}
            accent={type === "all" ? "var(--k-bone)" : formatVar(type)}
            hasActive={url.hasActiveFilters}
            onChange={url.changeFilter}
            onReset={() => {
              url.resetToCatalog();
              focusResults();
            }}
          />
        ) : null}
      </div>

      <p role="status" className="sr-only">
        {status}
      </p>

      <div className="k2d-results" ref={resultsRef} tabIndex={-1} aria-busy={loading}>
        {firstLoad ? (
          <WallSkeleton />
        ) : error ? (
          <Message
            lead={fetchErrorKind === "rate-limit" ? t("fetchError.rateLimit") : t("fetchError.generic")}
            alert
            action={{
              label: tV("retry"),
              onClick: () => {
                // Un fallo de red pasajero no debe esconder portadas para siempre.
                setFailed(new Set());
                setRetry((n) => n + 1);
                focusResults();
              },
            }}
          />
        ) : pick ? (
          <Pick item={pick} onAgain={surprise} onClose={closePick} onFail={onFail} />
        ) : visible.length > 0 ? (
          <Wall items={visible} showType={type === "all"} onFail={onFail} dim={loading} />
        ) : q ? (
          <Message
            testId="discover-empty"
            title={tV("emptySearchTitle")}
            hint={type === "all" ? tV("emptySearchHintAll") : tV("emptySearchHint")}
            action={
              type === "all"
                ? undefined
                : {
                    label: tV("searchEverywhere"),
                    onClick: () => {
                      url.changeType("all");
                      focusResults();
                    },
                  }
            }
          />
        ) : url.hasActiveFilters ? (
          <Message
            testId="discover-empty"
            title={tV("emptyFiltersTitle")}
            hint={tV("emptyFiltersHint")}
            action={{
              label: tF("reset"),
              onClick: () => {
                url.resetToCatalog();
                focusResults();
              },
            }}
          />
        ) : (
          <Message title={t("noResults")} />
        )}
      </div>

      {/* Visible si hay siguiente o si no es la primera: desde una última página corta, o
          con error en la página 5, se vuelve. */}
      {!firstLoad && !pick && (hasMore || page > 1) ? (
        <Pages
          page={page}
          hasMore={hasMore}
          totalPages={totalPages}
          busy={loading}
          onChange={(n) => {
            url.goToPage(n);
            focusResults();
          }}
        />
      ) : null}
    </main>
  );
}
