"use client";

// ============================================================
// KULTURA — Página derecha del álbum: «Te faltan» y el sobre
//
// Huecos numerados con el título impreso (pendiente). El primer pintado es
// esta página tal cual, en el HTML; luego, según el dispositivo
// (`burstMode`):
//   - escena: tras el primer pintado y en un rato libre se carga three.js
//     (`import()` de `sobre-scene`) y los cromos salen del sobre hacia sus
//     huecos: en escritorio al bajar la primera pantalla, en el móvil una
//     sola vez al aparecer la página. Cada cromo que se posa se queda como
//     HTML (`onLand`).
//   - quieto (movimiento reducido, sin WebGL 2, ahorro de datos, equipo
//     justo, o si la escena falla): los mismos huecos se llenan sin escena,
//     con un pegado escalonado (40 ms por cromo) o al instante con
//     movimiento reducido.
// Los cromos y los huecos los pinta el servidor (`cromos`): aquí solo se
// decide cuáles están pegados. Así esta pieza no arrastra `next/image`.
// ============================================================

import * as React from "react";
import { Slot } from "@/components/album/Slot";
import { Sobre } from "@/components/landing/Sobre";
import {
  BURST_SCROLL_MIN_WIDTH,
  burstCount,
  burstMode,
  scrollProgress,
  textureUrl,
  type BurstEnv,
} from "@/lib/landing/album";
import type { SobreScene, StageRect } from "@/lib/landing/sobre-scene";
import { cn } from "@/lib/utils/index";
import type { MediaType } from "@/types/media";

export interface MissingItem {
  id: string;
  title: string;
  type: MediaType;
  poster: string;
  foil: boolean;
}

export interface MissingPageProps {
  heading: string;
  /** Número del primer hueco (la página izquierda lleva los anteriores). */
  startNumber: number;
  items: MissingItem[];
  /** Cromo de cada título, pintado en el servidor (`LandingCromo`). */
  cromos: React.ReactNode[];
  /** Texto para el lector antes de cada título («Hueco 9, te falta:»). */
  pending: string[];
  formatLabels: Record<MediaType, string>;
}

/** Espacio del lienzo por encima de la página: el arco de los cromos. */
const CANVAS_OVERFLOW = 160;

/** Retraso del pegado escalonado (40 ms por cromo), en clases literales. */
const PASTE_DELAY = [
  "[animation-delay:0ms]",
  "[animation-delay:40ms]",
  "[animation-delay:80ms]",
  "[animation-delay:120ms]",
  "[animation-delay:160ms]",
  "[animation-delay:200ms]",
  "[animation-delay:240ms]",
  "[animation-delay:280ms]",
];

/** Color del cromo mientras su portada no ha llegado (superficie elevada del papel). */
const TEXTURE_BASE = "#e9f6fe";

type Nav = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

export function readBurstEnv(): BurstEnv {
  const nav = navigator as Nav;
  const mq = (q: string) => (typeof window.matchMedia === "function" ? window.matchMedia(q).matches : false);
  return {
    reducedMotion: mq("(prefers-reduced-motion: reduce)"),
    webgl2: typeof window.WebGL2RenderingContext !== "undefined",
    saveData: nav.connection?.saveData === true,
    deviceMemory: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
    width: window.innerWidth,
    coarse: mq("(pointer: coarse)"),
  };
}

/** Tras el primer pintado y con el navegador libre (REN-4). */
function whenIdle(fn: () => void): () => void {
  let cancelled = false;
  let idleId: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    if (cancelled) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (typeof w.requestIdleCallback === "function") idleId = w.requestIdleCallback(() => !cancelled && fn(), { timeout: 2500 });
    else timer = setTimeout(() => !cancelled && fn(), 200);
  };
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", run);
    if (timer) clearTimeout(timer);
    const w = window as Window & { cancelIdleCallback?: (id: number) => void };
    if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
  };
}

export function MissingPage({ heading, startNumber, items, cromos, pending, formatLabels }: MissingPageProps) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const listRef = React.useRef<HTMLOListElement>(null);
  const sobreRef = React.useRef<HTMLDivElement>(null);
  const [filled, setFilled] = React.useState<boolean[]>(() => items.map(() => false));
  const [paste, setPaste] = React.useState(false);
  const [torn, setTorn] = React.useState(false);
  const [live, setLive] = React.useState(false);

  React.useEffect(() => {
    if (items.length === 0 || typeof window.matchMedia !== "function") return;
    let disposed = false;
    let scene: SobreScene | null = null;
    let offscreen = false;
    const offs: Array<() => void> = [];
    const env = readBurstEnv();
    const mode = burstMode(env);
    const count = burstCount(mode, env.width >= BURST_SCROLL_MIN_WIDTH, items.length);
    if (count === 0) return;

    const fillStatic = (animate: boolean) => {
      scene?.dispose();
      scene = null;
      setLive(false);
      setTorn(true);
      setPaste(animate);
      setFilled(items.map((_, i) => i < count));
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReduce = () => {
      if (reduce.matches && !disposed) fillStatic(false);
    };
    reduce.addEventListener?.("change", onReduce);
    offs.push(() => reduce.removeEventListener?.("change", onReduce));

    if (mode === "static") {
      fillStatic(!env.reducedMotion);
      return () => offs.forEach((off) => off());
    }

    const measure = () => {
      const canvas = canvasRef.current!;
      const box = canvas.getBoundingClientRect();
      const rel = (el: Element | null): StageRect => {
        const r = (el ?? canvas).getBoundingClientRect();
        return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
      };
      const slots = Array.from(listRef.current?.querySelectorAll("[data-slot] > div") ?? []).slice(0, count);
      return { width: box.width, height: box.height, origin: rel(sobreRef.current), targets: slots.map(rel) };
    };

    const boot = async () => {
      const { createSobreScene } = await import("@/lib/landing/sobre-scene");
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (disposed || !canvas || !stage) return;
      const m = measure();
      scene = createSobreScene({
        canvas,
        ...m,
        dpr: window.devicePixelRatio || 1,
        cards: items.slice(0, count).map((it) => ({ src: textureUrl(it.poster), foil: it.foil, base: TEXTURE_BASE })),
        onLand: (i, landed) =>
          setFilled((prev) => {
            if (prev[i] === landed) return prev;
            const next = [...prev];
            next[i] = landed;
            return next;
          }),
        onTear: () => setTorn(true),
      });
      setLive(true);

      const ro = new ResizeObserver(() => {
        const next = measure();
        scene?.layout(next.width, next.height, next.origin, next.targets);
      });
      ro.observe(stage);
      offs.push(() => ro.disconnect());

      const sync = () => scene?.pause(offscreen || document.hidden);
      const io = new IntersectionObserver(([e]) => {
        offscreen = !e.isIntersecting;
        sync();
      });
      io.observe(stage);
      document.addEventListener("visibilitychange", sync);
      offs.push(() => io.disconnect(), () => document.removeEventListener("visibilitychange", sync));

      if (mode === "scroll") {
        const onScroll = () => scene?.setProgress(scrollProgress(window.scrollY, 0, window.innerHeight * 0.45));
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        offs.push(() => window.removeEventListener("scroll", onScroll));
      } else {
        const play = new IntersectionObserver(
          ([e]) => {
            if (e.intersectionRatio >= 0.4) {
              scene?.play();
              play.disconnect();
            }
          },
          { threshold: [0.4] }
        );
        play.observe(stage);
        offs.push(() => play.disconnect());
      }
    };

    const start = () =>
      offs.push(
        whenIdle(() => {
          boot().catch(() => {
            if (!disposed) fillStatic(!readBurstEnv().reducedMotion);
          });
        })
      );

    if (mode === "scroll") start();
    else {
      // Móvil: three.js solo se pide cuando la página está a punto de verse.
      const near = new IntersectionObserver(
        ([e]) => {
          if (!e.isIntersecting) return;
          near.disconnect();
          start();
        },
        { rootMargin: "300px 0px" }
      );
      if (stageRef.current) near.observe(stageRef.current);
      offs.push(() => near.disconnect());
    }

    return () => {
      disposed = true;
      scene?.dispose();
      offs.forEach((off) => off());
    };
  }, [items]);

  return (
    <div ref={stageRef} className="relative">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 id="missing-title" className="font-display text-3xl text-text-primary md:text-4xl">
          {heading}
        </h2>
        <div ref={sobreRef} className="shrink-0">
          <Sobre torn={torn} />
        </div>
      </div>
      <ol ref={listRef} aria-labelledby="missing-title" className="grid grid-cols-4 gap-3 md:max-w-[30rem]">
        {items.map((it, i) => (
          <li key={it.id}>
            <Slot
              number={startNumber + i}
              title={it.title}
              format={it.type}
              formatLabel={formatLabels[it.type]}
              label={pending[i]}
              band={
                <span aria-hidden="true" className="block h-4 truncate text-xs font-semibold text-text-primary">
                  {filled[i] ? it.title : ""}
                </span>
              }
            >
              {filled[i] ? (
                <div className={cn("h-full", paste && "animate-paste", paste && PASTE_DELAY[i])}>{cromos[i]}</div>
              ) : null}
            </Slot>
          </li>
        ))}
      </ol>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        data-burst-canvas=""
        className={cn("pointer-events-none absolute inset-x-0 z-10 w-full", live ? null : "invisible")}
        style={{ top: -CANVAS_OVERFLOW, height: `calc(100% + ${CANVAS_OVERFLOW}px)` }}
      />
    </div>
  );
}
