"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor, Preload } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";
import { Lighting } from "./Lighting";
import { HeroStage, type HeroCover } from "./scenes/HeroStage";
import { listenPointer } from "./pointer";

/**
 * El lienzo del héroe. Sigue el starter oficial de R3F para Next
 * (react-three-next): se importa con `next/dynamic` y `ssr:false` desde
 * `LandingMotion`, precarga todo (`Preload all`) y baja la resolución si el
 * dispositivo no sigue el ritmo (`PerformanceMonitor`). El bucle solo corre
 * mientras el héroe está en pantalla (`active`).
 */
export default function HeroCanvas({ covers, active, onReady }: { covers: HeroCover[]; active: boolean; onReady?: () => void }) {
  const [dpr, setDpr] = useState(1.5);
  useEffect(() => listenPointer(), []);
  return (
    <Canvas
      className="kl-three"
      frameloop={active ? "always" : "never"}
      dpr={dpr}
      shadows
      camera={{ fov: 32, position: [0, 0.55, 2.9], near: 0.1, far: 40 }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.95;
        onReady?.();
      }}
      aria-hidden="true"
    >
      <PerformanceMonitor onIncline={() => setDpr(Math.min(1.75, devicePixelRatio || 1))} onDecline={() => setDpr(1)} flipflops={2} onFallback={() => setDpr(0.85)} />
      <Suspense fallback={null}>
        <HeroStage covers={covers} />
        <Lighting floorY={-0.02} floorScale={5} />
        <Preload all />
      </Suspense>
    </Canvas>
  );
}
