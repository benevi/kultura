// ============================================================
// KULTURA — El sobre de la portada (three.js)
//
// Portadas REALES salen de un sobre rasgado y vuelan a los huecos vacíos de
// la página derecha del álbum. Este módulo es lo ÚNICO que importa three y
// solo se carga con `import()` dinámico tras el primer pintado y en un rato
// libre (`requestIdleCallback`), en equipos que pueden con ello
// (`burstMode` en `album.ts`). El álbum quieto es el primer pintado y el
// respaldo: si esto no llega o falla, los huecos se llenan sin escena.
//
// Cómo se mueve:
//   - Cada cromo sigue un muelle amortiguado (rigidez 170, amortiguación 26)
//     hacia su destino: en escritorio el destino lo marca el scroll de la
//     primera pantalla (`setProgress`); en el móvil, `play()` lo pone a 1 una
//     sola vez, con 40 ms entre cromo y cromo. El muelle casi crítico llega
//     en ~0,55 s y no rebota en bucle.
//   - Camino: sale de la boca del sobre de espaldas (el dorso del cromo), se
//     da la vuelta en el aire y se posa en su hueco. Al posarse, la pieza 3D
//     se retira y el hueco del HTML pinta su cromo (`onLand`), así el estado
//     final es HTML normal, nítido y accesible.
//   - Cromo = un plano con borde blanco de 3 px y radio 4 px dibujados en el
//     shader (medidos en píxeles reales a cualquier escala). El brillo
//     (banda especular) SOLO en los 10/10. Sombra corta y suave solo mientras
//     vuela.
//
// La cámara está calculada para que 1 unidad = 1 píxel en el plano z = 0:
// las posiciones del HTML (getBoundingClientRect) valen tal cual.
// ============================================================

import {
  Color,
  DoubleSide,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  WebGLRenderer,
  type Texture,
} from "three";
import {
  BURST_STAGGER_MS,
  LAND_AT,
  clamp01,
  cromoProgress,
  springSettled,
  springStep,
  type SpringState,
} from "@/lib/landing/album";

/** Rectángulo en píxeles relativo al lienzo (origen arriba a la izquierda). */
export interface StageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneCard {
  /** URL de la textura (mismo origen, ver `textureUrl`). */
  src: string;
  /** 10/10: lleva brillo. */
  foil: boolean;
  /** Color del respaldo mientras la portada no ha llegado (hex sRGB). */
  base: string;
}

export interface SobreSceneOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  dpr: number;
  /** Boca del sobre. */
  origin: StageRect;
  /** Huecos de destino, uno por cromo. */
  targets: StageRect[];
  cards: SceneCard[];
  /** El cromo `i` se ha posado (true) o ha vuelto a levantarse (false). */
  onLand: (index: number, landed: boolean) => void;
  /** Primer movimiento: el sobre se rasga. */
  onTear?: () => void;
}

export interface SobreScene {
  /** Escritorio: avance global 0-1 (el scroll de la primera pantalla). */
  setProgress(p: number): void;
  /** Móvil: una sola pasada hasta el final. */
  play(): void;
  /** Nuevas medidas (cambio de tamaño de la ventana o de la maquetación). */
  layout(width: number, height: number, origin: StageRect, targets: StageRect[]): void;
  /** Fuera de pantalla o pestaña oculta: no se pinta. */
  pause(paused: boolean): void;
  dispose(): void;
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalV;
void main() {
  vUv = uv;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CARD_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uBase;
uniform vec3 uBack;
uniform vec2 uSize;
uniform float uBorder;
uniform float uRadius;
uniform float uFoil;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormalV;

float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = sdRound(p, uSize * 0.5, uRadius);
  float alpha = 1.0 - smoothstep(-0.75, 0.75, d);
  if (alpha <= 0.0) discard;
  vec3 col;
  if (!gl_FrontFacing) {
    col = uBack;
  } else {
    vec2 innerHalf = uSize * 0.5 - uBorder;
    float inner = sdRound(p, innerHalf, max(uRadius - uBorder, 0.5));
    if (inner > 0.0) {
      col = vec3(1.0);
    } else {
      vec2 iuv = (p + innerHalf) / (2.0 * innerHalf);
      vec3 img = texture2D(uMap, iuv).rgb;
      col = mix(uBase, img, uHasMap);
      if (uFoil > 0.5) {
        float x = iuv.x + iuv.y * 0.35 - mod(uTime * 0.36, 2.2) + 0.6;
        col = mix(col, vec3(1.0), exp(-x * x * 40.0) * 0.45);
      }
    }
  }
  float light = 0.82 + 0.18 * abs(vNormalV.z);
  gl_FragColor = vec4(col * light, alpha);
  #include <colorspace_fragment>
}
`;

const SHADOW_FRAGMENT = /* glsl */ `
uniform vec2 uSize;
uniform float uOpacity;
uniform vec3 uInk;
varying vec2 vUv;
float sdRound(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 p = (vUv - 0.5) * (uSize + 32.0);
  float d = sdRound(p, uSize * 0.5, 6.0);
  float a = (1.0 - smoothstep(-10.0, 14.0, d)) * uOpacity;
  if (a <= 0.001) discard;
  gl_FragColor = vec4(uInk, a);
  #include <colorspace_fragment>
}
`;

/** Dorso del cromo (`--cromo-back`) y tinta de la sombra (`--album-ink`). */
const BACK_HEX = "#dceaf4";
const INK_HEX = "#04102c";
const FOV = 32;
/** Altura del arco por encima de la boca del sobre (px) y profundidad (hacia la cámara). */
const ARC_RISE = 150;
const ARC_DEPTH = 240;

interface Card {
  mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  shadow: Mesh<PlaneGeometry, ShaderMaterial>;
  texture: Texture;
  spring: SpringState;
  landed: boolean;
  tilt: number;
  side: number;
}

/**
 * Crea la escena sobre `canvas`. Lanza si el navegador no da un contexto
 * WebGL 2: quien llama cae entonces al álbum quieto.
 */
export function createSobreScene(opts: SobreSceneOptions): SobreScene {
  const renderer = new WebGLRenderer({
    canvas: opts.canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    throw new Error("sin WebGL 2");
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(opts.dpr, 2));
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 1, 6000);
  const geometry = new PlaneGeometry(1, 1);
  const loader = new TextureLoader();
  loader.setCrossOrigin("anonymous");
  const back = new Color(BACK_HEX);
  const ink = new Color(INK_HEX);

  let width = opts.width;
  let height = opts.height;
  let origin = opts.origin;
  let targets = opts.targets;
  let progress = 0;
  let playAt: number | null = null;
  let paused = false;
  let running = false;
  let torn = false;
  let last = 0;
  let time = 0;
  let disposed = false;

  const cards: Card[] = opts.cards.map((card, i) => {
    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: CARD_FRAGMENT,
      uniforms: {
        uMap: { value: null as Texture | null },
        uHasMap: { value: 0 },
        uBase: { value: new Color(card.base) },
        uBack: { value: back },
        uSize: { value: new Vector2(1, 1) },
        uBorder: { value: 3 },
        uRadius: { value: 4 },
        uFoil: { value: card.foil ? 1 : 0 },
        uTime: { value: 0 },
      },
      side: DoubleSide,
      transparent: true,
    });
    const shadowMaterial = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: SHADOW_FRAGMENT,
      uniforms: { uSize: { value: new Vector2(1, 1) }, uOpacity: { value: 0 }, uInk: { value: ink } },
      transparent: true,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);
    const shadow = new Mesh(geometry, shadowMaterial);
    mesh.renderOrder = 10 + i;
    shadow.renderOrder = i;
    mesh.visible = false;
    shadow.visible = false;
    scene.add(shadow, mesh);

    const texture = loader.load(card.src, () => {
      if (disposed) return;
      material.uniforms.uHasMap.value = 1;
      kick();
    });
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    material.uniforms.uMap.value = texture;

    return {
      mesh,
      shadow,
      texture,
      spring: { x: 0, v: 0 },
      landed: false,
      tilt: (i % 2 === 0 ? -1 : 1) * (0.14 + (i % 3) * 0.05),
      side: (i % 2 === 0 ? -1 : 1) * (24 + (i % 3) * 18),
    };
  });

  function resize() {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.position.set(0, 0, height / 2 / Math.tan((FOV * Math.PI) / 360));
    camera.updateProjectionMatrix();
  }
  resize();

  /** Destino del muelle del cromo `i` ahora mismo. */
  function targetFor(i: number, now: number): number {
    if (playAt !== null) return now - playAt >= i * BURST_STAGGER_MS ? 1 : 0;
    return cromoProgress(progress, i, cards.length);
  }

  function place(card: Card, i: number) {
    const t = targets[i];
    if (!t) {
      card.mesh.visible = false;
      card.shadow.visible = false;
      return;
    }
    const s = clamp01(card.spring.x);
    const ox = origin.x + origin.w / 2;
    const oy = origin.y + origin.h * 0.3;
    const tx = t.x + t.w / 2;
    const ty = t.y + t.h / 2;
    const cx = ox + (tx - ox) * 0.35 + card.side;
    const cy = Math.min(oy, ty) - ARC_RISE - (i % 3) * 24;
    const a = (1 - s) * (1 - s);
    const b = 2 * (1 - s) * s;
    const c = s * s;
    const x = a * ox + b * cx + c * tx;
    const y = a * oy + b * cy + c * ty;
    const z = b * ARC_DEPTH;
    const startScale = Math.min(1, (origin.w * 0.7) / Math.max(1, t.w));
    const scale = startScale + (1 - startScale) * s;
    const w = t.w * scale;
    const h = t.h * scale;

    const flying = s > 0.015 && !card.landed;
    card.mesh.visible = flying;
    card.mesh.position.set(x - width / 2, height / 2 - y, z);
    card.mesh.scale.set(w, h, 1);
    // De espaldas al salir del sobre; se da la vuelta en el aire.
    const flip = 1 - smooth(0.12, 0.72, s);
    card.mesh.rotation.set(-0.35 * Math.sin(Math.PI * s), Math.PI * flip, card.tilt * (1 - s));
    (card.mesh.material.uniforms.uSize.value as Vector2).set(w, h);
    card.mesh.material.uniforms.uTime.value = time;

    // Sombra corta y suave, solo mientras el cromo está en el aire.
    const lift = Math.sin(Math.PI * s);
    card.shadow.visible = flying && lift > 0.02;
    card.shadow.position.set(x - width / 2 + 6 * lift, height / 2 - y - 10 * lift, -1);
    card.shadow.scale.set(w + 32, h + 32, 1);
    (card.shadow.material.uniforms.uSize.value as Vector2).set(w, h);
    card.shadow.material.uniforms.uOpacity.value = 0.3 * lift;
  }

  function frame() {
    if (disposed) return;
    const now = performance.now();
    const dt = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    time += dt;
    let moving = false;
    cards.forEach((card, i) => {
      const target = targetFor(i, now);
      if (target > 0 && !torn) {
        torn = true;
        opts.onTear?.();
      }
      card.spring = springStep(card.spring, target, dt);
      const settled = springSettled(card.spring, target);
      if (!settled || (playAt !== null && target < 1)) moving = true;
      const landed = target >= 0.999 && card.spring.x >= LAND_AT;
      if (landed !== card.landed) {
        card.landed = landed;
        opts.onLand(i, landed);
      }
      place(card, i);
      if (card.mesh.visible && opts.cards[i]?.foil) moving = true;
    });
    renderer.render(scene, camera);
    if (!moving) stop();
  }

  function start() {
    if (running || paused || disposed) return;
    running = true;
    last = 0;
    renderer.setAnimationLoop(frame);
  }
  function stop() {
    if (!running) return;
    running = false;
    renderer.setAnimationLoop(null);
  }
  function kick() {
    if (!paused) start();
  }

  return {
    setProgress(p) {
      playAt = null;
      progress = clamp01(p);
      kick();
    },
    play() {
      if (playAt !== null) return;
      playAt = performance.now();
      kick();
    },
    layout(w, h, o, t) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      origin = o;
      targets = t;
      resize();
      cards.forEach((card, i) => place(card, i));
      renderer.render(scene, camera);
      kick();
    },
    pause(next) {
      paused = next;
      if (paused) stop();
      else kick();
    },
    dispose() {
      disposed = true;
      stop();
      for (const card of cards) {
        card.texture.dispose();
        card.mesh.material.dispose();
        card.shadow.material.dispose();
      }
      geometry.dispose();
      renderer.dispose();
    },
  };
}

function smooth(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
