"use client";

// ============================================================
// KULTURA — Buscador de la solapa del álbum (portada)
//
// Funciona de verdad: pide a `/api/search` (el mismo autocompletado público
// de Descubrir) y enseña lo que encuentra como cromos. Cada resultado enlaza
// a su ficha pública y tiene «Guardar», que lleva a crear la cuenta con
// vuelta a esa ficha (donde está el botón de añadir).
//
// - Sin JavaScript, el formulario manda a la búsqueda de la app (`/search`),
//   que pide entrar y vuelve con la consulta.
// - Mientras busca, huecos vacíos numerados (la forma del resultado); la
//   región de estado dice qué pasa al lector, una sola vez por búsqueda.
// - El cromo de aquí es el mismo dibujo que `Cromo` (clase `cromo`, borde
//   blanco de 3 px, respaldo detrás), con la portada nativa de la landing:
//   `Cromo` importa `next/image` y este es un componente de cliente de la
//   portada (F-30, JS ≤ 150 KB).
// ============================================================

import * as React from "react";
import { FormatTag } from "@/components/album/FormatTag";
import { Slot } from "@/components/album/Slot";
import { LandingPosterImage } from "@/components/landing/LandingPosterImage";
import { KButton } from "@/components/ui/KButton";
import { IconSearch } from "@/components/icons";
import { cromoPlaceholder } from "@/lib/design/album";
import { cromoPath } from "@/lib/landing/album";
import { cn } from "@/lib/utils/index";
import type { MediaType } from "@/types/media";

/** Familias del buscador: `all` = cine y series (TMDB); cómic no tiene sugerencias. */
export const FLAP_FORMATS = ["all", "anime", "manga", "book", "game"] as const;
export type FlapFormat = (typeof FLAP_FORMATS)[number];

export interface FlapSearchLabels {
  label: string;
  placeholder: string;
  submit: string;
  formats: string;
  /** Nombre de cada familia (`all` = «Cine y series»). */
  family: Record<FlapFormat, string>;
  loading: string;
  /** Plantillas con `{q}`. */
  results: string;
  empty: string;
  error: string;
  save: string;
  /** Nombre del formato junto a su color. */
  format: Record<MediaType, string>;
}

interface Result {
  id: string;
  externalId?: string;
  type: MediaType;
  title: string;
  poster?: string;
}

type Status = { kind: "idle" } | { kind: "loading"; q: string } | { kind: "done"; q: string; items: Result[] } | { kind: "error"; q: string };

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;
const FIELD =
  "h-11 w-full min-w-0 rounded-2xl border border-field-border bg-surface-elevated pl-10 pr-3 font-body text-base text-text-primary placeholder:text-text-tertiary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export function FlapSearch({ locale, labels }: { locale: string; labels: FlapSearchLabels }) {
  const id = React.useId();
  const [q, setQ] = React.useState("");
  const [family, setFamily] = React.useState<FlapFormat>("all");
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const abort = React.useRef<AbortController | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = React.useCallback(
    async (query: string, fam: FlapFormat) => {
      const term = query.trim();
      abort.current?.abort();
      if (term.length < MIN_QUERY) {
        setStatus({ kind: "idle" });
        return;
      }
      const ctrl = new AbortController();
      abort.current = ctrl;
      setStatus({ kind: "loading", q: term });
      const params = new URLSearchParams({ q: term, locale });
      if (fam !== "all") params.set("type", fam);
      try {
        const res = await fetch(`/api/search?${params}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Result[];
        const items = (Array.isArray(data) ? data : []).filter((r) => typeof r.poster === "string" && r.poster.length > 0);
        if (!ctrl.signal.aborted) setStatus({ kind: "done", q: term, items: items.slice(0, 5) });
      } catch (e) {
        if (!ctrl.signal.aborted && !(e instanceof DOMException && e.name === "AbortError")) setStatus({ kind: "error", q: term });
      }
    },
    [locale]
  );

  React.useEffect(
    () => () => {
      abort.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const schedule = (query: string, fam: FlapFormat) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(query, fam), DEBOUNCE_MS);
  };

  const fill = (template: string, term: string) => template.replace("{q}", term);
  const message =
    status.kind === "loading"
      ? labels.loading
      : status.kind === "error"
        ? fill(labels.error, status.q)
        : status.kind === "done"
          ? fill(status.items.length > 0 ? labels.results : labels.empty, status.q)
          : "";

  return (
    <div data-flap-search="">
      <form
        role="search"
        action={`/${locale}/search`}
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          if (timer.current) clearTimeout(timer.current);
          void run(q, family);
        }}
      >
        <label htmlFor={`${id}-q`} className="mb-2 block text-sm font-semibold text-text-primary">
          {labels.label}
        </label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-tertiary" />
            <input
              id={`${id}-q`}
              name="q"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              value={q}
              placeholder={labels.placeholder}
              onChange={(e) => {
                setQ(e.target.value);
                schedule(e.target.value, family);
              }}
              className={FIELD}
            />
          </div>
          <KButton type="submit" variant="secondary" size="lg" className="shrink-0 px-4">
            {labels.submit}
          </KButton>
        </div>
        <div
          role="group"
          aria-label={labels.formats}
          className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
        >
          {FLAP_FORMATS.map((f) => {
            const active = f === family;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFamily(f);
                  if (q.trim().length >= MIN_QUERY) void run(q, f);
                }}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors duration-fast pointer-coarse:h-11",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
                  active ? "bg-text-primary text-surface-base" : "bg-surface-elevated text-text-primary hover:bg-surface-border"
                )}
              >
                {labels.family[f]}
              </button>
            );
          })}
        </div>
      </form>

      <p role="status" className={cn("text-sm text-text-secondary", message ? "mt-3" : "sr-only")}>
        {message}
      </p>

      {status.kind === "loading" ? (
        <ul aria-hidden="true" className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i}>
              <Slot number={i + 1} title="" />
            </li>
          ))}
        </ul>
      ) : null}

      {status.kind === "done" && status.items.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-x-2 gap-y-4 min-[480px]:grid-cols-5">
          {status.items.map((item) => {
            const path = `/${locale}${cromoPath(item)}`;
            return (
              <li key={item.id} className="flex min-w-0 flex-col gap-1.5">
                <a
                  href={path}
                  className="group block rounded-cromo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <div className="cromo relative aspect-[2/3] w-full overflow-hidden rounded-cromo border-[3px] border-cromo-border bg-surface-elevated">
                    <div aria-hidden="true" className="absolute inset-0" style={{ background: cromoPlaceholder(item.id) }} />
                    <LandingPosterImage src={item.poster as string} sizes="(min-width: 480px) 88px, 30vw" className="object-cover" />
                  </div>
                  <span className="mt-1.5 block truncate text-xs font-semibold text-text-primary">{item.title}</span>
                </a>
                <FormatTag format={item.type} label={labels.format[item.type]} />
                <KButton asChild variant="secondary" size="sm" className="w-full px-2">
                  <a
                    href={`/${locale}/login?mode=register&next=${encodeURIComponent(path)}`}
                    rel="nofollow"
                    aria-label={`${labels.save} ${item.title}`}
                  >
                    {labels.save}
                  </a>
                </KButton>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
