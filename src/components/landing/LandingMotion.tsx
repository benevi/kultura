"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { startLanding, type HeroScene } from "./engine";
import { useSceneGate } from "@/components/three/useSceneGate";

// El chunk de three/R3F solo se pide cuando la puerta (useSceneGate) lo
// permite: nunca compite con el LCP ni llega a quien no puede moverlo.
const HeroCanvas = dynamic(() => import("@/components/three/HeroCanvas"), { ssr: false });

/**
 * Isla cliente de la landing. Sobre el HTML que ya pintó el servidor:
 * - el héroe 3D (objetos reales con las portadas de la semana), si la puerta
 *   lo permite; si no, se queda la portada estática del servidor;
 * - el motor v2 para el resto (ventanas con profundidad, pasos, pulsación larga).
 */
export function LandingMotion({ scenes }: { scenes: HeroScene[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const gate = useSceneGate();
  const [active, setActive] = useState(true);

  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>(".kl");
    if (!root || scenes.length === 0) return;
    return startLanding(root, scenes);
  }, [scenes]);

  // El bucle de render solo corre mientras el héroe está en pantalla.
  useEffect(() => {
    const stage = ref.current?.closest<HTMLElement>(".kl-stage");
    if (!stage) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.05 });
    io.observe(stage);
    return () => io.disconnect();
  }, []);

  const covers = scenes.slice(0, 3).map((s) => ({ image: s.image, title: s.caption, format: s.meta, accent: s.accent }));
  return (
    <div ref={ref} className="kl-hero3d">
      {gate && covers.length > 0 && (
        <HeroCanvas
          covers={covers}
          active={active}
          onReady={() => ref.current?.closest<HTMLElement>(".kl-stage")?.setAttribute("data-gl", "")}
        />
      )}
      <canvas className="kl-gl" aria-hidden="true" />
    </div>
  );
}
