"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { LaminaEngine, LaminaWork } from "./engine";
import { formatVar } from "../Blocks";

// ============================================================
// KULTURA v2 — Escenario de la portada
//
// El contenido fluye con el scroll normal sobre un lienzo fijo (sticky): sin
// JavaScript, sin WebGL o con movimiento reducido, el texto se lee igual y
// detrás queda la portada fija. El motor se carga aparte y en reposo.
// El «+1» es de muestra: no guarda nada y no necesita cuenta.
// ============================================================

export interface StageWork extends LaminaWork {
  id: string;
  title: string;
  formatLabel: string;
  /** «Episodio {n}», ya traducido por el servidor con `{n}` sin sustituir. */
  unit: string;
  start: number;
  total: number;
  width: number;
  height: number;
}

interface Props {
  works: StageWork[];
  labels: { plusOne: string; formats: string };
  nav: ReactNode;
  headline: ReactNode;
  actions: ReactNode;
  children: ReactNode;
}

export function Stage({ works, labels, nav, headline, actions, children }: Props) {
  const stage = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<LaminaEngine | null>(null);
  const [live, setLive] = useState(false);
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState(() => works.map((w) => w.start));
  const work = works[index] as StageWork | undefined;
  const value = marks[index];

  useEffect(() => {
    if (works.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let onScroll: (() => void) | undefined;

    const boot = () => {
      import("./engine").then(({ startLaminas }) => {
        if (cancelled || !canvas.current) return;
        const started = startLaminas(
          canvas.current,
          works,
          works[0].start / works[0].total,
          () => {
            if (!cancelled) setLive(true);
          },
          () => {
            if (!cancelled) setLive(false);
          },
        );
        if (!started) return;
        engine.current = started;
        onScroll = () => {
          const el = stage.current;
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const range = Math.max(1, rect.height - window.innerHeight);
          started.setScroll(-rect.top / range);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
      }).catch(() => {
        // Sin el motor queda la portada fija: no es un error para quien visita.
      });
    };

    // Después del primer pintado: el titular es el LCP y no compite con esto.
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(boot, { timeout: 1200 })
      : window.setTimeout(boot, 400);

    return () => {
      cancelled = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      if (onScroll) window.removeEventListener("scroll", onScroll);
      engine.current?.destroy();
      engine.current = null;
    };
  }, [works]);

  const pick = useCallback(
    (next: number) => {
      setIndex(next);
      engine.current?.setWork(next, marks[next] / works[next].total);
    },
    [marks, works],
  );

  const plusOne = useCallback(() => {
    if (!work) return;
    const next = value >= work.total ? 1 : value + 1;
    setMarks((all) => all.map((m, i) => (i === index ? next : m)));
    engine.current?.setSeen(next / work.total);
  }, [index, value, work]);

  // Sin obras de la semana ni reserva: la portada se lee igual, sin marcador.
  if (!work) {
    return (
      <section ref={stage} className="k2-stage">
        <div className="k2-stage__headline">{headline}</div>
        <div className="k2-stage__hero">
          {nav}
          <div className="k2-stage__band">{actions}</div>
        </div>
        {children}
      </section>
    );
  }

  return (
    <section ref={stage} className="k2-stage" style={{ "--k-accent": formatVar(work.id) } as React.CSSProperties}>
      <div className="k2-stage__headline">{headline}</div>

      <div className="k2-stage__sticky" aria-hidden="true">
        {/* Portada fija hasta que el motor pinta. Decorativa: el título está en el marcador. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`k2-stage__poster${live ? " is-hidden" : ""}`}
          src={work.image}
          alt=""
          width={work.width}
          height={work.height}
          decoding="async"
        />
        <canvas ref={canvas} className="k2-stage__canvas" />
      </div>

      <div className="k2-stage__hero">
        {nav}
        <div className="k2-stage__band">
          <div className="k2-tracker">
            <div className="k2-tracker__formats" role="group" aria-label={labels.formats}>
              {works.map((w, i) => (
                <button
                  key={w.id}
                  type="button"
                  className="k2-tracker__format"
                  aria-pressed={i === index}
                  style={{ "--k-accent": formatVar(w.id) } as React.CSSProperties}
                  onClick={() => pick(i)}
                >
                  {w.formatLabel}
                </button>
              ))}
            </div>
            <div className="k2-tracker__row">
              <p className="k2-tracker__now" aria-live="polite">
                <span className="k2-tracker__title">{work.title}</span>
                <span className="k2-tracker__unit">{work.unit.replace("{n}", String(value))}</span>
              </p>
              <button type="button" className="k2-btn k2-tracker__plus" onClick={plusOne} aria-label={`+1. ${labels.plusOne}: ${work.title}`}>
                +1
              </button>
            </div>
          </div>
          {actions}
        </div>
      </div>

      {children}
    </section>
  );
}
