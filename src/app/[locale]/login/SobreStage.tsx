"use client";

import { useEffect, useRef, useState } from "react";
import { Cromo } from "@/components/album/Cromo";
import { Logo } from "@/components/layout/Logo";
import { sceneAllowed, textureUrl } from "@/lib/landing/immersive";
import type { MediaType } from "@/types/media";
import { cn } from "@/lib/utils/index";
import {
  BURST_MAX_MS,
  BURST_MS,
  SOBRE_BOX,
  SOBRE_VIEWBOX_H,
  STAGE_MAX_CROMOS,
  TUCK_DROP,
  TUCK_TURN,
  burstDelays,
  cromoBox,
  fanPoses,
  sobrePoints,
} from "./sobre-layout";

export interface SobreCover {
  id: string;
  title: string;
  type: MediaType;
  poster: string;
}

interface SobreStageProps {
  /** Portadas reales del catálogo. Sin ellas: los huecos del abanico, vacíos. */
  covers: SobreCover[];
  className?: string;
}

/**
 * Escritorio capaz para la escena 3D: puntero fino, ancho de escritorio y
 * sin movimiento reducido. Lo demás (memoria, núcleos, ahorro de datos) lo
 * decide `sceneAllowed`, el mismo criterio que la portada.
 */
const SCENE_QUERY = "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/** La escena no arranca antes de que acabe la salida del abanico en CSS. */
const SCENE_AFTER_MS = BURST_MAX_MS + 120;

/**
 * Salida del abanico: cada cromo sube desde dentro del sobre a su sitio con la
 * curva de pegar (360 ms, 40 ms entre uno y otro, ≤ 600 ms en total), UNA vez,
 * desde un estado visible (los cromos asomando). Solo CSS: funciona sin JS y
 * con movimiento reducido el abanico ya está abierto.
 */
function stageCss(angles: number[], delays: number[]): string {
  const rules = angles.map((angle, i) => {
    const from = `translateY(${TUCK_DROP * 100}%) rotate(${round(angle * TUCK_TURN)}deg)`;
    const to = `rotate(${round(angle)}deg)`;
    return (
      `@keyframes kultura-sobre-out-${i}{from{transform:${from}}to{transform:${to}}}` +
      `[data-sobre-cromo="${i}"]{transform:${to};animation:kultura-sobre-out-${i} ${BURST_MS}ms cubic-bezier(.3,1.3,.5,1) ${delays[i] ?? 0}ms both}`
    );
  });
  return `${rules.join("")}@media (prefers-reduced-motion: reduce){[data-sobre-cromo]{animation:none}}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Tras el primer pintado y en reposo (REN-9). */
function whenIdle(fn: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 2000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 200);
  return () => window.clearTimeout(id);
}

/**
 * El sobre de la portada de acceso: un sobre amarillo rasgado del que sale un
 * abanico de cromos con portadas REALES del catálogo (uno por formato). Es
 * decoración (el formulario no depende de él): va oculto al lector.
 *
 * Primer pintado: el abanico en HTML, igual en todas partes. En escritorios
 * capaces, después y en reposo, three.js lo vuelve a pintar EN EL MISMO SITIO
 * con profundidad (se inclina hacia el puntero); si algo falla, se queda el
 * HTML. En móvil y con movimiento reducido no se carga three.
 */
export function SobreStage({ covers, className }: SobreStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene] = useState<"off" | "ready">("off");

  const shown = covers.slice(0, STAGE_MAX_CROMOS);
  const poses = fanPoses(shown.length > 0 ? shown.length : STAGE_MAX_CROMOS);
  const delays = burstDelays(poses.length);
  const key = shown.map((c) => c.id).join("|");

  useEffect(() => {
    if (shown.length === 0) return;
    const media = window.matchMedia?.(SCENE_QUERY);
    if (!media?.matches) return;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const allowed = sceneAllowed({
      reducedMotion: false,
      width: window.innerWidth,
      saveData: nav.connection?.saveData,
      deviceMemory: nav.deviceMemory,
      cores: nav.hardwareConcurrency,
    });
    if (!allowed) return;

    let cancelled = false;
    let dispose: (() => void) | undefined;
    let cancelIdle: (() => void) | undefined;
    const fail = () => {
      dispose?.();
      dispose = undefined;
      if (!cancelled) setScene("off");
    };
    const timer = window.setTimeout(() => {
      cancelIdle = whenIdle(() => {
        if (cancelled || !webglAvailable()) return;
        void import("./sobre-scene")
          .then(({ mountSobreScene }) => {
            const canvas = canvasRef.current;
            const stage = stageRef.current;
            if (cancelled || !canvas || !stage) return;
            dispose = mountSobreScene({
              canvas,
              stage,
              poses,
              textures: shown.map((c) => textureUrl(c.poster)),
              onReady: () => {
                if (!cancelled) setScene("ready");
              },
              onFail: fail,
            }).dispose;
          })
          .catch(() => undefined);
      });
    }, SCENE_AFTER_MS);

    // Al dejar de ser escritorio (ventana estrecha, movimiento reducido), fuera.
    const onChange = () => {
      if (!media.matches) fail();
    };
    media.addEventListener?.("change", onChange);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelIdle?.();
      media.removeEventListener?.("change", onChange);
      dispose?.();
    };
    // Las portadas son las del servidor: solo cambian si cambia la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      ref={stageRef}
      aria-hidden="true"
      data-sobre=""
      data-scene={scene}
      className={cn("relative aspect-[5/4] w-full select-none overflow-hidden", className)}
    >
      <style href={`kultura-sobre-stage-${poses.length}`} precedence="default">
        {stageCss(
          poses.map((p) => p.angle),
          delays
        )}
      </style>

      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-base ease-out",
          scene === "ready" && "opacity-0"
        )}
      >
        {poses.map((pose, i) => {
          const box = cromoBox(pose);
          const cover = shown[i];
          return (
            <div
              key={cover?.id ?? `hueco-${i}`}
              data-sobre-cromo={cover ? i : undefined}
              className="absolute"
              style={{
                left: `${box.left}%`,
                top: `${box.top}%`,
                width: `${box.width}%`,
                transformOrigin: "50% 100%",
                transform: cover ? undefined : `rotate(${pose.angle}deg)`,
              }}
            >
              {cover ? (
                <Cromo
                  title={cover.title}
                  seed={cover.id}
                  poster={cover.poster}
                  sizes="(min-width: 1024px) 180px, 30vw"
                  still
                />
              ) : (
                <div className="aspect-[2/3] w-full rounded-cromo border-2 border-dashed border-slot-line" />
              )}
            </div>
          );
        })}
      </div>

      <canvas
        ref={canvasRef}
        className={cn(
          "absolute inset-0 h-full w-full opacity-0 transition-opacity duration-base ease-out",
          scene === "ready" && "opacity-100"
        )}
      />

      {/* La tapa del sobre, delante: oculta la base de los cromos. */}
      <div
        className="absolute bottom-0"
        style={{ left: `${SOBRE_BOX.left}%`, width: `${SOBRE_BOX.width}%`, height: `${SOBRE_BOX.height}%` }}
      >
        <svg
          viewBox={`0 0 100 ${SOBRE_VIEWBOX_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <polygon
            points={sobrePoints()}
            className="fill-album-yellow stroke-album-navy"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-[22%] flex justify-center">
          <Logo size={30} />
        </div>
      </div>
    </div>
  );
}
