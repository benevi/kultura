// ============================================================
// KULTURA — Escena 3D de la landing (E-LANDING-INMERSIVA)
//
// Un túnel en hélice de portadas REALES del catálogo (la misma muestra de
// `showcase.ts`) que la cámara recorre al hacer scroll, y que al final se
// recoloca en un muro plano detrás del CTA.
//
// Decisiones (y por qué):
//   - three.js a pelo, sin react-three-fiber: es UNA escena, sin árbol de
//     componentes que justifique otra capa, y así el módulo entero se carga con
//     `import()` dinámico — three no entra en el bundle inicial ni en los tests.
//   - Las texturas se piden a `/_next/image` (MISMO origen), no al CDN del
//     proveedor: WebGL exige CORS para subir una imagen a la GPU y no todos los
//     proveedores lo sirven. De paso llegan redimensionadas y en webp.
//   - Cada pieza nace con un gradiente de la paleta (mismo criterio que
//     `PosterTile`) y la portada lo sustituye al cargar: un 404 deja color, no
//     un hueco negro.
//   - Los colores salen de las custom properties OKLCH vía un canvas 2D, así
//     que la escena no lleva ningún literal de color propio.
//   - Solo renderiza mientras está en pantalla (`start`/`stop` los llama el
//     componente con un IntersectionObserver) y el progreso se amortigua aquí:
//     el scroll fija el objetivo y la cámara llega con inercia.
// ============================================================

import * as THREE from "three";

export interface SceneItem {
  /** URL ya resuelta (mismo origen) o null para quedarse con el gradiente. */
  src: string | null;
  /** Matiz OKLCH del gradiente de respaldo. */
  hue: number;
}

export interface ImmersiveScene {
  setProgress(p: number): void;
  setPointer(x: number, y: number): void;
  resize(): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

const PER_TURN = 9;
const POSTER_W = 1.25;
const POSTER_H = 1.875;

/** Resuelve cualquier color CSS (incl. `oklch()` y `var()`) a RGB lineal 0-1. */
function cssColor(css: string): THREE.Color {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new THREE.Color(0, 0, 0);
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  const r = d[0], g = d[1], b = d[2];
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

function gradientTexture(hue: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 192;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 70, 192);
    g.addColorStop(0, `oklch(55% 0.18 ${hue})`);
    g.addColorStop(1, `oklch(26% 0.08 ${hue})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 192);
    const r = ctx.createRadialGradient(26, 19, 0, 26, 19, 130);
    r.addColorStop(0, `oklch(75% 0.2 ${hue} / 0.6)`);
    r.addColorStop(0.55, `oklch(75% 0.2 ${hue} / 0)`);
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, 128, 192);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Máscara de esquinas redondeadas compartida por todas las piezas. */
function roundedAlpha(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 200;
  c.height = 300;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 200, 300);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(0, 0, 200, 300, 16);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createImmersiveScene(
  canvas: HTMLCanvasElement,
  items: SceneItem[],
  opts: { mobile: boolean; bgCss: string }
): ImmersiveScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const bg = cssColor(opts.bgCss);
  const scene = new THREE.Scene();
  scene.background = bg;
  const fogFar = opts.mobile ? 18 : 22;
  const fog = new THREE.Fog(bg, 5, fogFar);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(opts.mobile ? 70 : 58, 1, 0.1, 60);

  const radius = opts.mobile ? 2.4 : 3.4;
  const pitch = opts.mobile ? 0.5 : 0.6;
  // Las portadas se repiten para que el túnel sea una pared continua, no unas
  // piezas sueltas flotando: con 21 portadas reales salen cuatro vueltas.
  const cols = opts.mobile ? 4 : 8;
  // Múltiplo de las columnas del muro final: sin una última fila a medias.
  const count = Math.ceil(Math.max(items.length, PER_TURN * 4) / cols) * cols;
  const zEnd = -(count - 1) * pitch;

  const tunnel = new THREE.Group();
  scene.add(tunnel);

  const geometry = new THREE.PlaneGeometry(POSTER_W, POSTER_H);
  const alpha = roundedAlpha();
  const loader = new THREE.TextureLoader();
  const owned: THREE.Texture[] = [alpha];
  const materials: THREE.MeshBasicMaterial[] = [];

  // Muro final: rejilla de PER_TURN columnas, centrada, al fondo del túnel.
  const rows = Math.ceil(count / cols);
  const gapX = POSTER_W * 1.22;
  const gapY = POSTER_H * 1.14;
  const wallZ = zEnd - (opts.mobile ? 8 : 9);

  interface Piece {
    mesh: THREE.Mesh;
    helixPos: THREE.Vector3;
    helixQuat: THREE.Quaternion;
    wallPos: THREE.Vector3;
    phase: number;
  }
  const pieces: Piece[] = [];

  for (let i = 0; i < count; i++) {
    const item = items[i % Math.max(items.length, 1)] ?? { src: null, hue: [350, 300, 130, 55, 250, 95, 20][i % 7] };
    const fallback = gradientTexture(item.hue);
    owned.push(fallback);
    const material = new THREE.MeshBasicMaterial({
      map: fallback,
      alphaMap: alpha,
      transparent: true,
      side: THREE.DoubleSide,
    });
    materials.push(material);
    if (item.src) {
      loader.load(item.src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        owned.push(tex);
        material.map = tex;
        material.needsUpdate = true;
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    const a = i * ((Math.PI * 2) / PER_TURN) + (i % 2) * 0.18;
    const z = -i * pitch;
    const helixPos = new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z);
    mesh.position.copy(helixPos);
    // La cara de un plano es +z: lookAt la orienta hacia el eje del túnel.
    mesh.lookAt(0, 0, z);
    mesh.rotateZ((Math.random() - 0.5) * 0.25);
    const helixQuat = mesh.quaternion.clone();

    const col = i % cols;
    const row = Math.floor(i / cols);
    const wallPos = new THREE.Vector3(
      (col - (cols - 1) / 2) * gapX,
      ((rows - 1) / 2 - row) * gapY,
      wallZ
    );

    tunnel.add(mesh);
    pieces.push({ mesh, helixPos, helixQuat, wallPos, phase: Math.random() * Math.PI * 2 });
  }

  let target = 0;
  let progress = 0;
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  let raf = 0;
  let running = false;
  const clock = new THREE.Clock();
  let last = 0;
  const identity = new THREE.Quaternion();
  const tmpQ = new THREE.Quaternion();
  const look = new THREE.Vector3();

  function frame() {
    const t = clock.getElapsedTime();
    // Inercia por TIEMPO, no por frame: a 30 o a 120 fps la cámara tarda lo
    // mismo en alcanzar al scroll.
    const dt = Math.min(0.1, t - last);
    last = t;
    progress += (target - progress) * (1 - Math.exp(-dt * 4.5));
    pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 3));

    const travel = smooth(0, 0.72, progress);
    const wall = smooth(0.7, 0.9, progress);
    const camZ = THREE.MathUtils.lerp(6.5, zEnd + 1.5, travel);

    tunnel.rotation.z = (t * 0.04 + progress * Math.PI * 1.4) * (1 - wall);
    // Al llegar al muro la niebla se abre: el muro tiene que leerse detrás del CTA.
    fog.near = THREE.MathUtils.lerp(5, 12, wall);
    fog.far = THREE.MathUtils.lerp(fogFar, 40, wall);

    for (const p of pieces) {
      p.mesh.position.lerpVectors(p.helixPos, p.wallPos, wall);
      p.mesh.position.z += Math.sin(t * 0.8 + p.phase) * 0.06 * (1 - wall);
      tmpQ.copy(p.helixQuat).slerp(identity, wall);
      p.mesh.quaternion.copy(tmpQ);
    }
    // El muro se apaga para que el CTA se lea encima.
    const dim = 1 - 0.68 * wall;
    for (const m of materials) m.color.setScalar(dim);

    camera.position.set(pointerSmooth.x * 0.5, pointerSmooth.y * 0.35, camZ);
    look.set(pointerSmooth.x * -0.6, pointerSmooth.y * -0.4, camZ - 10);
    camera.lookAt(look);

    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    setProgress(p) {
      target = Math.min(1, Math.max(0, p));
    },
    setPointer(x, y) {
      pointer.set(x, y);
    },
    resize,
    start() {
      if (running) return;
      running = true;
      clock.start();
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      geometry.dispose();
      materials.forEach((m) => m.dispose());
      owned.forEach((t) => t.dispose());
      renderer.dispose();
    },
  };
}
