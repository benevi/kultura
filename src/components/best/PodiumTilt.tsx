"use client";

// ============================================================
// KULTURA — El momento 3D del ranking: los brillantes miran al puntero
// Envuelve el podio (HTML del servidor, legible sin JS). Tras pintar y en
// reposo decide el pintor (`tiltMode`): en escritorio con WebGL carga la
// escena de three.js (`lib/best/podium-scene`, import dinámico, nunca en el
// JS inicial); con puntero fino sin WebGL, inclinación CSS con los mismos
// muelles; en móvil, tableta o con movimiento reducido, nada (el podio queda
// quieto y el brillo es solo CSS).
// ============================================================

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import { isSettled, stepSpring, targetTilt, tiltMode, tiltTransform, type SpringState } from "@/lib/best/tilt";

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

function whenIdle(fn: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 2500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 1200);
  return () => window.clearTimeout(id);
}

/** Inclinación CSS de respaldo (mismo muelle, mismos 8° y 800 px). */
function startCssTilt(root: HTMLElement, cards: HTMLElement[]): () => void {
  const springs = cards.map(() => ({ rx: { x: 0, v: 0 } as SpringState, ry: { x: 0, v: 0 } as SpringState }));
  let pointer: { x: number; y: number } | null = null;
  let frame = 0;
  let last = 0;

  function tick(now: number) {
    const dt = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    let moving = false;
    cards.forEach((el, i) => {
      const target = pointer ? targetTilt(pointer.x, pointer.y, el.getBoundingClientRect()) : { rx: 0, ry: 0 };
      const s = springs[i];
      s.rx = stepSpring(s.rx, target.rx, dt);
      s.ry = stepSpring(s.ry, target.ry, dt);
      if (!isSettled(s.rx, target.rx) || !isSettled(s.ry, target.ry)) moving = true;
      el.style.transform = tiltTransform({ rx: s.rx.x, ry: s.ry.x });
    });
    frame = moving ? requestAnimationFrame(tick) : 0;
    if (!moving) last = 0;
  }
  function wake() {
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function onMove(e: PointerEvent) {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    pointer = { x: e.clientX, y: e.clientY };
    wake();
  }
  function onLeave() {
    pointer = null;
    wake();
  }
  root.addEventListener("pointermove", onMove, { passive: true });
  root.addEventListener("pointerleave", onLeave);
  return () => {
    cancelAnimationFrame(frame);
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerleave", onLeave);
    for (const el of cards) el.style.transform = "";
  };
}

export function PodiumTilt({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let stop: (() => void) | undefined;
    let cancelled = false;

    const cancelIdle = whenIdle(() => {
      const list = root.querySelector<HTMLElement>("[data-podium]");
      const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-podium-cromo]"));
      if (!list || cards.length === 0) return;
      const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
      const mode = tiltMode({
        reducedMotion: prefersReducedMotion(),
        finePointer: window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false,
        width: window.innerWidth,
        webgl: hasWebGL(),
        saveData: nav.connection?.saveData === true,
        cores: nav.hardwareConcurrency ?? 0,
      });
      if (mode === "none") return;
      if (mode === "css") {
        stop = startCssTilt(list, cards);
        return;
      }
      import("@/lib/best/podium-scene")
        .then(({ startPodiumScene }) => startPodiumScene(root, cards))
        .then((scene) => {
          if (cancelled) scene.destroy();
          else stop = () => scene.destroy();
        })
        .catch(() => {
          // Portada sin CORS, contexto WebGL perdido…: inclinación CSS.
          if (!cancelled) stop = startCssTilt(list, cards);
        });
    });

    return () => {
      cancelled = true;
      cancelIdle();
      stop?.();
    };
  }, []);

    // `relative`: el lienzo de la escena se monta aquí (no dentro del `<ol>`,
  // que solo admite `<li>`).
  return (
    <div ref={ref} className="relative">
      {children}
    </div>
  );
}
