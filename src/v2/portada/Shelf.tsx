"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { coverSource } from "@/lib/landing/cover-source";
import type { ShelfFormat, ShelfItem } from "@/lib/landing/shelf-types";
import { formatVar } from "../Blocks";

// ============================================================
// KULTURA v2 — Abanico y obras a medias de la portada
//
// CSS 3D con portadas reales: sin WebGL ni texturas ampliadas. Las dos secciones
// comparten el contador: un +1 en el abanico se ve también en la lista. Es una
// muestra: nada se guarda y no se inventa el total de episodios de cada obra.
// ============================================================

/** Por dónde va la muestra. Las películas no llevan contador. */
const SAMPLE: Partial<Record<ShelfFormat, number>> = { tv: 4, anime: 7, manga: 31, book: 86, comic: 12, game: 18 };

const SWIPE_PX = 40;
const SEGMENTS = 10;

export interface ShelfLabels {
  shelf: string;
  plusOne: string;
  units: Partial<Record<ShelfFormat, string>>;
  formats: Record<ShelfFormat, string>;
  continueTitle: string;
  continueText: string;
}

function Cover({ item, eager, sizes, first }: { item: ShelfItem; eager: boolean; sizes: string; first?: boolean }) {
  const { src, srcSet } = coverSource(item.poster);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt=""
      width={500}
      height={750}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      fetchPriority={first ? "high" : "auto"}
      draggable={false}
    />
  );
}

function Ticks({ count }: { count: number }) {
  const lit = ((count - 1) % SEGMENTS) + 1;
  return (
    <span className="k2p-ticks" aria-hidden="true">
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <i key={i} data-on={i < lit || undefined} />
      ))}
    </span>
  );
}

export function Shelf({
  fan,
  start,
  rows,
  labels,
  top,
}: {
  fan: ShelfItem[];
  start: number;
  rows: ShelfItem[];
  labels: ShelfLabels;
  top: ReactNode;
}) {
  const [active, setActive] = useState(start);
  const [row, setRow] = useState(0);
  const [extra, setExtra] = useState<Record<string, number>>({});
  const swipe = useRef<number | null>(null);
  const swiped = useRef(false);
  const cards = useRef<Array<HTMLButtonElement | null>>([]);

  const n = fan.length;
  const countOf = (item: ShelfItem) => (SAMPLE[item.format] ?? 0) + (extra[item.id] ?? 0);
  const bump = (item: ShelfItem) => setExtra((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }));
  const unitText = (item: ShelfItem) => labels.units[item.format]?.replace("{n}", String(countOf(item)));

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = (active + (e.key === "ArrowLeft" ? -1 : 1) + n) % n;
    setActive(next);
    cards.current[next]?.focus();
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    swipe.current = e.clientX;
    swiped.current = false;
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (swipe.current === null) return;
    const dx = e.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) >= SWIPE_PX) {
      swiped.current = true;
      const next = (active + (dx > 0 ? -1 : 1) + n) % n;
      setActive(next);
      // El foco sigue a la activa: la carta anterior ya no está en el orden de tabulación.
      if (cards.current.includes(document.activeElement as HTMLButtonElement)) cards.current[next]?.focus();
    }
  };

  const current = fan[active];
  const currentUnit = current ? unitText(current) : undefined;
  const selected = rows[row];

  return (
    <>
      <section className="k2p-hero">
        {top}
        <div
          className="k2p-fan"
          role="group"
          aria-label={labels.shelf}
          onKeyDown={onKey}
          onPointerDown={onDown}
          onPointerUp={onUp}
        >
          {fan.map((item, i) => {
            const raw = ((i - active + n) % n + n) % n;
            const d = raw > n / 2 ? raw - n : raw;
            const a = Math.abs(d);
            const sign = Math.sign(d);
            return (
              <button
                key={item.id}
                ref={(el) => {
                  cards.current[i] = el;
                }}
                type="button"
                className="k2p-card"
                aria-label={`${item.title}, ${labels.formats[item.format]}`}
                aria-pressed={a === 0}
                tabIndex={a === 0 ? 0 : -1}
                onClick={(e) => {
                  // El clic que sigue a un deslizamiento no cuenta; Enter (detail 0) siempre.
                  if (e.detail === 0 || !swiped.current) setActive(i);
                }}
                style={
                  {
                    "--x": sign * (a ? 165 + a * 105 : 0),
                    "--z": `${-a * 80}px`,
                    "--r": `${-sign * Math.min(58, 30 + a * 6)}deg`,
                    "--a": a,
                    "--b": 1 - a * 0.08,
                    zIndex: 20 - a,
                  } as React.CSSProperties
                }
              >
                <span className="k2p-card__title" aria-hidden="true">
                  {item.title}
                </span>
                <Cover
                  item={item}
                  eager={a < 3}
                  first={a === 0}
                  sizes={a === 0 ? "(max-width: 600px) 60vw, 26vw" : "(max-width: 600px) 30vw, 16vw"}
                />
              </button>
            );
          })}
        </div>
        {current ? (
          <div className="k2p-now" style={{ "--c": formatVar(current.format) } as React.CSSProperties}>
            <div className="k2p-now__text">
              <b>{current.title}</b>
              <small aria-live="polite">{currentUnit ?? labels.formats[current.format]}</small>
            </div>
            {currentUnit ? (
              <>
                <Ticks count={countOf(current)} />
                <button type="button" className="k2p-plus" aria-label={labels.plusOne} onClick={() => bump(current)}>
                  +1
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      {selected ? (
        <section className="k2p-cont" aria-labelledby="k2p-cont-title">
          <div className="k2p-cont__list">
            <div className="k2p-cont__head">
              <h2 id="k2p-cont-title">{labels.continueTitle}</h2>
              <p>{labels.continueText}</p>
            </div>
            <ul>
              {rows.map((item, i) => (
                <li
                  key={item.id}
                  className="k2p-row"
                  data-on={i === row || undefined}
                  style={{ "--c": formatVar(item.format) } as React.CSSProperties}
                >
                  <button type="button" className="k2p-row__pick" aria-pressed={i === row} onClick={() => setRow(i)}>
                    <Cover item={item} eager={false} sizes="44px" />
                    <span>
                      <b>{item.title}</b>
                      <small aria-live="polite">{unitText(item)}</small>
                      <Ticks count={countOf(item)} />
                    </span>
                  </button>
                  {i === row ? (
                    <button type="button" className="k2p-plus" aria-label={`${labels.plusOne}: ${item.title}`} onClick={() => bump(item)}>
                      +1
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="k2p-cont__stage" aria-hidden="true">
            {rows.map((item, i) => (
              <div key={item.id} className="k2p-cont__cover" data-on={i === row || undefined}>
                <Cover item={item} eager={false} sizes="(max-width: 900px) 240px, 30vw" />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
