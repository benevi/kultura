"use client";

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Float, useTexture } from "@react-three/drei";
import { Box3, DoubleSide, Group, Mesh, SRGBColorSpace, Vector3 } from "three";
import { Model as Television } from "../models/television_02";
import { Model as Console } from "../models/gaming_console";
import { Model as Gamepad } from "../models/gamepad";
import { Model as Books } from "../models/book_encyclopedia_set_01";
import { Model as Walkman } from "../models/cassette_player";
import { pointer, stepPointer } from "../pointer";

/** Una portada real: imagen (mismo origen o CORS) y su formato. */
export interface HeroCover {
  image: string;
  title: string;
  format: string;
  accent: string;
}

/**
 * El héroe: tres objetos reales (Poly Haven, CC0) con las portadas de la
 * semana. La tele de tubo enseña la primera portada en su pantalla, los
 * libros llevan portadas en la tapa y la consola tiene su caja. Todo se
 * inclina un poco hacia el cursor; la luz lo sigue (ver Lighting).
 */
export function HeroStage({ covers }: { covers: HeroCover[] }) {
  const root = useRef<Group>(null);
  const tv = useRef<Group>(null);
  const books = useRef<Group>(null);
  const games = useRef<Group>(null);
  const { camera } = useThree();
  const [c0, c1, c2] = useMemo(() => [covers[0], covers[1] ?? covers[0], covers[2] ?? covers[0]], [covers]);

  useFrame((_, dt) => {
    stepPointer(Math.min(dt, 0.1), performance.now() / 1000);
    // La cámara deriva un poco con el cursor; los objetos se inclinan hacia él.
    camera.position.x += (pointer.x * 0.18 - camera.position.x) * 0.05;
    camera.position.y += (0.5 + pointer.y * 0.08 - camera.position.y) * 0.05;
    camera.lookAt(0, 0.16, 0);
    const lean = (g: Group | null, k: number) => {
      if (!g) return;
      g.rotation.y += (pointer.x * 0.12 * k - g.rotation.y) * 0.06;
      g.rotation.x += (-pointer.y * 0.06 * k - g.rotation.x) * 0.06;
    };
    lean(tv.current, 1);
    lean(books.current, 0.7);
    lean(games.current, 0.8);
  });

  return (
    <group ref={root} position={[0, -0.02, 0]} scale={1.3}>
      {/* Ves: la tele, con la portada de la semana en pantalla */}
      <group ref={tv} position={[0, 0, 0]}>
        <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.15} floatingRange={[0, 0.02]}>
          <Television />
          <Screen cover={c0} />
        </Float>
      </group>

      {/* Lees: libros reales apilados y uno de frente con una portada de Kultura */}
      <group ref={books} position={[-0.62, 0, 0.14]} rotation={[0, 0.35, 0]}>
        <Float speed={1} rotationIntensity={0.05} floatIntensity={0.1} floatingRange={[0, 0.015]}>
          <Books position={[0, 0, 0]} rotation={[0, -0.2, 0]} />
          <CoverBoard cover={c1} width={0.19} height={0.27} position={[0.12, 0.137, 0.16]} rotation={[0, 0.25, 0]} thickness={0.02} />
          <Walkman position={[-0.02, 0, 0.3]} rotation={[0, 1.0, 0]} scale={0.8} />
        </Float>
      </group>

      {/* Juegas: la consola y el mando, con la caja del juego de pie */}
      <group ref={games} position={[0.68, 0, 0.14]} rotation={[0, -0.4, 0]}>
        <Float speed={1.1} rotationIntensity={0.05} floatIntensity={0.1} floatingRange={[0, 0.015]}>
          <Console position={[0, 0, -0.05]} rotation={[0, 0.15, 0]} />
          <Gamepad position={[-0.02, 0, 0.3]} rotation={[0, -0.5, 0]} scale={0.75} />
          <CoverBoard cover={c2} width={0.17} height={0.23} position={[-0.26, 0.115, 0.1]} rotation={[0, 0.45, 0]} thickness={0.014} />
        </Float>
      </group>
    </group>
  );
}

/**
 * Carga una portada como textura sRGB (mismo origen o CORS, como ya hacía el
 * motor v2) y la recorta como `object-fit: cover` sobre un plano de proporción
 * `aspect` (ancho/alto): las escenas del héroe son 16:9 y las tapas 2:3.
 */
function useCover(url: string, aspect: number) {
  const tex = useTexture(url);
  useLayoutEffect(() => {
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    const img = tex.image as { width?: number; height?: number } | undefined;
    const ia = img?.width && img?.height ? img.width / img.height : aspect;
    if (ia > aspect) {
      tex.repeat.set(aspect / ia, 1);
      tex.offset.set((1 - aspect / ia) / 2, 0);
    } else {
      tex.repeat.set(1, ia / aspect);
      tex.offset.set(0, (1 - ia / aspect) / 2);
    }
    tex.needsUpdate = true;
  }, [tex, aspect]);
  return tex;
}

/**
 * La pantalla de la tele: el modelo es una sola malla, así que se mide su
 * caja y se coloca un plano emisivo pegado a la cara delantera, un poco más
 * pequeño que el frente (el marco del tubo queda alrededor).
 */
const SCREEN_ASPECT = 4 / 3;
function Screen({ cover }: { cover: HeroCover }) {
  const tex = useCover(cover.image, SCREEN_ASPECT);
  const mesh = useRef<Mesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    const parent = m?.parent;
    if (!m || !parent) return;
    // La tele se montó justo antes en el mismo grupo: su caja define el frente.
    const box = new Box3();
    parent.traverse((o) => {
      if (o !== m && (o as Mesh).isMesh) box.expandByObject(o);
    });
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const w = size.x * 0.64;
    m.position.set(center.x, center.y + size.y * 0.07, box.max.z - size.z * 0.03);
    m.scale.set(w, w / SCREEN_ASPECT, 1);
  }, []);
  return (
    <mesh ref={mesh}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.9} roughness={0.35} toneMapped />
    </mesh>
  );
}

/** Una caja fina con la portada en la cara delantera: el «libro» o la «caja de juego» de Kultura. */
function CoverBoard({
  cover,
  width,
  height,
  thickness,
  ...props
}: { cover: HeroCover; width: number; height: number; thickness: number } & React.JSX.IntrinsicElements["group"]) {
  const tex = useCover(cover.image, width / height);
  return (
    <group {...props}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, thickness]} />
        <meshStandardMaterial color="#111114" roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0, thickness / 2 + 0.0005]} castShadow>
        <planeGeometry args={[width * 0.985, height * 0.985]} />
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.25} roughness={0.5} side={DoubleSide} />
      </mesh>
    </group>
  );
}
