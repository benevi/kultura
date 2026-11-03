// ============================================================
// KULTURA — Podio de los rankings en three.js (solo escritorio capaz)
//
// Los tres brillantes del podio pasan a una escena WebGL con la MISMA
// geometría que el DOM: la cámara está a 800 px del plano con el campo de
// visión que hace que 1 unidad = 1 px CSS, así que un cromo sin girar cae
// exactamente encima de su caja y el giro equivale a `perspective(800px)`.
// Cada cromo (portada real con su borde blanco de 3 px, radio 4 px y la caja
// amarilla del puesto) se dibuja en un lienzo 2D y se usa como textura; el
// brillo es una banda especular en el shader, como la de `.cromo-foil`.
//
// Este módulo SOLO se carga con `import()` desde `PodiumTilt`, después de
// pintar y en reposo, en escritorio con WebGL y sin movimiento reducido: nunca
// entra en el JS inicial de la ruta ni en el móvil. Si algo falla (portada sin
// CORS, contexto perdido), lanza y `PodiumTilt` usa la inclinación CSS.
// ============================================================

import {
  CanvasTexture,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import { stepSpring, targetTilt, TILT_PERSPECTIVE_PX, type SpringState } from "@/lib/best/tilt";

/** Margen del lienzo alrededor del podio: un cromo girado 8° sobresale un poco. */
const PAD = 32;
/** Borde blanco y radio del cromo (DISENO.md), en px CSS. */
const BORDER = 3;
const RADIUS = 4;
/** Tintas del álbum en hex (tabla de DISENO.md): el lienzo 2D no lee tokens. */
const WHITE = "#ffffff";
const YELLOW = "#ffe600";
const INK = "#04102c";
/** Ciclo del brillo: 2,8 s de pasada + 0,6 s de espera, como `.cromo-foil`. */
const FOIL_PERIOD = 3.4;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform vec2 uSize;
uniform float uRadius;
uniform float uFoil;
varying vec2 vUv;
void main() {
  vec2 p = vUv * uSize;
  vec2 q = abs(p - uSize * 0.5) - (uSize * 0.5 - uRadius);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  if (d > 0.0) discard;
  vec3 c = texture2D(map, vUv).rgb;
  // Banda especular inclinada (como el skewX(-18deg) de .cromo-foil) con
  // fusión «soft-light» hacia el blanco.
  float s = vUv.x + (1.0 - vUv.y) * 0.32;
  float k = smoothstep(0.24, 0.0, abs(s - uFoil)) * 0.55;
  c += (sqrt(c) - c) * k;
  gl_FragColor = vec4(c, 1.0);
}`;

interface Card {
  el: HTMLElement;
  mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  texture: CanvasTexture;
  rx: SpringState;
  ry: SpringState;
}

export interface PodiumScene {
  destroy(): void;
}

function loadCover(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // WebGL exige CORS: sin él, la portada no se puede subir como textura.
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("cover"));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Pinta un cromo del podio (borde, portada recortada como `object-cover` y su número). */
function paintCard(el: HTMLElement, cover: HTMLImageElement, dpr: number): HTMLCanvasElement {
  const box = el.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(box.width * dpr));
  canvas.height = Math.max(1, Math.round(box.height * dpr));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d");
  ctx.scale(dpr, dpr);
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, box.width, box.height);

  const iw = box.width - BORDER * 2;
  const ih = box.height - BORDER * 2;
  const scale = Math.max(iw / cover.naturalWidth, ih / cover.naturalHeight);
  const sw = iw / scale;
  const sh = ih / scale;
  ctx.drawImage(cover, (cover.naturalWidth - sw) / 2, (cover.naturalHeight - sh) / 2, sw, sh, BORDER, BORDER, iw, ih);

  const badge = el.querySelector<HTMLElement>("[data-number-badge]");
  const rank = el.dataset.rank;
  if (badge && rank) {
    const b = badge.getBoundingClientRect();
    const x = b.left - box.left;
    const y = b.top - box.top;
    ctx.fillStyle = YELLOW;
    roundRect(ctx, x, y, b.width, b.height, RADIUS);
    ctx.fill();
    const style = getComputedStyle(badge);
    ctx.fillStyle = INK;
    ctx.font = `400 ${style.fontSize} ${style.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rank, x + b.width / 2, y + b.height / 2 + parseFloat(style.fontSize) * 0.04);
  }
  return canvas;
}

/**
 * Monta la escena sobre `root` (el envoltorio del podio, `position: relative`) con
 * un cromo por cada `cards[i]` (`[data-podium-cromo]`, con su `img` dentro).
 * Esconde los cromos del DOM solo cuando el primer fotograma está pintado.
 */
export async function startPodiumScene(root: HTMLElement, cards: HTMLElement[]): Promise<PodiumScene> {
  const covers = await Promise.all(
    cards.map((el) => {
      const img = el.querySelector("img");
      const src = img?.currentSrc || img?.src;
      if (!src) throw new Error("cover");
      return loadCover(src);
    }),
  );
  const badge = cards[0]?.querySelector<HTMLElement>("[data-number-badge]");
  if (badge && document.fonts) {
    const style = getComputedStyle(badge);
    await document.fonts.load(`400 ${style.fontSize} ${style.fontFamily}`).catch(() => []);
  }

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset.podiumScene = "";
  Object.assign(canvas.style, {
    position: "absolute",
    inset: `-${PAD}px`,
    width: `calc(100% + ${PAD * 2}px)`,
    height: `calc(100% + ${PAD * 2}px)`,
    pointerEvents: "none",
    zIndex: "1",
  });

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 1, TILT_PERSPECTIVE_PX * 4);
  camera.position.set(0, 0, TILT_PERSPECTIVE_PX);

  const list: Card[] = cards.map((el, i) => {
    const texture = new CanvasTexture(paintCard(el, covers[i], dpr));
    const material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        map: { value: texture },
        uSize: { value: [1, 1] },
        uRadius: { value: RADIUS },
        uFoil: { value: -1 },
      },
    });
    const mesh = new Mesh(new PlaneGeometry(1, 1), material);
    scene.add(mesh);
    return { el, mesh, texture, rx: { x: 0, v: 0 }, ry: { x: 0, v: 0 } };
  });

  let rootBox = root.getBoundingClientRect();
  function layout() {
    rootBox = root.getBoundingClientRect();
    const w = rootBox.width + PAD * 2;
    const h = rootBox.height + PAD * 2;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 1 unidad = 1 px CSS en el plano z = 0.
    camera.fov = (2 * Math.atan(h / 2 / TILT_PERSPECTIVE_PX) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    for (const card of list) {
      const b = card.el.getBoundingClientRect();
      card.mesh.scale.set(b.width, b.height, 1);
      card.mesh.position.set(
        b.left - rootBox.left + b.width / 2 - rootBox.width / 2,
        rootBox.height / 2 - (b.top - rootBox.top + b.height / 2),
        0,
      );
      card.mesh.material.uniforms.uSize.value = [b.width, b.height];
    }
  }

  let pointer: { x: number; y: number } | null = null;
  let frame = 0;
  let last = performance.now();
  let visible = true;
  const start = last;

  function tick(now: number) {
    frame = 0;
    const dt = (now - last) / 1000;
    last = now;
    const foil = ((((now - start) / 1000) % FOIL_PERIOD) / 2.8) * 2.2 - 0.5;
    for (const card of list) {
      const b = card.el.getBoundingClientRect();
      const target = pointer ? targetTilt(pointer.x, pointer.y, b) : { rx: 0, ry: 0 };
      card.rx = stepSpring(card.rx, target.rx, dt);
      card.ry = stepSpring(card.ry, target.ry, dt);
      card.mesh.rotation.set((card.rx.x * Math.PI) / 180, (card.ry.x * Math.PI) / 180, 0);
      card.mesh.material.uniforms.uFoil.value = foil;
    }
    renderer.render(scene, camera);
    // El brillo es un bucle (como el de `.cromo-foil`): se pinta mientras el
    // podio está en pantalla y la pestaña a la vista, y se para si no.
    if (visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (!frame && visible && !document.hidden) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function onPointer(e: PointerEvent) {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    const inside =
      e.clientX >= rootBox.left - PAD &&
      e.clientX <= rootBox.right + PAD &&
      e.clientY >= rootBox.top - PAD &&
      e.clientY <= rootBox.bottom + PAD;
    pointer = inside ? { x: e.clientX, y: e.clientY } : null;
    wake();
  }
  function onLeave() {
    pointer = null;
    wake();
  }
  function onScroll() {
    rootBox = root.getBoundingClientRect();
  }
  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else wake();
  }

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const [i, card] of list.entries()) {
        card.texture.image = paintCard(card.el, covers[i], dpr);
        card.texture.needsUpdate = true;
      }
      layout();
      wake();
    }, 150);
  });
  const io = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    if (visible) wake();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });

  root.appendChild(canvas);
  layout();
  renderer.render(scene, camera);
  // El primer fotograma ya está: ahora sí se esconden los cromos del DOM (su
  // sitio y su texto alternativo siguen ahí).
  for (const card of list) card.el.style.opacity = "0";
  window.addEventListener("pointermove", onPointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  ro.observe(root);
  io.observe(root);
  wake();

  return {
    destroy() {
      cancelAnimationFrame(frame);
      clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const card of list) {
        card.el.style.opacity = "";
        card.texture.dispose();
        card.mesh.geometry.dispose();
        card.mesh.material.dispose();
      }
      renderer.dispose();
      canvas.remove();
    },
  };
}
