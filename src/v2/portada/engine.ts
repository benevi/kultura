// ============================================================
// KULTURA v2 — Motor de láminas (WebGL propio, sin dependencias)
//
// Una obra es un bloque de N láminas apiladas en Z. Cada lámina dibuja la
// portada real recortada por su mapa de profundidad (blanco = cerca): la del
// fondo es la imagen entera y las de delante solo guardan lo que está más
// cerca. Junto, parece un bloque sólido; al separarlas con el scroll, la
// portada se abre en capas y la cámara viaja por dentro.
//
// El canto de cada lámina se ve desde el lado. Las láminas marcadas lo llevan
// en el color del formato: tu progreso es, literalmente, el canto del bloque.
//
// Carga diferida desde `Stage.tsx`. Sin WebGL, con GPU por software o con
// movimiento reducido no arranca y queda la imagen fija (`?gl=1` lo fuerza
// en pruebas).
// ============================================================

export interface LaminaWork {
  image: string;
  depth: string;
  aspect: number;
  /** Color del formato, en sRGB 0-1. */
  color: [number, number, number];
  /** Fracción marcada del bloque, 0-1. */
  seen: number;
}

export interface LaminaEngine {
  setWork(index: number, seen: number): void;
  setSeen(seen: number): void;
  setScroll(progress: number): void;
  destroy(): void;
}

const VS = `
attribute vec2 a;
uniform mat4 m;
uniform float asp;
varying vec2 uv;
void main(){
  uv = a * .5 + .5;
  gl_Position = m * vec4(a.x * asp, a.y, 0., 1.);
}`;

const FS = `
precision highp float;
uniform sampler2D img, dep;
uniform float cut, rimW, soft, shade, fade, lit, flash, asp, fill, rimOn;
uniform vec3 tint;
varying vec2 uv;
void main(){
  vec4 c = texture2D(img, uv);
  float d = texture2D(dep, uv).r;
  float a = (fill > .5 || cut <= 0.) ? 1. : smoothstep(cut - soft, cut + soft, d);
  vec2 e = min(uv, 1. - uv) * vec2(asp, 1.);
  float edge = min(e.x, e.y);
  float rim = 1. - smoothstep(rimW, rimW * 1.6, edge);
  vec3 fg = fill > .5 ? mix(vec3(.13, .125, .12), tint * .92, lit) : c.rgb * shade + tint * flash * .35;
  vec3 rimCol = mix(vec3(.94, .91, .86) * .28, tint, lit);
  float rimA = rimOn * mix(.55, 1., lit) * rim;
  vec3 col = mix(fg, rimCol, rim * step(.001, rimA));
  float alpha = max(a, rimA);
  gl_FragColor = vec4(col * alpha * fade, alpha * fade);
}`;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (x: number, a: number, b: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

type Mat = Float32Array;

function perspective(tanHalf: number, aspect: number, near: number, far: number): Mat {
  const f = 1 / tanHalf;
  const nf = 1 / (near - far);
  // prettier-ignore
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function multiply(a: Mat, b: Mat): Mat {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] + a[r + 4] * b[c * 4 + 1] + a[r + 8] * b[c * 4 + 2] + a[r + 12] * b[c * 4 + 3];
    }
  }
  return o;
}

/** Traslación · rotación Y · rotación X · escala. */
function model(x: number, y: number, z: number, ry: number, rx: number, s: number): Mat {
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  // prettier-ignore
  return new Float32Array([
    cy * s, 0, -sy * s, 0,
    sy * sx * s, cx * s, cy * sx * s, 0,
    sy * cx * s, -sx * s, cy * cx * s, 0,
    x, y, z, 1,
  ]);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const FOV_TAN = Math.tan((30 * Math.PI) / 180 / 2);
const CAMERA = 1 / FOV_TAN;

/**
 * Arranca el motor. `null` si no hay WebGL utilizable. `onReady` avisa con la
 * primera obra ya pintable, para retirar la imagen fija sin parpadeo; `onContextLost`,
 * si se pierde el contexto, para volver a ella.
 */
export function startLaminas(
  canvas: HTMLCanvasElement,
  works: LaminaWork[],
  initialSeen: number,
  onReady: () => void,
  onContextLost: () => void,
): LaminaEngine | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    failIfMajorPerformanceCaveat: true,
  });
  if (!gl) return null;

  const forced = new URLSearchParams(location.search).get("gl") === "1";
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  if (!forced && /swiftshader|llvmpipe|softpipe|software/i.test(renderer)) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const attrib = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(attrib);
  gl.vertexAttribPointer(attrib, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const U = {
    m: u("m"), asp: u("asp"), img: u("img"), dep: u("dep"), cut: u("cut"), rimW: u("rimW"),
    soft: u("soft"), shade: u("shade"), fade: u("fade"), lit: u("lit"), flash: u("flash"), tint: u("tint"),
    fill: u("fill"), rimOn: u("rimOn"),
  };
  gl.uniform1i(U.img, 0);
  gl.uniform1i(U.dep, 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.clearColor(0, 0, 0, 0);

  type Loaded = { img: WebGLTexture; dep: WebGLTexture };
  const textures = new Map<number, Loaded | "pending">();

  const upload = (image: HTMLImageElement) => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  };

  let announced = false;
  const need = (index: number) => {
    if (textures.has(index)) return;
    textures.set(index, "pending");
    const work = works[index];
    Promise.all([loadImage(work.image), loadImage(work.depth)])
      .then(([image, depth]) => {
        if (destroyed || gl.isContextLost()) return;
        textures.set(index, { img: upload(image), dep: upload(depth) });
        if (index === shown && !announced) {
          announced = true;
          onReady();
        }
      })
      .catch(() => textures.delete(index));
  };

  // ── Estado ──────────────────────────────────────────────────
  let destroyed = false;
  let raf = 0;
  let visible = true;
  let intersecting = true;
  let lost = false;
  let width = 0;
  let height = 0;
  let narrow = false;
  let layers = 28;

  let shown = 0; // obra en pantalla
  let target = 0; // obra pedida
  let turn = 1; // 0-1: giro de cambio de obra (1 = quieto)
  let seen = initialSeen;
  let seenDraw = initialSeen;
  let flash = 0;

  let scrollTarget = 0;
  let scroll = 0;
  let pointerX = 0;
  let pointerY = 0;
  let tiltX = 0;
  let tiltY = 0;
  let last = performance.now();

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    narrow = rect.width < 720;
    layers = narrow ? 20 : 28;
    const dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 1.75);
    width = Math.max(1, Math.round(rect.width * dpr));
    height = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  };

  const onPointer = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    pointerY = (event.clientY / window.innerHeight) * 2 - 1;
  };

  const frame = (now: number) => {
    raf = 0;
    if (destroyed || !visible) return;
    raf = requestAnimationFrame(frame);

    // Amortiguación por tiempo, no por fotograma: igual a 30 Hz que a 120 Hz.
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
    last = now;
    const damp = (from: number, to: number, rate: number) => from + (to - from) * (1 - Math.exp(-rate * dt));
    scroll = damp(scroll, scrollTarget, 7.5);
    tiltX = damp(tiltX, pointerX, 4.4);
    tiltY = damp(tiltY, pointerY, 4.4);
    seenDraw = damp(seenDraw, seen, 10);
    flash = damp(flash, 0, 3.7);

    if (turn < 1) turn = Math.min(1, turn + dt * 1.36);
    // Fuera del giro: con red lenta la textura llega cuando el giro ya acabó.
    const wanted = textures.get(target);
    if (turn >= 0.5 && shown !== target && wanted && wanted !== "pending") shown = target;
    const work = works[shown];
    const tex = textures.get(shown);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!tex || tex === "pending") return;

    const aspect = width / height;
    const hold = ss(scroll, 0, 0.2); // del héroe al centro
    const open = ss(scroll, 0.08, 0.5); // el bloque se abre
    const fly = ss(scroll, 0.45, 0.94); // la cámara entra
    const out = ss(scroll, 0.68, 0.84); // funde al negro antes de que la imagen se ablande

    // Pose del héroe: a la derecha en escritorio, abajo a la derecha en móvil.
    const heroScale = narrow ? 0.42 : 0.74;
    const heroX = narrow ? 0.3 * aspect : 0.4 * aspect;
    const heroY = narrow ? -0.38 : 0.06;
    const idle = Math.sin(now / 2600) * 0.035;

    const spin = turn < 1 ? Math.sin(turn * Math.PI) ** 2 * Math.PI * 0.5 * (turn < 0.5 ? 1 : -1) : 0;
    const ry = mix(0.66 + idle, 0, hold) + tiltX * mix(0.26, 0.08, hold) + spin;
    const rx = mix(0.12, 0, hold) + tiltY * mix(0.14, 0.05, hold);

    const scale = mix(heroScale, 0.86, hold);
    const px = mix(heroX, 0, hold);
    const py = mix(heroY, 0, hold);

    // Final: la lámina del fondo cubre la pantalla.
    const coverDistance = (scale * Math.min(1, work.aspect / aspect)) / FOV_TAN;
    const camera = mix(CAMERA, Math.max(0.4, coverDistance * 0.98), fly);

    const projection = perspective(FOV_TAN, aspect, 0.05, 40);
    const spread = 0.05 * scale + open * CAMERA * 1.05;

    gl.uniform1f(U.asp, work.aspect);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex.img);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex.dep);
    gl.uniform3f(U.tint, work.color[0], work.color[1], work.color[2]);
    gl.uniform1f(U.rimW, narrow ? 0.009 : 0.006);
    gl.uniform1f(U.soft, 0.012);

    const place = (lz: number) => {
      const c = Math.cos(ry);
      const s = Math.sin(ry);
      const cr = Math.cos(rx);
      return model(px + s * lz * cr, py - Math.sin(rx) * lz, c * lz * cr - camera, ry, rx, scale);
    };

    // Las páginas: el cuerpo del bloque, detrás de la portada. Su canto es el
    // progreso. Al abrirse la obra se quedan atrás y desaparecen.
    const pages = narrow ? 14 : 22;
    const depthBody = 0.44 * scale;
    const body = 1 - ss(open, 0, 0.35);
    if (body > 0.001) {
      gl.uniform1f(U.fill, 1);
      gl.uniform1f(U.rimOn, 1);
      gl.uniform1f(U.cut, 0);
      gl.uniform1f(U.flash, 0);
      gl.uniform1f(U.shade, 1);
      gl.uniform1f(U.fade, body * (1 - out));
      for (let j = pages - 1; j >= 0; j--) {
        const f = j / pages;
        gl.uniformMatrix4fv(U.m, false, multiply(projection, place(-(j + 1) * (depthBody / pages))));
        gl.uniform1f(U.lit, clamp01((seenDraw - f) * pages));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }

    gl.uniform1f(U.fill, 0);
    // El canto se apaga antes de entrar: visto desde dentro son rayas.
    gl.uniform1f(U.rimOn, open * (1 - ss(scroll, 0.34, 0.44)));
    const litFrom = layers - seenDraw * layers;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const lz = t * spread;
      const relZ = camera - lz; // en coordenadas de la cámara (aproximado)
      // Lámina que se acerca a la cámara: se va antes de ampliarse tanto que se
      // vea borrosa. Banda estrecha, para que no se acumulen fantasmas.
      if (relZ < 0.7) continue;
      const near = ss(relZ, 0.7, 1);
      gl.uniformMatrix4fv(U.m, false, multiply(projection, place(lz)));
      gl.uniform1f(U.cut, i === 0 ? 0 : 0.04 + Math.pow(t, 0.9) * 0.88);
      gl.uniform1f(U.shade, mix(0.72, 1, t));
      gl.uniform1f(U.fade, near * (1 - out));
      const lit = clamp01(i + 1 - litFrom);
      gl.uniform1f(U.lit, lit);
      gl.uniform1f(U.flash, i >= litFrom - 1 && i < litFrom + 1 ? flash : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };

  const kick = () => {
    if (!raf && visible && !destroyed) raf = requestAnimationFrame(frame);
  };

  const observer = new ResizeObserver(() => {
    resize();
    kick();
  });
  observer.observe(canvas);

  const intersection = new IntersectionObserver(([entry]) => {
    intersecting = entry.isIntersecting;
    visible = intersecting && !document.hidden && !lost;
    kick();
  });
  intersection.observe(canvas);

  const onVisibility = () => {
    visible = intersecting && !document.hidden && !lost;
    kick();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pointermove", onPointer, { passive: true });

  const onLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    visible = false;
    onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  resize();
  need(0);
  // La siguiente obra, en reposo, para que el primer cambio no espere.
  if (works.length > 1) setTimeout(() => !destroyed && need(1), 1500);
  kick();

  return {
    setWork(index, nextSeen) {
      need(index);
      need((index + 1) % works.length);
      target = index;
      turn = 0;
      seen = nextSeen;
      kick();
    },
    setSeen(nextSeen) {
      if (nextSeen > seen) flash = 1;
      seen = nextSeen;
      kick();
    },
    setScroll(progress) {
      scrollTarget = clamp01(progress);
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
