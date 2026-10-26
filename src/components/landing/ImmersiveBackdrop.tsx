"use client";

// ============================================================
// KULTURA — Fondo del hero de la landing (D-11: hero único)
//
// El mensaje NO vive aquí: titular, subtítulo y botones son HTML del Server
// Component `Hero` y se ven desde el primer pintado. Esto es el FONDO, la
// galería WebGL de portadas (E-LANDING-INMERSIVA):
//
//   - Arranca cuando el navegador está libre tras la carga
//     (`requestIdleCallback`, REN-4): nunca compite con el primer pintado.
//   - Solo en pantallas ≥ 768 px, sin "reducir movimiento", sin ahorro de
//     datos y en equipos con más de 4 GB y 4 núcleos (`sceneAllowed`). Si no,
//     fondo quieto: collage en escritorio, tira de portadas en móvil.
//   - Sigue siendo una intro automática que no se salta (decisión de Víctor),
//     pero se PAUSA con el botón de `MotionToggle` (WCAG 2.2.2), que va antes
//     de la cabecera para llegar a él con el primer Tab.
//   - El capítulo de formatos ya no es una palabra gigante encima del texto:
//     mientras la cámara presenta cada formato, esa palabra se ilumina en el
//     propio titular (`data-active` en la sección; ver `Hero`). No hay
//     `aria-live`: el titular ya nombra los siete.
//   - Al acabar, el muro de portadas se queda como fondo de toda la página.
// ============================================================

import * as React from "react";
import type { ShowcaseItem } from "@/lib/landing/showcase";
import type { ImmersiveScene } from "@/lib/landing/immersive-scene";
import { heroMotion } from "@/lib/landing/motion";
import {
  SCENE_MEDIA,
  TYPE_HUE,
  activeFormatAt,
  introProgress,
  sceneAllowed,
  textureUrl,
} from "@/lib/landing/immersive";
import type { MediaType } from "@/types/media";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Tope para enseñar la galería aunque falten portadas. */
const REVEAL_MAX_MS = 3500;
/** Sin muestra todavía (fallback del Suspense) se espera algo más. */
const EMPTY_REVEAL_MS = 4000;

type NavigatorExtras = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

/** Lee el entorno y decide si hay galería (ver `sceneAllowed`). */
function readSceneAllowed(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  const nav = navigator as NavigatorExtras;
  return sceneAllowed({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    width: window.innerWidth,
    saveData: nav.connection?.saveData === true,
    deviceMemory: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
    cores: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined,
  });
}

/**
 * `null` mientras no se sabe (servidor y primer render), luego true/false.
 * Escucha los cambios de "reducir movimiento" y de ancho (ACC-6): si la
 * persona activa la preferencia con la página abierta, la galería se retira.
 */
function useSceneAllowed(): boolean | null {
  const [allowed, setAllowed] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setAllowed(false);
      return;
    }
    const update = () => setAllowed(readSceneAllowed());
    update();
    const queries = [window.matchMedia("(prefers-reduced-motion: reduce)"), window.matchMedia(SCENE_MEDIA)];
    queries.forEach((q) => q.addEventListener?.("change", update));
    return () => queries.forEach((q) => q.removeEventListener?.("change", update));
  }, []);
  return allowed;
}

/** Tras la carga y con el hilo libre: la escena nunca compite con el primer pintado. */
function whenIdle(cb: () => void): () => void {
  let idle = 0;
  let timer = 0;
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  const schedule = () => {
    if (w.requestIdleCallback) idle = w.requestIdleCallback(cb, { timeout: 2000 });
    else timer = window.setTimeout(cb, 200);
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  return () => {
    window.removeEventListener("load", schedule);
    if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
    window.clearTimeout(timer);
  };
}

export function ImmersiveBackdrop({
  items,
  collage,
}: {
  items: ShowcaseItem[];
  /**
   * Collage quieto de escritorio, pintado en el SERVIDOR y pasado como hijo:
   * así sus portadas, iconos y utilidades no viajan en el JS de la portada
   * (F-30: de ~155 a < 150 KB).
   */
  collage?: React.ReactNode;
}) {
  const allowed = useSceneAllowed();
  const [failed, setFailed] = React.useState(false);
  // El hero ya casi no se ve: el muro de portadas pasa a ser fondo de la página.
  const [past, setPast] = React.useState(false);
  const markerRef = React.useRef<HTMLSpanElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const animated = allowed === true && !failed;
  const quiet = allowed === false || failed;

  React.useEffect(() => {
    // La sección del hero (Server Component) es la que lleva el estado visual.
    const section = markerRef.current?.closest("section");
    const setActive = (a: MediaType | null) => {
      if (!section) return;
      if (a) section.dataset.active = a;
      else delete section.dataset.active;
    };
    if (!animated) {
      heroMotion.set("off");
      setActive(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!section || !canvas) return;

    let scene: ImmersiveScene | null = null;
    let cancelled = false;
    let visible = true;
    let raf = 0;
    let lastActive: MediaType | null = null;
    // Reloj de la intro: arranca cuando la galería se enseña. `elapsed` se
    // acumula solo mientras corre, así que la pausa la congela de verdad.
    let elapsed = 0;
    let lastNow = -1;
    let revealed = false;
    let done = false;
    let paused = heroMotion.get() === "paused";

    const apply = (p: number) => {
      scene?.setProgress(p);
      const a = activeFormatAt(p);
      if (a !== lastActive) {
        lastActive = a;
        setActive(a);
      }
    };

    const tick = (now: number) => {
      raf = 0;
      if (cancelled || done || paused) return;
      if (lastNow >= 0) elapsed += now - lastNow;
      lastNow = now;
      const p = introProgress(elapsed);
      apply(p);
      if (p >= 1) {
        done = true;
        // La intro acabó y el hero no se ve: no hay nada que mover.
        if (!visible) scene?.stop();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const run = () => {
      if (cancelled || paused) return;
      if (visible || !done) scene?.start();
      if (revealed && !done && !raf) {
        lastNow = -1;
        raf = requestAnimationFrame(tick);
      }
    };
    const halt = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      scene?.stop();
      // Las transiciones CSS en curso (fundido del lienzo, color del titular)
      // se terminan al instante: tras pausar no queda nada moviéndose.
      section.getAnimations?.({ subtree: true }).forEach((an) => an.finish());
    };

    const reveal = () => {
      if (cancelled || revealed) return;
      revealed = true;
      canvas.dataset.ready = "true";
      run();
    };
    const revealTimer = window.setTimeout(reveal, items.length > 0 ? REVEAL_MAX_MS : EMPTY_REVEAL_MS);

    const onPointer = (e: PointerEvent) => {
      scene?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    const onResize = () => scene?.resize();

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        setPast(entry.intersectionRatio < 0.35);
        // Hasta que acaba la intro la escena sigue aunque el hero se salga de
        // vista: el muro es el fondo de TODA la página.
        if (paused) return;
        if (visible || !done) scene?.start();
        else scene?.stop();
      },
      { threshold: [0, 0.35] }
    );
    io.observe(section);

    const unsubscribe = heroMotion.subscribe(() => {
      const next = heroMotion.get() === "paused";
      if (next === paused) return;
      paused = next;
      if (paused) halt();
      else run();
    });

    const cancelIdle = whenIdle(() => {
      import("@/lib/landing/immersive-scene")
        .then(({ createImmersiveScene }) => {
          if (cancelled) return;
          const bgCss = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "black";
          scene = createImmersiveScene(
            canvas,
            items.map((it) => ({ src: textureUrl(it.poster), hue: TYPE_HUE[it.type] ?? 300 })),
            {
              mobile: false,
              bgCss,
              // Sin muestra no hay nada que esperar: el tope enseña los gradientes.
              onReady: items.length > 0 ? reveal : undefined,
              onLost: () => !cancelled && setFailed(true),
            }
          );
          scene.setProgress(0);
          if (heroMotion.get() === "off") heroMotion.set("running");
          paused = heroMotion.get() === "paused";
          if (!paused) run();
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    });

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      cancelled = true;
      cancelIdle();
      unsubscribe();
      window.clearTimeout(revealTimer);
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      setActive(null);
      scene?.dispose();
    };
  }, [animated, items]);

  // Al desmontar (navegación a otra página) no queda ningún botón huérfano.
  React.useEffect(() => () => heroMotion.set("off"), []);

  return (
    <>
      <span ref={markerRef} hidden />
      {animated ? (
        <>
          {/* Fondo de TODA la página: el lienzo va fijo detrás del contenido
              (z negativo, sobre el fondo del body). Nunca en móvil. */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="fixed inset-0 -z-10 hidden h-full w-full opacity-0 transition-opacity duration-1000 data-[ready=true]:opacity-100 md:block"
          />
          {/* Velo: al salir el hero, el muro se atenúa para que las secciones se lean. */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 hidden bg-surface-base transition-opacity duration-700 md:block"
            style={{ opacity: past ? 0.84 : 0 }}
          />
          {/* Viñeta: el texto siempre se lee, pase la portada que pase detrás.
              Pesa a la izquierda y abajo, donde va el texto. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden md:block"
            style={{
              background:
                "linear-gradient(100deg, var(--bg) 0%, var(--bg) 48%, transparent 88%), linear-gradient(to top, var(--bg) 0%, transparent 45%)",
            }}
          />
          {/* Grano: rompe la planitud digital del fondo. Sin mix-blend-mode
              (obligaba a recomponer la pantalla entera en cada frame). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden opacity-[0.035] [transform:translateZ(0)] md:block"
            style={{ backgroundImage: GRAIN }}
          />
        </>
      ) : null}

      {/* Fondo quieto de escritorio: el collage de siempre, a la derecha. */}
      {quiet ? (
        <div className="pointer-events-none absolute right-8 top-1/2 hidden -translate-y-1/2 lg:block xl:right-16">
          {collage}
        </div>
      ) : null}
    </>
  );
}
