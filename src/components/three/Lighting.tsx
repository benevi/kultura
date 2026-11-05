"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import type { SpotLight } from "three";
import { pointer } from "./pointer";

/** HDRI de estudio (Poly Haven, CC0) autoalojado: lo lee RGBELoader, sin WASM. */
export const STUDIO_HDR = "/3d/studio_small_09_1k.hdr";

/**
 * Luz de la escena: un entorno de estudio para los reflejos y el relleno, una
 * luz principal con sombras que sigue al cursor (la «linterna» de la sala) y
 * sombras de contacto bajo los objetos. Todo lo que no es el objeto queda en
 * sombra: el color lo ponen las portadas.
 */
export function Lighting({ floorY = 0, floorScale = 6 }: { floorY?: number; floorScale?: number }) {
  const key = useRef<SpotLight>(null);
  useFrame(() => {
    const l = key.current;
    if (!l) return;
    l.position.set(pointer.x * 1.6, 1.6 + pointer.y * 0.6, 2.2);
    l.target.position.set(pointer.x * 0.5, 0.2, 0);
    l.target.updateMatrixWorld();
  });
  return (
    <>
      <Environment files={STUDIO_HDR} environmentIntensity={0.55} />
      <spotLight
        ref={key}
        color="#fff3e2"
        intensity={18}
        angle={0.55}
        penumbra={0.8}
        decay={1.6}
        distance={12}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <directionalLight color="#9db8ff" intensity={0.9} position={[-3, 2.5, -2.5]} />
      <ContactShadows position={[0, floorY, 0]} scale={floorScale} blur={2.2} opacity={0.75} far={1.4} resolution={512} frames={40} />
    </>
  );
}
