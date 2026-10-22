// ============================================================
// KULTURA — Galería 3D de fondo de la landing (E-LANDING-INMERSIVA, REN-4)
//
// Una galería flotante de portadas REALES del catálogo (la misma muestra de
// `showcase.ts`) que la cámara recorre durante la intro y que al final se
// recoloca en un muro plano detrás de la página.
//
// WebGL a pelo, sin three.js (REN-4). La escena son 40-70 rectángulos con
// textura, una cámara en perspectiva y niebla lineal: three.js pesaba 518 KB
// sin comprimir para eso (casi todo, shaders de materiales que no se usan) y
// era lo que más bloqueaba el hilo principal al cargar. Esto son ~8 KB con el
// mismo resultado: un solo programa de sombreado, un búfer de 4 vértices y una
// textura por portada.
//
// Se mantiene lo que ya funcionaba (y por qué):
//   - Las texturas se piden a `/_next/image` (MISMO origen): WebGL exige CORS
//     para subir una imagen a la GPU y no todos los proveedores lo sirven.
//   - Cada pieza nace con un gradiente de la paleta (mismo criterio que
//     `PosterTile`) y la portada lo sustituye al cargar: un 404 deja color.
//   - Los colores salen de las custom properties vía un canvas 2D: la escena
//     no lleva ningún literal de color propio.
//   - El color se trata como three con `SRGBColorSpace`: se pasa a lineal,
//     se atenúa y se mezcla con la niebla en lineal, y se vuelve a sRGB.
//   - Solo pinta mientras el componente la tiene en marcha (`start`/`stop`).
// ============================================================

import { IMMERSIVE_READY_AT } from "@/lib/landing/immersive";

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

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const frac = (x: number) => x - Math.floor(x);
const POSTER_W = 1.25;
const POSTER_H = 1.875;
const FALLBACK_HUES = [350, 300, 130, 55, 250, 95, 20];

// ── Álgebra mínima (matrices 4×4 en columnas, como WebGL) ────────────────────

type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
type Mat4 = Float32Array;

function perspective(out: Mat4, fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function lookAt(out: Mat4, eye: Vec3, target: Vec3): Mat4 {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  // x = up(0,1,0) × z
  let xx = zz, xy = 0, xz = -zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  // y = z × x
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

/** Cuaternión de unos ángulos de Euler en orden XYZ (el de three por defecto). */
function quatFromEuler(x: number, y: number, z: number): Quat {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

/**
 * Matriz de modelo: giro `rz` del grupo entero alrededor del eje Z, por
 * traslación `p` y orientación `q` (de `q` hacia la identidad según `t`; con
 * giros de pocos grados, interpolar y normalizar equivale a un slerp).
 */
function model(out: Mat4, p: Vec3, q: Quat, t: number, rz: number): Mat4 {
  let x = q[0] * (1 - t), y = q[1] * (1 - t), z = q[2] * (1 - t), w = q[3] * (1 - t) + t;
  const n = Math.hypot(x, y, z, w) || 1;
  x /= n; y /= n; z /= n; w /= n;
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  // Rotación de la pieza (columnas).
  const r = [
    1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy),
    2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx),
    2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy),
  ];
  const c = Math.cos(rz), s = Math.sin(rz);
  // Rz · [R | p]
  for (let col = 0; col < 3; col++) {
    const a = r[col * 3], b = r[col * 3 + 1];
    out[col * 4] = c * a - s * b;
    out[col * 4 + 1] = s * a + c * b;
    out[col * 4 + 2] = r[col * 3 + 2];
    out[col * 4 + 3] = 0;
  }
  out[12] = c * p[0] - s * p[1];
  out[13] = s * p[0] + c * p[1];
  out[14] = p[2];
  out[15] = 1;
  return out;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ── Sombreado ────────────────────────────────────────────────────────────────

const VERT = `
attribute vec2 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec2 uSize;
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = vec2(aPos.x + 0.5, 0.5 - aPos.y);
  vec4 mv = uView * uModel * vec4(aPos * uSize, 0.0, 1.0);
  vDepth = -mv.z;
  gl_Position = uProj * mv;
}`;

const FRAG = `
precision mediump float;
uniform sampler2D uMap;
uniform sampler2D uMask;
uniform float uDim;
uniform vec3 uFog;
uniform vec2 uFogRange;
varying vec2 vUv;
varying float vDepth;
void main() {
  float a = texture2D(uMask, vUv).g;
  if (a < 0.01) discard;
  vec3 c = pow(texture2D(uMap, vUv).rgb, vec3(2.2)) * uDim;
  c = mix(c, uFog, smoothstep(uFogRange.x, uFogRange.y, vDepth));
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), a);
}`;

type GL = WebGLRenderingContext | WebGL2RenderingContext;

function compile(gl: GL, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("webgl: shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`webgl: ${gl.getShaderInfoLog(sh)}`);
  return sh;
}

/** Cualquier color CSS (incl. `oklch()` y `var()` ya resuelto) → RGB sRGB 0-1. */
function cssRgb(css: string): Vec3 {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

function gradientCanvas(hue: number): HTMLCanvasElement {
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
  return c;
}

/** Máscara de esquinas redondeadas compartida por todas las piezas. */
function roundedMask(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 200;
  c.height = 300;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 200, 300);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(0, 0, 200, 300, 16);
    else ctx.rect(0, 0, 200, 300);
    ctx.fill();
  }
  return c;
}

export function createImmersiveScene(
  canvas: HTMLCanvasElement,
  items: SceneItem[],
  opts: { mobile: boolean; bgCss: string; onReady?: () => void; onLost?: () => void }
): ImmersiveScene {
  const attrs: WebGLContextAttributes = { antialias: true, alpha: false, powerPreference: "high-performance" };
  const ctx = (canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs)) as GL | null;
  if (!ctx) throw new Error("webgl: no disponible");
  const gl: GL = ctx;
  const isGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;

  const program = gl.createProgram();
  if (!program) throw new Error("webgl: program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("webgl: link");
  gl.useProgram(program);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const uProj = u("uProj"), uView = u("uView"), uModel = u("uModel"), uSize = u("uSize");
  const uMap = u("uMap"), uMask = u("uMask"), uDim = u("uDim"), uFog = u("uFog"), uFogRange = u("uFogRange");

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(uSize, POSTER_W, POSTER_H);
  gl.uniform1i(uMap, 0);
  gl.uniform1i(uMask, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const aniso =
    gl.getExtension("EXT_texture_filter_anisotropic") ||
    gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");

  const textures: WebGLTexture[] = [];
  function upload(source: TexImageSource, mip: boolean): WebGLTexture {
    const tex = gl.createTexture();
    if (!tex) throw new Error("webgl: texture");
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Mipmaps solo en WebGL2: en WebGL1 una textura que no es potencia de dos
    // no admite mipmaps (y las portadas son 384×576).
    if (mip && isGL2) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    textures.push(tex);
    return tex;
  }

  const mask = upload(roundedMask(), false);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, mask);
  gl.activeTexture(gl.TEXTURE0);

  // Un gradiente por matiz (siete), compartido por todas las piezas del matiz.
  const gradients = new Map<number, WebGLTexture>();
  const gradient = (hue: number) => {
    let t = gradients.get(hue);
    if (!t) {
      t = upload(gradientCanvas(hue), false);
      gradients.set(hue, t);
    }
    return t;
  };

  const bg = cssRgb(opts.bgCss);
  const bgLinear: Vec3 = [bg[0] ** 2.2, bg[1] ** 2.2, bg[2] ** 2.2];
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  gl.uniform3f(uFog, bgLinear[0], bgLinear[1], bgLinear[2]);
  const fogFar = opts.mobile ? 18 : 22;

  const fov = ((opts.mobile ? 70 : 58) * Math.PI) / 180;
  const rMin = opts.mobile ? 1.5 : 2.3;
  const rMax = opts.mobile ? 3.2 : 5.2;
  // El muro final tiene que CUBRIR la pantalla (como un `background-size:
  // cover`): más columnas que filas en escritorio, al revés en móvil. El
  // encuadre exacto se calcula en cada frame con el aspecto real (`wallCamZ`).
  const cols = opts.mobile ? 4 : 10;
  const minRows = opts.mobile ? 7 : 6;
  const count = Math.max(Math.ceil(items.length / cols), minRows) * cols;
  // Profundidad FIJA del recorrido: más piezas hacen la galería más densa,
  // no el viaje más largo.
  const depth = opts.mobile ? 20 : 26;
  const pitch = depth / (count - 1);
  const zEnd = -depth;

  const rows = Math.ceil(count / cols);
  const gapX = POSTER_W * 1.22;
  const gapY = POSTER_H * 1.14;
  const wallZ = zEnd - (opts.mobile ? 8 : 9);
  const wallW = cols * gapX;
  const wallH = rows * gapY;
  const halfTan = Math.tan(fov / 2);
  let aspect = 1;
  /** Z de cámara a la que el muro llena la pantalla, con margen para el paralaje. */
  const wallCamZ = () => {
    const halfH = Math.min(wallH / 2, wallW / 2 / aspect) * 0.88;
    return wallZ + halfH / halfTan;
  };

  interface Piece {
    helix: Vec3;
    quat: Quat;
    wall: Vec3;
    phase: number;
    tex: WebGLTexture;
    pos: Vec3;
    viewZ: number;
  }
  const pieces: Piece[] = [];
  // Cada portada se pide UNA vez y su textura la comparten todas las piezas
  // que la repiten (21 portadas para 40-70 piezas).
  const byUrl = new Map<string, Piece[]>();

  for (let i = 0; i < count; i++) {
    const item = items[i % Math.max(items.length, 1)] ?? { src: null, hue: FALLBACK_HUES[i % FALLBACK_HUES.length] };
    // Galería flotante: reparto por ángulo áureo (sin patrón visible) en un
    // anillo que deja libre el centro. Determinista: la misma muestra produce
    // siempre la misma composición.
    const a = i * GOLDEN_ANGLE;
    const r = rMin + (rMax - rMin) * frac(i * 0.618 + 0.13);
    const z = -i * pitch + (frac(i * 0.37) - 0.5) * pitch;
    const helix: Vec3 = [Math.cos(a) * r * 1.55, Math.sin(a) * r * 0.85, z];
    // Casi de frente a la cámara, con un giro leve y propio de cada pieza.
    const quat = quatFromEuler((frac(i * 0.71) - 0.5) * 0.22, -helix[0] * 0.05, (frac(i * 0.53) - 0.5) * 0.16);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const wall: Vec3 = [(col - (cols - 1) / 2) * gapX, ((rows - 1) / 2 - row) * gapY, wallZ];
    const piece: Piece = { helix, quat, wall, phase: Math.random() * Math.PI * 2, tex: gradient(item.hue), pos: [0, 0, 0], viewZ: 0 };
    pieces.push(piece);
    if (item.src) {
      const list = byUrl.get(item.src);
      if (list) list.push(piece);
      else byUrl.set(item.src, [piece]);
    }
  }

  // La galería no se enseña hasta que han llegado las portadas de las primeras
  // piezas (el orden de `byUrl` es el de profundidad: delante primero). El
  // componente pone además un tope de tiempo.
  const need = Math.min(byUrl.size, IMMERSIVE_READY_AT);
  let settled = 0;
  let readyFired = false;
  let disposed = false;
  const settle = () => {
    settled++;
    if (!readyFired && settled >= need) {
      readyFired = true;
      opts.onReady?.();
    }
  };
  const images: HTMLImageElement[] = [];
  byUrl.forEach((list, src) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      if (disposed) return;
      try {
        const tex = upload(img, true);
        for (const p of list) p.tex = tex;
      } catch {
        // Textura que no sube: la pieza se queda con su gradiente.
      }
      settle();
    };
    img.onerror = settle;
    img.src = src;
    images.push(img);
  });

  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  const mdl = new Float32Array(16);
  const eye: Vec3 = [0, 0, 0];
  const look: Vec3 = [0, 0, 0];

  let target = 0;
  let progress = 0;
  const pointer = [0, 0];
  const pointerSmooth = [0, 0];
  let raf = 0;
  let running = false;
  let lastT = -1;
  const t0 = performance.now();

  function frame(now: number) {
    const t = (now - t0) / 1000;
    // Inercia por TIEMPO, no por frame: a 30 o a 120 fps tarda lo mismo.
    const dt = lastT < 0 ? 0 : Math.min(0.1, t - lastT);
    lastT = t;
    progress += (target - progress) * (1 - Math.exp(-dt * 6));
    const k = 1 - Math.exp(-dt * 3);
    pointerSmooth[0] += (pointer[0] - pointerSmooth[0]) * k;
    pointerSmooth[1] += (pointer[1] - pointerSmooth[1]) * k;

    // Lineal, no en S: con una curva la cámara corre en el tramo central.
    const travel = Math.min(1, progress / 0.72);
    const wall = smooth(0.7, 0.9, progress);
    const camZ = lerp(lerp(6.5, zEnd + 4, travel), wallCamZ(), wall);

    // Deriva lenta, sin girar como un túnel: la galería "respira".
    const rz = Math.sin(t * 0.12) * 0.04 * (1 - wall);
    // Al llegar al muro la niebla se abre y el muro se apaga para que el texto
    // de encima se lea.
    gl.uniform2f(uFogRange, lerp(5, 12, wall), lerp(fogFar, 40, wall));
    gl.uniform1f(uDim, 1 - 0.68 * wall);

    // Paralaje con el ratón, más corto en el muro para no destapar sus bordes.
    const sway = 1 - 0.6 * wall;
    eye[0] = pointerSmooth[0] * 0.5 * sway;
    eye[1] = pointerSmooth[1] * 0.35 * sway;
    eye[2] = camZ;
    look[0] = pointerSmooth[0] * -0.6 * sway;
    look[1] = pointerSmooth[1] * -0.4 * sway;
    look[2] = camZ - 10;
    lookAt(view, eye, look);
    gl.uniformMatrix4fv(uView, false, view);

    for (const p of pieces) {
      p.pos[0] = lerp(p.helix[0], p.wall[0], wall);
      p.pos[1] = lerp(p.helix[1], p.wall[1], wall) + Math.sin(t * 0.6 + p.phase) * 0.08 * (1 - wall);
      p.pos[2] = lerp(p.helix[2], p.wall[2], wall);
      // Profundidad en cámara para ordenar de atrás adelante (transparencias).
      const c = Math.cos(rz), s = Math.sin(rz);
      const wx = c * p.pos[0] - s * p.pos[1];
      const wy = s * p.pos[0] + c * p.pos[1];
      p.viewZ = view[2] * wx + view[6] * wy + view[10] * p.pos[2] + view[14];
    }
    pieces.sort((a, b) => a.viewZ - b.viewZ);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    let bound: WebGLTexture | null = null;
    for (const p of pieces) {
      gl.uniformMatrix4fv(uModel, false, model(mdl, p.pos, p.quat, wall, rz));
      if (p.tex !== bound) {
        gl.bindTexture(gl.TEXTURE_2D, p.tex);
        bound = p.tex;
      }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    if (running) raf = requestAnimationFrame(frame);
  }

  // Resolución acotada (1,5× escritorio, 1,25× móvil): el lienzo ocupa la
  // pantalla entera y se repinta en cada frame.
  const dprCap = opts.mobile ? 1.25 : 1.5;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = w / h;
    perspective(proj, fov, aspect, 0.1, 60);
    gl.uniformMatrix4fv(uProj, false, proj);
  }
  resize();

  const onLost = (e: Event) => {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(raf);
    opts.onLost?.();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return {
    setProgress(p) {
      target = Math.min(1, Math.max(0, p));
    },
    setPointer(x, y) {
      pointer[0] = x;
      pointer[1] = y;
    },
    resize() {
      resize();
      // Cambiar el tamaño borra el lienzo: con la escena parada se pinta un
      // fotograma para que el muro de fondo no se quede en blanco.
      if (!running) frame(performance.now());
    },
    start() {
      if (running || disposed) return;
      running = true;
      lastT = -1;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    dispose() {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onLost);
      for (const img of images) {
        img.onload = null;
        img.onerror = null;
      }
      textures.forEach((t) => gl.deleteTexture(t));
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
    },
  };
}
