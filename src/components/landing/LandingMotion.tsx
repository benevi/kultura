"use client";

import { useEffect, useRef } from "react";
import { startLanding, type HeroScene } from "./engine";

/**
 * Isla cliente de la landing: solo el lienzo fijo de las ventanas. Al montar
 * arranca el motor sobre el HTML que ya pintó el servidor (portada, ventanas,
 * pasos y pulsación larga) y lo desmonta al salir.
 */
export function LandingMotion({ scenes }: { scenes: HeroScene[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>(".kl");
    if (!root || scenes.length === 0) return;
    return startLanding(root, scenes);
  }, [scenes]);
  return <canvas ref={ref} className="kl-gl" aria-hidden="true" />;
}
