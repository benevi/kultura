// ============================================================
// KULTURA — El sobre en 3D (three.js, solo escritorio y bajo demanda)
//
// Los mismos cromos del abanico HTML, en la MISMA posición (sobre-layout.ts),
// con profundidad: el abanico se inclina hacia el puntero (≤ 8°) con muelles
// amortiguados (rigidez 170, amortiguación 26) y el cromo bajo el puntero
// levanta la esquina 4°. La tapa del sobre sigue siendo la del HTML, delante
// del lienzo: tapa la base de los cromos igual que antes.
//
// Se pinta SOLO mientras algo se mueve: en reposo no hay bucle. Se para con la
// pestaña oculta y lo libera todo (texturas, geometrías, contexto) al salir.
// Este módulo solo se importa de forma dinámica (SobreStage), después del
// primer pintado y en reposo: three nunca entra en el JS inicial de la ruta.
// ============================================================

import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
  type BufferGeometry,
  type Texture,
} from "three";
import { CROMO_H, CROMO_W, MOUTH_Y, STAGE_ASPECT, cromoAt, type CromoPose } from "./sobre-layout";

export interface SobreSceneOptions {
  canvas: HTMLCanvasElement;
  /** Elemento que recibe el puntero (el escenario entero). */
  stage: HTMLElement;
  poses: CromoPose[];
  /** URL de mismo origen de cada portada (WebGL necesita CORS). */
  textures: string[];
  onReady: () => void;
  onFail: () => void;
}

export interface SobreScene {
  dispose: () => void;
}

const TILT_MAX = (8 * Math.PI) / 180;
const CORNER_LIFT = (4 * Math.PI) / 180;
const STIFFNESS = 170;
const DAMPING = 26;
/** Lo que sube el cromo bajo el puntero (fracción de W): su base sigue oculta. */
const HOVER_RAISE = 0.012;
const HOVER_FORWARD = 0.03;
const BORDER_PX = 3;
const RADIUS_PX = 4;
const WHITE = 0xffffff;
/** Respaldo mientras llega una portada: superficie elevada del papel. */
const BACK = 0xe9f6fe;

interface Spring {
  x: number;
  v: number;
  target: number;
}

function spring(): Spring {
  return { x: 0, v: 0, target: 0 };
}

/** Un paso del muelle (Euler semiimplícito). Devuelve si sigue en marcha. */
function step(s: Spring, dt: number): boolean {
  const a = -STIFFNESS * (s.x - s.target) - DAMPING * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
  if (Math.abs(s.v) < 1e-4 && Math.abs(s.x - s.target) < 1e-4) {
    s.x = s.target;
    s.v = 0;
    return false;
  }
  return true;
}

/** Rectángulo de esquinas redondeadas centrado, con UV de 0 a 1. */
function roundedRect(w: number, h: number, r: number): ShapeGeometry {
  const x = -w / 2;
  const y = -h / 2;
  const s = new Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geometry = new ShapeGeometry(s, 4);
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  }
  uv.needsUpdate = true;
  return geometry;
}

/** La portada rellena el cromo como `object-fit: cover`. */
function cover(texture: Texture, planeAspect: number) {
  const img = texture.image as { width?: number; height?: number } | undefined;
  if (!img?.width || !img?.height) return;
  const imageAspect = img.width / img.height;
  if (imageAspect > planeAspect) {
    texture.repeat.set(planeAspect / imageAspect, 1);
    texture.offset.set((1 - texture.repeat.x) / 2, 0);
  } else {
    texture.repeat.set(1, imageAspect / planeAspect);
    texture.offset.set(0, (1 - texture.repeat.y) / 2);
  }
}

export function mountSobreScene(options: SobreSceneOptions): SobreScene {
  const { canvas, stage, poses, textures, onReady, onFail } = options;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  } catch {
    onFail();
    return { dispose: () => undefined };
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1 / STAGE_ASPECT, 1, 10000);
  /** El abanico gira alrededor de la boca del sobre: la base apenas se mueve. */
  const fan = new Group();
  scene.add(fan);

  const geometries: BufferGeometry[] = [];
  const materials: MeshBasicMaterial[] = [];
  const loaded: Texture[] = [];

  const cromos = poses.map(() => {
    const pivot = new Group();
    const lift = new Group();
    const card = new Group();
    pivot.add(lift);
    lift.add(card);
    fan.add(pivot);
    return { pivot, lift, card, hover: spring() };
  });
  const tiltX = spring();
  const tiltY = spring();

  let width = 0;
  let height = 0;
  let disposed = false;
  let frame = 0;
  let last = 0;

  /** Monta (o rehace al cambiar de tamaño) las piezas en píxeles. */
  function layout() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = width * STAGE_ASPECT;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.set(0, 0, height / 2 / Math.tan((15 * Math.PI) / 180));
    camera.updateProjectionMatrix();

    for (const g of geometries) g.dispose();
    geometries.length = 0;
    const cw = CROMO_W * width;
    const ch = CROMO_H * width;
    const base = roundedRect(cw, ch, RADIUS_PX);
    const art = roundedRect(cw - BORDER_PX * 2, ch - BORDER_PX * 2, RADIUS_PX / 2);
    geometries.push(base, art);

    // La boca del sobre, en coordenadas del mundo (y hacia arriba).
    const mouthX = 0;
    const mouthY = height / 2 - MOUTH_Y * width;
    fan.position.set(mouthX, mouthY, 0);

    cromos.forEach((c, i) => {
      const p = poses[i];
      c.pivot.position.set(p.x * width - width / 2 - mouthX, height / 2 - p.bottom * width - mouthY, i * 0.5);
      c.pivot.rotation.z = (-p.angle * Math.PI) / 180;
      c.card.position.set(0, ch / 2, 0);
      c.card.clear();
      c.card.add(new Mesh(base, materials[i * 2]));
      const front = new Mesh(art, materials[i * 2 + 1]);
      front.position.z = 0.1;
      c.card.add(front);
    });
    for (const t of loaded) cover(t, (cw - BORDER_PX * 2) / (ch - BORDER_PX * 2));
  }

  poses.forEach(() => {
    materials.push(new MeshBasicMaterial({ color: WHITE }), new MeshBasicMaterial({ color: BACK }));
  });

  function apply() {
    fan.rotation.x = tiltX.x;
    fan.rotation.y = tiltY.x;
    cromos.forEach((c) => {
      const h = c.hover.x;
      c.lift.position.y = HOVER_RAISE * width * h;
      c.lift.position.z = HOVER_FORWARD * width * h;
      // La esquina superior derecha se levanta hacia quien mira.
      c.card.rotation.x = CORNER_LIFT * h;
      c.card.rotation.y = -CORNER_LIFT * h;
    });
  }

  function render() {
    apply();
    renderer.render(scene, camera);
  }

  function tick(now: number) {
    frame = 0;
    if (disposed) return;
    const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    let moving = step(tiltX, dt);
    moving = step(tiltY, dt) || moving;
    for (const c of cromos) moving = step(c.hover, dt) || moving;
    render();
    if (moving && !document.hidden) frame = requestAnimationFrame(tick);
    else last = 0;
  }

  function wake() {
    if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function onMove(e: PointerEvent) {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    const rect = stage.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    tiltY.target = -Math.max(-1, Math.min(1, nx)) * TILT_MAX;
    tiltX.target = -Math.max(-1, Math.min(1, ny)) * TILT_MAX;
    const hit = cromoAt((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.width, poses);
    cromos.forEach((c, i) => (c.hover.target = i === hit ? 1 : 0));
    wake();
  }

  function onLeave() {
    tiltX.target = 0;
    tiltY.target = 0;
    for (const c of cromos) c.hover.target = 0;
    wake();
  }

  function onVisibility() {
    if (document.hidden && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
    } else wake();
  }

  function onContextLost(e: Event) {
    e.preventDefault();
    onFail();
  }

  const resize = new ResizeObserver(() => {
    if (disposed) return;
    layout();
    render();
  });

  layout();
  resize.observe(stage);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerleave", onLeave);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onContextLost);

  const loader = new TextureLoader();
  loader.setCrossOrigin("anonymous");
  void Promise.allSettled(
    textures.map(
      (url, i) =>
        new Promise<void>((resolve, reject) => {
          loader.load(
            url,
            (texture) => {
              if (disposed) {
                texture.dispose();
                return resolve();
              }
              texture.colorSpace = SRGBColorSpace;
              loaded.push(texture);
              const material = materials[i * 2 + 1];
              material.map = texture;
              material.color.set(WHITE);
              material.needsUpdate = true;
              resolve();
            },
            undefined,
            reject
          );
        })
    )
  ).then((results) => {
    if (disposed) return;
    // Sin la mitad de las portadas no compensa: se queda el abanico HTML.
    const ok = results.filter((r) => r.status === "fulfilled").length;
    if (ok < Math.ceil(textures.length / 2)) return onFail();
    layout();
    render();
    onReady();
  });

  return {
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of loaded) t.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
