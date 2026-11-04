"use client";

import { useEffect, useState } from "react";
import { sceneAllowed } from "@/lib/landing/immersive";

/**
 * Decide en el cliente si merece la pena arrancar la escena 3D y cuándo.
 *
 * - Qué: `sceneAllowed` (reduced motion, ancho, Save-Data, memoria, núcleos) y
 *   que el navegador tenga WebGL sin «software rendering».
 * - Cuándo: nunca antes del LCP. Se espera al primer hueco libre del hilo
 *   (`requestIdleCallback`, con tope) para que el chunk de three no compita
 *   con la portada, que es el LCP de la página.
 *
 * Devuelve `false` hasta que todo se cumple; con `false` la página se queda
 * con el HTML del servidor (la composición terminada), que es también lo que
 * ven los lectores de pantalla y el modo de movimiento reducido.
 */
export function useSceneGate(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    const allowed = sceneAllowed({
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      width: innerWidth,
      saveData: nav.connection?.saveData,
      deviceMemory: nav.deviceMemory,
      cores: nav.hardwareConcurrency,
    });
    // `?3d=1` fuerza la escena (capturas y vídeos en máquinas sin GPU, como la CI).
    const forced = new URLSearchParams(location.search).get("3d") === "1";
    if ((!allowed && !forced) || !hasWebGL()) return;
    let cancelled = false;
    const go = () => {
      if (!cancelled) setReady(true);
    };
    const idle = typeof window.requestIdleCallback === "function";
    const handle = idle ? window.requestIdleCallback(go, { timeout: 1500 }) : window.setTimeout(go, 600);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(handle);
      else clearTimeout(handle);
    };
  }, []);
  return ready;
}

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl", { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}
