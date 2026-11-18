// ============================================================
// KULTURA — Prototipo fase 8.3 · capa 3D de la sala (dirección A).
// WebGL a pelo, sin dependencias, como el motor de la landing
// (`src/components/landing/engine.ts`), en UN lienzo y UN contexto.
//
// Este módulo se carga con `import()` solo cuando la página ya es usable y
// alguien pide `?3d=capas` o `?3d=fondo`. El HTML del servidor (la imagen, el
// `h1`) sigue debajo: si no hay WebGL, la GPU es por software, una textura
// falla o se pierde el contexto, el lienzo no aparece (o se retira) y la sala
// se queda como en 2D.
//
// Dos escenas:
//   · `wide` (Sala): la imagen a sangre con parallax y el título pintado
//     ENTRE el fondo y lo que queda delante. El título del lienzo es adorno
//     (el lienzo es `aria-hidden`); el `h1` real sigue en el HTML.
//       - `capas`: sin mapa de profundidad. La imagen es un plano y el título
//         otro, que se mueven entre sí; pasa por delante lo que se aparta del
//         color de fondo (máscara calculada con la imagen ya cargada).
//       - `fondo`: con mapa de profundidad (parallax dentro de la imagen) y
//         una máscara pegada a los contornos para el corte.
//   · `piece` (Pieza): la portada como objeto con grosor (lomo, canto de
//     páginas) que gira con el puntero, el scroll o el giroscopio. Con mapa
//     (`fondo`), la cubierta tiene además relieve hacia dentro.
//
// Bucle bajo demanda: solo se pinta cuando algo cambia; parado con la sala
// fuera de pantalla o la pestaña oculta. DPR limitado y rebajado si el
// fotograma no llega. Al desmontar se libera todo, contexto incluido.
// ============================================================

import { rgbToOklab, type RGB } from "../../../_base/color";
import { extractSwatches } from "../../../_base/cover-palette";

export interface Tone3D {
  scrim: RGB;
  ink: RGB;
  /** Opacidad del velo (la calcula Stage con lo que el título tiene detrás). */
  alpha: number;
  /** Alto (px CSS, desde el borde inferior de la imagen) hasta donde el velo es macizo. */
  band: number;
  /** Alto (px CSS, desde el borde inferior) donde EMPIEZA a ser macizo: por debajo se aclara (título subido). */
  bandLo: number;
  /** Tinta clara sobre velo oscuro (`light`) o al revés (`dark`). */
  pick: "light" | "dark";
}

export interface TitleMask {
  canvas: HTMLCanvasElement;
  a: Uint8ClampedArray;
  w: number;
  h: number;
  lines: number[];
  /** Caja de cada carácter (px de la máscara): x, y, ancho, alto. */
  chars: [number, number, number, number][];
  /** Pintada con la fuente real (si no, son cajas y no vale para el lienzo). */
  exact: boolean;
  /** Otro lienzo igual, solo con las letras marcadas (mismo orden que `chars`). */
  subset(ok: boolean[]): HTMLCanvasElement;
}

export interface Stats {
  fps: number;
  p95: number;
  long: number;
  frames: number;
  /** ms de CPU por fotograma (media) dentro del pintado. */
  cpu: number;
  dpr: number;
  renderer: string;
  /** MB de texturas (aprox., RGBA sin comprimir). */
  texMB: number;
  /** Parte de la letra tapada, estimada (0-1). */
  cover: number;
  moving: boolean;
}

export interface SalaOpts {
  kind: "wide" | "piece";
  mode: "capas" | "fondo";
  /** Lomo a la derecha (manga: se lee de derecha a izquierda). */
  spineRight: boolean;
  stage: HTMLElement;
  box: HTMLElement;
  img: HTMLImageElement;
  h1: HTMLElement;
  canvas: HTMLCanvasElement;
  /** Mapas estáticos del prototipo (`public/proto/depth`); `null` si la obra no tiene. */
  depth: { d: string; m: string } | null;
  getTone(): Tone3D | null;
  titleMask(k: number): Promise<TitleMask | null>;
  reduced: boolean;
  /** `?loop=1`: deriva automática también con ratón (para medir). */
  forceLoop: boolean;
  /** `?gl=1`: no descartar la GPU por software (pruebas). */
  forceGl: boolean;
  onState(on: boolean, why?: string): void;
  onStats?: (s: Stats) => void;
}

export interface SalaHandle {
  /** Volver a medir (cambio de tamaño, de fuente, de velo). */
  sync(): void;
  setReduced(v: boolean): void;
  /**
   * Giroscopio: llamar SOLO tras un gesto y con el permiso ya concedido.
   * Resuelve `true` cuando llega la primera lectura; `false` si no hay sensor
   * (o no es un contexto seguro) y entonces sigue la deriva y el scroll.
   */
  enableGyro(): Promise<boolean>;
  disableGyro(): void;
  stats(): Stats;
  /** La imagen del `<img>` ha cambiado (llegó la versión mayor): se rehace su textura. */
  reloadImage(): void;
  /** Solo para medir: 0 normal · 1 sin título · 2 título en magenta sin tapar. */
  debug(mode: number): void;
  destroy(): void;
}

/** Como mucho, esta parte de los píxeles de letra puede quedar tapada (título y cada línea). */
const COVER_MAX = 0.22;
/** Lo que se busca: margen para el movimiento (el parallax desplaza la figura sobre la letra). */
const COVER_TARGET = 0.18;
/** Ninguna letra suelta se tapa más que esto: una letra que desaparece cambia la palabra. */
/** Con máscara de primer plano: tope por letra. Una letra que quedaría más tapada va ENTERA por delante de la figura. */
const CHAR_MAX_FRONT = 0.35;
/** Sin mapa (máscara por color) las formas son arbitrarias: tope por letra más bajo. */
const CHAR_MAX_COLOR = 0.45;
/** Lo tapado no cruza más de esta parte del ancho de una línea. */
const SPAN_MAX = 0.36;
/** Por debajo de esto lo tapado se ve como un mordisco suelto, no como una figura: el título va entero por delante. */
const MIN_COVER = 0.07;
const ZOOM = 1.035;
const OFF: [number, number] = [0.018, 0.012];
// El lienzo pinta a la densidad de la pantalla hasta 2× (más allá no se distingue y
// cuesta el cuádruple); si el fotograma no llega, baja solo (ver `frame`).
const MAX_DPR = 2;
// Texturas: nunca por debajo de lo que el lienzo enseña, y con tope de memoria
// (4096 px de lado: una imagen 16:9 son ~38 MB en RGBA).
const MAX_TEX = 4096;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

// ── Sombreadores ────────────────────────────────────────────
const VS_QUAD = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";

/** Sala: imagen con parallax + velo + título entre capas. Coordenadas en px de lienzo, origen arriba a la izquierda. */
const FS_WIDE = (deriv: boolean) => `${deriv ? "#extension GL_OES_standard_derivatives : enable\n" : ""}precision highp float;varying vec2 v;
uniform sampler2D uImg,uDep,uMat,uTitle,uShadow,uOk;
uniform vec2 uRes,uOff;uniform vec4 uBox,uFit,uTRect,uSRect;
uniform float uZoom,uTh,uSoft,uTz,uScrimA,uBand,uBandLo,uFade,uShadowA,uDebug,uAlpha;
uniform vec3 uInk,uScrim;
float inside(vec2 q){return step(0.,q.x)*step(0.,q.y)*step(q.x,1.)*step(q.y,1.);}
float hash(vec2 q){return fract(sin(dot(q,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 px=vec2(v.x,1.-v.y)*uRes;
  vec2 b=px-uBox.xy;
  float inBox=step(0.,b.x)*step(0.,b.y)*step(b.x,uBox.z)*step(b.y,uBox.w);
  vec2 ctr=(uBox.zw*.5-uFit.xy)/uFit.zw;
  vec2 c=((b-uFit.xy)/uFit.zw-ctr)/uZoom+ctr;
  float d=texture2D(uDep,c).r;vec2 p=c-uOff*(d-.5);
  d=texture2D(uDep,p).r;p=c-uOff*(d-.5);
  d=max(d,texture2D(uDep,p).r);p=clamp(c-uOff*(d-.5),.002,.998);
  vec3 col=texture2D(uImg,p).rgb;
  // La máscara se lee en 5 puntos (±0,75 px de pantalla): quita el picoteo del JPEG en el contorno.
  vec2 e=.75/(uFit.zw*uZoom);
  float mv=(texture2D(uMat,p).r*2.+texture2D(uMat,p+e).r+texture2D(uMat,p-e).r+texture2D(uMat,p+vec2(e.x,-e.y)).r+texture2D(uMat,p+vec2(-e.x,e.y)).r)/6.;
  // Borde del corte: ~1,5 px de ancho en pantalla sea cual sea la pendiente de la máscara (sin dientes ni borrón).
  float ew=${deriv ? "clamp(fwidth(mv)*1.25,.004,uSoft)" : "uSoft"};
  // Con máscara de primer plano (uAlpha) el alfa ya viene suave y limpio: se usa tal cual, un poco más firme.
  // Con máscara de primer plano (uAlpha): TODO el contorno lo pone la máscara (alfa limpio, tal cual).
  // No hay corte dentro de la figura: cada letra va entera por detrás o entera por delante (uOk).
  float occ=mix(smoothstep(uTh-ew,uTh+ew,mv),smoothstep(.1,.9,mv)*step(uTh,1.),uAlpha)*inBox;
  float fb=uBox.w-b.y;
  float sa=uScrimA*(1.-clamp((fb-uBand)/uFade,0.,1.))*mix(.5,1.,clamp(fb/max(uBandLo,1.),0.,1.));
  col=mix(col,uScrim,sa);
  vec2 ts=uOff*(uTz-.5)*uFit.zw*uZoom;
  vec2 tuv=(px-uTRect.xy-ts)/uTRect.zw;
  float ta=texture2D(uTitle,tuv).a*inside(tuv);
  // Letras que admiten figura por delante (las demás van enteras por delante: nunca quedan irreconocibles).
  occ*=clamp(texture2D(uOk,tuv).a/max(ta,.02),0.,1.)*inside(tuv)+(1.-step(.02,ta));
  vec2 suv=(px-uSRect.xy-ts)/uSRect.zw;
  vec2 st=1.4/uSRect.zw*6.;
  float sh=(texture2D(uShadow,suv).a*2.+texture2D(uShadow,suv+vec2(st.x,0.)).a+texture2D(uShadow,suv-vec2(st.x,0.)).a+texture2D(uShadow,suv+vec2(0.,st.y)).a+texture2D(uShadow,suv-vec2(0.,st.y)).a)/6.;
  sh*=inside(suv)*uShadowA*(1.-occ);
  if(uDebug>.5){ta*=step(uDebug,1.5)*0.+step(1.5,uDebug);sh=0.;}
  float t=ta*(1.-occ*step(uDebug,1.5));
  vec3 ink=mix(uInk,vec3(1.,0.,1.),step(1.5,uDebug));
  vec3 base=col*(1.-sh)+(hash(px)-.5)*(1.5/255.);
  vec3 o=mix(base,ink,t);
  float a=max(inBox,t+(1.-t)*sh*.8);
  o=mix(mix(vec3(0.),ink,t/max(a,.001)),o,inBox);
  gl_FragColor=vec4(o*a,a);
}`;

/** Sombra de contacto de la pieza (rectángulo difuminado). */
const FS_SHADOW = `precision highp float;varying vec2 v;
uniform vec2 uRes;uniform vec4 uRect;uniform float uBlur,uA;
void main(){
  vec2 px=vec2(v.x,1.-v.y)*uRes;
  vec2 q=abs(px-(uRect.xy+uRect.zw*.5))-uRect.zw*.5;
  float dist=length(max(q,0.))+min(max(q.x,q.y),0.);
  float s=1.-smoothstep(-uBlur*.55,uBlur,dist);
  gl_FragColor=vec4(0.,0.,0.,uA*s*s);
}`;

const VS_BOX = `attribute vec3 aPos;attribute vec3 aNor;attribute vec2 aUv;attribute float aFace;
uniform mat3 uRot;uniform vec2 uRes,uCtr;uniform float uCam;
varying vec2 vUv;varying float vFace;varying vec3 vNor;varying vec3 vPos;
void main(){
  vec3 q=uRot*aPos;
  float w=(uCam-q.z)/uCam;
  vec2 s=uCtr+q.xy;
  vec2 ndc=vec2(s.x/uRes.x*2.-1.,1.-s.y/uRes.y*2.);
  gl_Position=vec4(ndc*w,-q.z/uCam*w,w);
  vUv=aUv;vFace=aFace;vNor=uRot*aNor;vPos=q;
}`;

/** Pieza: 0 cubierta · 1 lomo · 2 canto de páginas · 3 contracubierta. */
const FS_BOX = `precision highp float;
uniform sampler2D uImg,uDep;uniform vec2 uTilt;uniform float uRelief,uSpineRight,uSheen;
varying vec2 vUv;varying float vFace;varying vec3 vNor;varying vec3 vPos;
void main(){
  vec3 n=normalize(vNor);
  vec3 L=normalize(vec3(-.35,-.55,.76));
  float ndl=max(dot(n,L),0.);
  vec3 col;
  if(vFace<.5){
    vec2 uv=vUv;
    float d=texture2D(uDep,uv).r;uv=vUv+uTilt*(1.-d)*uRelief;
    d=texture2D(uDep,uv).r;uv=clamp(vUv+uTilt*(1.-d)*uRelief,.002,.998);
    col=texture2D(uImg,uv).rgb;
    col*=1.+.5*(ndl-.76);
    float s=vUv.x*.8+vUv.y*.6-.7-uTilt.x*9.+uTilt.y*5.;
    col+=vec3(1.)*exp(-s*s/.035)*uSheen;
  }else if(vFace<1.5){
    float u=.035*(1.-vUv.x);
    col=texture2D(uImg,vec2(mix(u,1.-u,uSpineRight),vUv.y)).rgb;
    col*=(.62+.38*sin(vUv.x*3.14159))*(.55+.6*ndl);
  }else if(vFace<2.5){
    float t=vUv.x;
    float board=step(t,.07)+step(.93,t);
    float lines=.9+.1*step(.5,fract(t*46.));
    vec3 paper=vec3(.93,.9,.84)*lines*(.62+.5*ndl);
    vec3 edge=texture2D(uImg,vec2(.5,.5)).rgb*.35;
    col=mix(paper,edge,board);
  }else{
    col=texture2D(uImg,vec2(.5,.5)).rgb*.25;
  }
  gl_FragColor=vec4(col,1.);
}`;

// ── Utilidades de GL ────────────────────────────────────────
function program(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs);
  const pr = gl.createProgram()!;
  gl.attachShader(pr, a);
  gl.attachShader(pr, b);
  gl.linkProgram(pr);
  gl.deleteShader(a);
  gl.deleteShader(b);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
    if (process.env.NODE_ENV !== "production") console.warn("[kp3d]", gl.getProgramInfoLog(pr), gl.getShaderInfoLog(b));
    gl.deleteProgram(pr);
    return null;
  }
  return pr;
}

function uniforms(gl: WebGLRenderingContext, pr: WebGLProgram): Record<string, WebGLUniformLocation | null> {
  const out: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(pr, i);
    if (info) out[info.name] = gl.getUniformLocation(pr, info.name);
  }
  return out;
}

function rendererName(gl: WebGLRenderingContext): string {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img"));
    img.src = src;
  });
}

/**
 * Fuente para una textura: decodificada fuera del hilo principal si se puede.
 * Se sube al tamaño REAL del archivo (con `srcset`, `naturalWidth` no lo es) y
 * solo se reduce si pasa de `cap` (lo que el lienzo va a enseñar, o el tope).
 */
async function texSource(img: HTMLImageElement, cap: number): Promise<TexImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      let bmp = await createImageBitmap(img);
      const side = Math.max(bmp.width, bmp.height);
      if (side > cap) {
        const k = cap / side;
        const small = await createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * k), resizeHeight: Math.round(bmp.height * k), resizeQuality: "high" });
        bmp.close();
        bmp = small;
      }
      return bmp;
    } catch {
      // sigue con la imagen tal cual
    }
  }
  return img;
}

const idle = () =>
  new Promise<void>((resolve) => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (ric) ric(() => resolve(), { timeout: 300 });
    else setTimeout(resolve, 0);
  });

/** Dónde cae la imagen entera en una caja con `object-fit: cover` (px CSS). */
function coverFit(img: HTMLImageElement, w: number, h: number) {
  const ar = img.naturalWidth / img.naturalHeight;
  const dw = Math.max(w, h * ar), dh = dw / ar;
  return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
}

interface Matte {
  data: Uint8Array;
  w: number;
  h: number;
}

/** Píxeles de una imagen reducida a `w` de ancho (lienzo 2D). */
function pixels(img: CanvasImageSource, sw: number, sh: number, w: number) {
  const h = Math.max(1, Math.round((sh / sw) * w));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

function blur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    const a = pass ? tmp : src, b = pass ? src : tmp;
    const n = pass ? h : w, m = pass ? w : h, step = pass ? w : 1, line = pass ? 1 : w;
    for (let j = 0; j < m; j++) {
      const o = j * line;
      let sum = 0, cnt = 0;
      for (let i = 0; i <= r && i < n; i++) { sum += a[o + i * step]; cnt++; }
      for (let i = 0; i < n; i++) {
        b[o + i * step] = sum / cnt;
        const add = i + r + 1, del = i - r;
        if (add < n) { sum += a[o + add * step]; cnt++; }
        if (del >= 0) { sum -= a[o + del * step]; cnt--; }
      }
    }
  }
}

/**
 * `capas`: máscara sin mapa de profundidad. Distancia (OKLab) de cada píxel al
 * color que más hay detrás del título, suavizada dos veces (queda una rampa
 * continua: el corte del sombreador sale curvo, no a bloques).
 */
async function colorMatte(img: HTMLImageElement, zoneTop: number): Promise<Matte | null> {
  const W = Math.min(640, img.naturalWidth);
  const px = pixels(img, img.naturalWidth, img.naturalHeight, W);
  if (!px) return null;
  const { data, w, h } = px;
  const start = Math.floor(h * clamp(zoneTop, 0, 0.9)) * w * 4;
  const main = extractSwatches(data.subarray(start), 1)[0]?.rgb ?? [128, 128, 128];
  const dom = rgbToOklab(main);
  const dist = new Float32Array(w * h);
  const rows = 48;
  for (let y0 = 0; y0 < h; y0 += rows) {
    const y1 = Math.min(h, y0 + rows);
    for (let p = y0 * w, i = p * 4; p < y1 * w; p++, i += 4) {
      const lab = rgbToOklab([data[i], data[i + 1], data[i + 2]]);
      dist[p] = Math.hypot(lab[0] - dom[0], lab[1] - dom[1], lab[2] - dom[2]);
    }
    await idle(); // a trozos: el cálculo no bloquea el hilo principal
  }
  const r = Math.max(1, Math.round(w / 260));
  blur(dist, w, h, r);
  blur(dist, w, h, r);
  const out = new Uint8Array(w * h);
  for (let p = 0; p < out.length; p++) out[p] = Math.min(255, Math.round(dist[p] * 2.2 * 255));
  return { data: out, w, h };
}

// ── Montaje ─────────────────────────────────────────────────
export async function mountSala(o: SalaOpts): Promise<SalaHandle | null> {
  const { stage, box, img, h1, canvas } = o;
  const fail = (why: string) => {
    o.onState(false, why);
    return null;
  };
  // La imagen puede estar cambiando de archivo justo ahora (llega la versión mayor): se espera.
  if (!img.complete) {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      setTimeout(done, 8000);
    });
  }
  if (!img.complete || !img.naturalWidth) return fail("imagen");
  if (o.mode === "fondo" && !o.depth && o.kind === "wide") return fail("sin mapa");

  const piece = o.kind === "piece";
  const gl = canvas.getContext("webgl", {
    alpha: true, premultipliedAlpha: true, antialias: piece, depth: piece, stencil: false,
    failIfMajorPerformanceCaveat: !o.forceGl, powerPreference: "default",
  });
  if (!gl) return fail("sin webgl");
  const renderer = rendererName(gl);
  const lose = () => gl.getExtension("WEBGL_lose_context")?.loseContext();
  if (!o.forceGl && /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer)) {
    lose();
    return fail("gpu por software");
  }

  const coarse = matchMedia("(pointer: coarse)").matches;
  let reduced = o.reduced;
  let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const maskK = dpr;
  let alive = true, on = false, lost = false, debug = 0;
  let texBytes = 0, coverEst = 0;
  /** `fondo`: la máscara es de primer plano (figura/fondo), no una rampa que umbralizar. */
  const fgMatte = o.mode === "fondo" && o.kind === "wide";
  const texSize = new Map<WebGLTexture, number>();
  const drop = (t?: WebGLTexture) => {
    if (!t) return;
    texBytes -= texSize.get(t) ?? 0;
    texSize.delete(t);
    gl.deleteTexture(t);
  };

  // Recursos de GL (se rehacen si el contexto se pierde y vuelve).
  type Tex = WebGLTexture;
  let res: {
    quad: WebGLBuffer; wide?: WebGLProgram; uw?: ReturnType<typeof uniforms>;
    shadow?: WebGLProgram; us?: ReturnType<typeof uniforms>; boxPr?: WebGLProgram; ub?: ReturnType<typeof uniforms>;
    mesh?: WebGLBuffer; meshN?: number;
    img: Tex; dep: Tex; mat?: Tex; title?: Tex; sh?: Tex; ok?: Tex;
  } | null = null;

  const tex = (src: TexImageSource | null, w = 1, h = 1, data?: Uint8Array, format: number = gl.LUMINANCE, gray = false): Tex => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (src) {
      // Los mapas (profundidad, máscara) son grises: un byte por píxel en la GPU, no cuatro.
      const f = gray ? gl.LUMINANCE : gl.RGBA;
      gl.texImage2D(gl.TEXTURE_2D, 0, f, f, gl.UNSIGNED_BYTE, src);
      const s = src as { width: number; height: number; naturalWidth?: number; naturalHeight?: number };
      texSize.set(t, (s.naturalWidth || s.width) * (s.naturalHeight || s.height) * (gray ? 1 : 4));
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, format, gl.UNSIGNED_BYTE, data ?? new Uint8Array([0]));
      texSize.set(t, w * h * (format === gl.LUMINANCE ? 1 : 4));
    }
    texBytes += texSize.get(t) ?? 0;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  };

  // Lo que el lienzo va a enseñar de la imagen (px de pantalla), con margen; ese es el tope de la textura.
  const shown = (piece ? img : box).getBoundingClientRect();
  const fit0 = piece ? { dw: shown.width, dh: shown.height } : coverFit(img, shown.width, shown.height);
  const texCap = clamp(Math.ceil(Math.max(fit0.dw, fit0.dh) * dpr * 1.1), 1024, Math.min(MAX_TEX, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number));
  // Fuentes (se piden una vez; sirven para rehacer las texturas).
  let imgSrc: TexImageSource, depSrc: TexImageSource | null = null, matSrc: TexImageSource | null = null;
  let matte: Matte | null = null;
  try {
    const [a, d, m] = await Promise.all([
      texSource(img, texCap),
      o.mode === "fondo" && o.depth && !piece ? loadImage(o.depth.d) : null,
      o.mode === "fondo" && o.depth && !piece ? loadImage(o.depth.m) : null,
    ]);
    imgSrc = a;
    depSrc = d;
    matSrc = m;
    if (!piece) {
      if (m) {
        const px = pixels(m, m.naturalWidth, m.naturalHeight, Math.min(640, m.naturalWidth));
        if (px) {
          const data = new Uint8Array(px.w * px.h);
          for (let i = 0; i < data.length; i++) data[i] = px.data[i * 4];
          matte = { data, w: px.w, h: px.h };
        }
      } else {
        matte = await colorMatte(img, 0.55);
      }
      if (!matte) throw new Error("máscara");
    }
  } catch {
    lose();
    return fail("textura");
  }
  if (!alive) return null;

  function build(): boolean {
    texBytes = 0;
    texSize.clear();
    try {
      const quad = gl!.createBuffer()!;
      gl!.bindBuffer(gl!.ARRAY_BUFFER, quad);
      gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl!.STATIC_DRAW);
      const r: NonNullable<typeof res> = {
        quad,
        img: tex(imgSrc),
        dep: depSrc ? tex(depSrc, 1, 1, undefined, gl!.LUMINANCE, true) : tex(null, 1, 1, new Uint8Array([piece ? 255 : 0])),
      };
      if (piece) {
        const sp = program(gl!, VS_QUAD, FS_SHADOW), bp = program(gl!, VS_BOX, FS_BOX);
        if (!sp || !bp) return false;
        r.shadow = sp;
        r.us = uniforms(gl!, sp);
        r.boxPr = bp;
        r.ub = uniforms(gl!, bp);
        r.mesh = gl!.createBuffer()!;
      } else {
        const wp = program(gl!, VS_QUAD, FS_WIDE(Boolean(gl!.getExtension("OES_standard_derivatives"))));
        if (!wp) return false;
        r.wide = wp;
        r.uw = uniforms(gl!, wp);
        r.mat = matSrc && o.mode === "fondo" ? tex(matSrc, 1, 1, undefined, gl!.LUMINANCE, true) : tex(null, matte!.w, matte!.h, matte!.data);
      }
      res = r;
      gl!.disable(gl!.CULL_FACE);
      gl!.enable(gl!.BLEND);
      gl!.blendFunc(gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA);
      return true;
    } catch {
      return false; // p. ej. SecurityError: la imagen no se puede usar como textura
    }
  }
  if (!build()) {
    lose();
    return fail("textura");
  }

  // ── Geometría (se mide en `measure`) ──────────────────────
  const geo = {
    w: 1, h: 1,
    box: [0, 0, 1, 1], fit: [0, 0, 1, 1], trect: [0, 0, 1, 1], srect: [0, 0, 1, 1],
    th: 2, soft: 0.03, tz: 0.5, ready: false,
    pieceRect: [0, 0, 1, 1],
  };
  let tone: Tone3D | null = null;
  let maskRun = 0;

  /**
   * `fondo` (máscara de primer plano): qué letras admiten la figura por delante.
   * Una letra que quedaría tapada más de CHAR_MAX_FRONT va ENTERA por delante de
   * la figura; las demás, por detrás. Si aun así el título o una línea pasan del
   * objetivo, se van sacando las letras más tapadas. El corte nunca cae dentro
   * de una figura: todo borde visible es el contorno limpio de la máscara.
   */
  function pickLetters(mask: TitleMask, bx: DOMRect, t: DOMRect, fit: ReturnType<typeof coverFit>) {
    const nc = mask.chars.length;
    const none = { th: 2, cover: 0, ok: new Array<boolean>(nc).fill(false) };
    // El título tiene que caber entero dentro de la imagen.
    if (!matte || t.bottom > bx.bottom + 1 || t.top < bx.top) return none;
    const nl = Math.max(1, mask.lines.length);
    const glyph = new Uint32Array(nc), hit = new Uint32Array(nc), line = new Uint8Array(nc);
    const zoom = reduced ? 1 : ZOOM;
    const cx = (bx.width / 2 - fit.dx) / fit.dw, cy = (bx.height / 2 - fit.dy) / fit.dh;
    const step = mask.w * mask.h > 400000 ? 2 : 1;
    mask.chars.forEach(([x0, y0, cw, ch], ci) => {
      let li = 0;
      while (li + 1 < nl && y0 >= mask.lines[li + 1] - 2) li++;
      line[ci] = li;
      for (let y = Math.max(0, y0); y < Math.min(mask.h, y0 + ch); y += step) {
        const v = ((t.top - bx.top + y / maskK - fit.dy) / fit.dh - cy) / zoom + cy;
        const row = Math.min(matte!.h - 1, Math.max(0, Math.floor(v * matte!.h))) * matte!.w;
        for (let x = Math.max(0, x0); x < Math.min(mask.w, x0 + cw); x += step) {
          if (mask.a[(y * mask.w + x) * 4 + 3] < 128) continue;
          glyph[ci]++;
          const u = ((t.left - bx.left + x / maskK - fit.dx) / fit.dw - cx) / zoom + cx;
          if (matte!.data[row + Math.min(matte!.w - 1, Math.max(0, Math.floor(u * matte!.w)))] >= 128) hit[ci]++;
        }
      }
    });
    const total = glyph.reduce((a, b) => a + b, 0);
    if (!total) return none;
    const ok = Array.from({ length: nc }, (_, i) => glyph[i] > 0 && hit[i] / glyph[i] <= CHAR_MAX_FRONT);
    const lineTotal = new Float64Array(nl);
    for (let i = 0; i < nc; i++) lineTotal[line[i]] += glyph[i];
    const over = () => {
      let all = 0;
      const per = new Float64Array(nl);
      for (let i = 0; i < nc; i++) if (ok[i]) { all += hit[i]; per[line[i]] += hit[i]; }
      if (all / total > COVER_TARGET) return -1;
      for (let li = 0; li < nl; li++) if (lineTotal[li] && per[li] / lineTotal[li] > COVER_TARGET) return li;
      return -2;
    };
    for (let guard = 0; guard < nc; guard++) {
      const li = over();
      if (li === -2) break;
      // Fuera la letra más tapada (de la línea que se pasa, o de todo el título).
      let worst = -1;
      for (let i = 0; i < nc; i++) if (ok[i] && hit[i] && (li < 0 || line[i] === li) && (worst < 0 || hit[i] > hit[worst])) worst = i;
      if (worst < 0) break;
      ok[worst] = false;
    }
    let all = 0;
    for (let i = 0; i < nc; i++) if (ok[i]) all += hit[i];
    const cover = all / total;
    if (cover < 0.004) return none; // nada por delante
    return { th: 0.5, cover, ok };
  }

  /** Umbral del corte: lo tapado no pasa de COVER_TARGET en el título ni en ninguna línea, y cae donde el corte es más limpio. */
  function pickThreshold(mask: TitleMask, bx: DOMRect, t: DOMRect, fit: ReturnType<typeof coverFit>) {
    if (!matte) return { th: 2, cover: 0 };
    // Si el título no cabe entero dentro de la imagen (móvil: va a caballo de su
    // borde inferior), lo que pasara por delante solo cortaría la mitad alta de
    // las letras (una «d» se lee «a»): el título va entero por delante, como en
    // la landing, que tampoco usa la capa delantera en móvil.
    if (t.bottom > bx.bottom + 1 || t.top < bx.top) return { th: 2, cover: 0 };
    // Grupos: [0..nl) líneas · [nl] el título entero · [nl+1…] cada letra.
    const nl = Math.max(1, mask.lines.length), BINS = 128, nc = mask.chars.length;
    const hist = Array.from({ length: nl + 1 + nc }, () => new Uint32Array(BINS));
    const glyph = new Uint32Array(nl + 1 + nc);
    const zoom = reduced ? 1 : ZOOM;
    const cx = (bx.width / 2 - fit.dx) / fit.dw, cy = (bx.height / 2 - fit.dy) / fit.dh;
    const step = mask.w * mask.h > 400000 ? 2 : 1;
    // Por línea y por columna (COLS tramos a lo ancho): el valor más alto de la máscara bajo la letra.
    const COLS = 48;
    const colMax = new Int16Array(nl * COLS).fill(-1);
    mask.chars.forEach(([x0, y0, cw, ch], ci) => {
      let li = 0;
      while (li + 1 < nl && y0 >= mask.lines[li + 1] - 2) li++;
      const g = nl + 1 + ci;
      for (let y = Math.max(0, y0); y < Math.min(mask.h, y0 + ch); y += step) {
        const by = t.top - bx.top + y / maskK;
        for (let x = Math.max(0, x0); x < Math.min(mask.w, x0 + cw); x += step) {
          if (mask.a[(y * mask.w + x) * 4 + 3] < 128) continue;
          glyph[li]++;
          glyph[nl]++;
          glyph[g]++;
          const bxp = t.left - bx.left + x / maskK;
          const col = li * COLS + Math.min(COLS - 1, Math.floor((x / mask.w) * COLS));
          if (colMax[col] < 0) colMax[col] = 0;
          if (bxp < 0 || by < 0 || bxp >= bx.width || by >= bx.height) continue;
          const u = ((bxp - fit.dx) / fit.dw - cx) / zoom + cx, v = ((by - fit.dy) / fit.dh - cy) / zoom + cy;
          const m = matte!.data[Math.min(matte!.h - 1, Math.max(0, Math.floor(v * matte!.h))) * matte!.w + Math.min(matte!.w - 1, Math.max(0, Math.floor(u * matte!.w)))];
          const bin = m >> 1;
          hist[li][bin]++;
          hist[nl][bin]++;
          hist[g][bin]++;
          if (bin > colMax[col]) colMax[col] = bin;
        }
      }
    });
    if (!glyph[nl]) return { th: 2, cover: 0 };
    // Fracción tapada con el corte en `bin` (lo que queda por encima), el peor de título y líneas.
    const above = hist.map((hh) => {
      const acc = new Float64Array(BINS + 1);
      for (let b = BINS - 1; b >= 0; b--) acc[b] = acc[b + 1] + hh[b];
      return acc;
    });
    const worst = (bin: number) => {
      let w = 0;
      for (let g = 0; g <= nl; g++) if (glyph[g]) w = Math.max(w, above[g][bin] / glyph[g]);
      // Una letra tapada de más cuenta como si se pasara el tope.
      const charMax = CHAR_MAX_COLOR;
      for (let g = nl + 1; g < glyph.length; g++) if (glyph[g] && above[g][bin] / glyph[g] > charMax) return 1;
      // Y también si lo tapado cruza media palabra a lo ancho (el suelo, una
      // franja): eso no es una figura por delante, es un tachón.
      for (let li = 0; li < nl; li++) {
        let used = 0, hit = 0;
        for (let c = 0; c < COLS; c++) {
          const mx = colMax[li * COLS + c];
          if (mx < 0) continue;
          used++;
          if (mx >= bin) hit++;
        }
        if (used && hit / used > SPAN_MAX) return 1;
      }
      return w;
    };
    const minBin = Math.round(0.3 * BINS);
    const minCover = MIN_COVER;
    let cut = BINS;
    for (let b = BINS - 1; b >= minBin; b--) {
      if (worst(b) > COVER_TARGET) break;
      cut = b;
    }
    if (cut >= BINS) return { th: 2, cover: 0 };
    // Entre los cortes válidos, el más limpio (pocos píxeles de letra cerca del umbral) que aún tape algo.
    let best = cut, bestScore = Infinity;
    const band = 5;
    for (let b = cut; b < Math.min(BINS - 2, cut + 40); b++) {
      const cov = above[nl][b] / glyph[nl];
      if (cov < minCover) break;
      const unsure = (above[nl][Math.max(0, b - band)] - above[nl][Math.min(BINS, b + band)]) / glyph[nl];
      const score = unsure - 0.8 * cov;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    const cover = above[nl][best] / glyph[nl];
    // Muy poco tapado se ve como un mordisco suelto: mejor el título entero por delante.
    if (cover < minCover || cover > COVER_MAX) return { th: 2, cover: 0 };
    return { th: (best * 2) / 255, cover };
  }

  async function measure() {
    if (!alive || lost || !res) return;
    const run = ++maskRun;
    const c = canvas.getBoundingClientRect();
    if (c.width < 2 || c.height < 2) return;
    const b = (piece ? img : box).getBoundingClientRect();
    geo.w = Math.max(1, Math.round(c.width * dpr));
    geo.h = Math.max(1, Math.round(c.height * dpr));
    if (piece) {
      geo.pieceRect = [(b.left - c.left) * dpr, (b.top - c.top) * dpr, b.width * dpr, b.height * dpr];
      buildMesh(b.width * dpr, b.height * dpr);
      geo.ready = true;
      wake();
      return;
    }
    const t = h1.getBoundingClientRect();
    const fit = coverFit(img, b.width, b.height);
    const next = o.getTone();
    if (!next) return; // Stage aún no ha medido el velo
    const mask = await o.titleMask(maskK).catch(() => null);
    if (!alive || run !== maskRun || !res) return;
    if (!mask || !mask.exact) {
      // Sin la fuente real no se puede pintar el título: se queda el 2D.
      turnOff("fuente");
      return;
    }
    tone = next;
    geo.box = [(b.left - c.left) * dpr, (b.top - c.top) * dpr, b.width * dpr, b.height * dpr];
    geo.fit = [fit.dx * dpr, fit.dy * dpr, fit.dw * dpr, fit.dh * dpr];
    const q = dpr / maskK;
    geo.trect = [(t.left - c.left) * dpr, (t.top - c.top) * dpr, mask.w * q, mask.h * q];
    // Sombra del título: la máscara reducida a 1/6 con margen (se difumina al ampliarla).
    const pad = Math.round(30 * maskK), S = 6;
    const sc = document.createElement("canvas");
    sc.width = Math.ceil((mask.w + pad * 2) / S);
    sc.height = Math.ceil((mask.h + pad * 2) / S);
    const sx = sc.getContext("2d");
    if (sx) {
      sx.imageSmoothingQuality = "high";
      sx.drawImage(mask.canvas, pad / S, pad / S, mask.w / S, mask.h / S);
    }
    geo.srect = [geo.trect[0] - pad * q + 2 * dpr, geo.trect[1] - pad * q + 7 * dpr, sc.width * S * q, sc.height * S * q];
    const letters = fgMatte ? pickLetters(mask, b, t, fit) : null;
    const pick = letters ?? pickThreshold(mask, b, t, fit);
    geo.th = pick.th;
    coverEst = pick.cover;
    geo.soft = o.mode === "fondo" ? 0.035 : 0.045;
    geo.tz = o.mode === "fondo" ? 0.5 : 1;
    stage.dataset.k3dCover = (coverEst * 100).toFixed(1);
    drop(res.title);
    drop(res.sh);
    drop(res.ok);
    res.title = res.sh = res.ok = undefined;
    try {
      res.title = tex(mask.canvas);
      if (letters && letters.ok.some((v) => !v)) res.ok = tex(mask.subset(letters.ok));
      res.sh = tex(sc);
    } catch {
      turnOff("textura");
      return;
    }
    geo.ready = true;
    wake();
  }

  // ── Pieza: malla de la caja ───────────────────────────────
  function buildMesh(w: number, h: number) {
    if (!res?.mesh) return;
    const t = w * (o.spineRight ? 0.075 : 0.095); // grosor: tomo de manga algo más fino que un libro
    const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
    const v: number[] = [];
    // Cada cara: 4 esquinas (pos) + normal + uv de cada esquina + id de cara.
    const face = (p: number[][], n: number[], uv: number[][], id: number) => {
      for (const i of [0, 1, 2, 0, 2, 3]) v.push(...p[i], ...n, ...uv[i], id);
    };
    const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
    face([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], [0, 0, 1], UV, 0);
    face([[x0, y0, -t], [x1, y0, -t], [x1, y1, -t], [x0, y1, -t]], [0, 0, -1], UV, 3);
    const left = [[x0, y0, -t], [x0, y0, 0], [x0, y1, 0], [x0, y1, -t]];
    const right = [[x1, y0, -t], [x1, y0, 0], [x1, y1, 0], [x1, y1, -t]];
    // uv.x recorre el grosor.
    face(left, [-1, 0, 0], UV, o.spineRight ? 2 : 1);
    face(right, [1, 0, 0], UV, o.spineRight ? 1 : 2);
    const TB = [[0, 0], [0, 1], [1, 1], [1, 0]];
    face([[x0, y0, 0], [x1, y0, 0], [x1, y0, -t], [x0, y0, -t]], [0, -1, 0], TB, 2);
    face([[x0, y1, 0], [x1, y1, 0], [x1, y1, -t], [x0, y1, -t]], [0, 1, 0], TB, 2);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, res.mesh);
    gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array(v), gl!.STATIC_DRAW);
    res.meshN = v.length / 9;
  }

  // ── Estado del movimiento ─────────────────────────────────
  const m = { x: 0, y: 0, tx: 0, ty: 0, scroll: 0, tscroll: 0, wake: 0, t0: 0 };
  let visible = true, inView = true, gyro = false, beta0: number | null = null;
  let raf = 0, last = 0, lastDraw = "";
  const ambient = () => !reduced && (o.forceLoop || (coarse && !gyro));

  // Medidas.
  const deltas: number[] = [];
  let long = 0, frames = 0, cpuSum = 0, cpuN = 0, sinceCheck = 0;
  const stats = (): Stats => {
    const s = [...deltas].sort((a, b) => a - b);
    const mean = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
    return {
      fps: mean ? 1000 / mean : 0,
      p95: s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0,
      long, frames, cpu: cpuN ? cpuSum / cpuN : 0, dpr, renderer,
      texMB: texBytes / 1048576, cover: coverEst, moving: raf !== 0,
    };
  };

  function draw(now: number) {
    if (!res || !geo.ready) return false;
    const t = (now - m.t0) / 1000;
    const wakeK = reduced ? 0 : easeOut(m.wake);
    let ox = m.x, oy = m.y;
    if (ambient()) {
      ox += Math.sin(t * 0.42) * 0.55;
      oy += Math.cos(t * 0.31) * 0.35;
    }
    const key = [ox.toFixed(4), oy.toFixed(4), m.scroll.toFixed(4), wakeK.toFixed(4), geo.w, geo.h, geo.th, debug, dpr, tone?.alpha, tone?.band, tone?.bandLo, geo.trect[1]].join();
    if (key === lastDraw) return false;
    lastDraw = key;
    const g = gl!;
    if (canvas.width !== geo.w || canvas.height !== geo.h) {
      canvas.width = geo.w;
      canvas.height = geo.h;
    }
    g.viewport(0, 0, geo.w, geo.h);
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT | (piece ? g.DEPTH_BUFFER_BIT : 0));
    const bind = (unit: number, tx: WebGLTexture | undefined) => {
      g.activeTexture(g.TEXTURE0 + unit);
      g.bindTexture(g.TEXTURE_2D, tx ?? null);
    };
    const quad = (pr: WebGLProgram) => {
      g.useProgram(pr);
      g.bindBuffer(g.ARRAY_BUFFER, res!.quad);
      const loc = g.getAttribLocation(pr, "p");
      g.enableVertexAttribArray(loc);
      g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    };
    if (!piece && res.wide && res.uw && tone) {
      const U = res.uw;
      quad(res.wide);
      bind(0, res.img); bind(1, res.dep); bind(2, res.mat); bind(3, res.title); bind(4, res.sh); bind(5, res.ok ?? res.title);
      g.uniform1i(U.uImg, 0); g.uniform1i(U.uDep, 1); g.uniform1i(U.uMat, 2); g.uniform1i(U.uTitle, 3); g.uniform1i(U.uShadow, 4); g.uniform1i(U.uOk, 5);
      g.uniform2f(U.uRes, geo.w, geo.h);
      g.uniform2f(U.uOff, ox * OFF[0] * wakeK, (oy * OFF[1] - m.scroll * 0.02) * wakeK);
      g.uniform4f(U.uBox, geo.box[0], geo.box[1], geo.box[2], geo.box[3]);
      g.uniform4f(U.uFit, geo.fit[0], geo.fit[1], geo.fit[2], geo.fit[3]);
      g.uniform4f(U.uTRect, geo.trect[0], geo.trect[1], geo.trect[2], geo.trect[3]);
      g.uniform4f(U.uSRect, geo.srect[0], geo.srect[1], geo.srect[2], geo.srect[3]);
      g.uniform1f(U.uZoom, 1 + (ZOOM - 1) * wakeK);
      g.uniform1f(U.uTh, geo.th);
      g.uniform1f(U.uSoft, geo.soft);
      g.uniform1f(U.uTz, geo.tz);
      g.uniform1f(U.uScrimA, tone.alpha);
      g.uniform1f(U.uBand, tone.band * dpr);
      g.uniform1f(U.uBandLo, tone.bandLo * dpr);
      g.uniform1f(U.uAlpha, fgMatte ? 1 : 0);
      g.uniform1f(U.uFade, geo.box[3] * 0.32);
      g.uniform1f(U.uShadowA, tone.pick === "light" ? 0.32 : 0);
      g.uniform1f(U.uDebug, debug);
      g.uniform3f(U.uInk, tone.ink[0] / 255, tone.ink[1] / 255, tone.ink[2] / 255);
      g.uniform3f(U.uScrim, tone.scrim[0] / 255, tone.scrim[1] / 255, tone.scrim[2] / 255);
      g.disable(g.DEPTH_TEST);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    } else if (piece && res.boxPr && res.ub && res.shadow && res.us && res.mesh && res.meshN) {
      const [rx0, ry0, rw, rh] = geo.pieceRect;
      const side = o.spineRight ? -1 : 1;
      // Pose: un cuarto de giro hacia el lomo al despertar; el puntero (o el scroll) la mueve alrededor.
      const ry = (side * 0.3 + ox * 0.26 + m.scroll * side * 0.22) * wakeK;
      const rx = (-oy * 0.13 - 0.03) * wakeK;
      // Sombra de contacto (lo único que flota).
      g.disable(g.DEPTH_TEST);
      quad(res.shadow);
      g.uniform2f(res.us.uRes, geo.w, geo.h);
      g.uniform4f(res.us.uRect, rx0 - ry * rw * 0.22, ry0 + 24 * dpr, rw, rh);
      g.uniform1f(res.us.uBlur, 60 * dpr);
      g.uniform1f(res.us.uA, 0.36);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      // Caja.
      const U = res.ub;
      g.useProgram(res.boxPr);
      g.enable(g.DEPTH_TEST);
      g.depthFunc(g.LEQUAL);
      g.bindBuffer(g.ARRAY_BUFFER, res.mesh);
      const stride = 9 * 4;
      const attr = (name: string, size: number, off: number) => {
        const loc = g.getAttribLocation(res!.boxPr!, name);
        if (loc < 0) return;
        g.enableVertexAttribArray(loc);
        g.vertexAttribPointer(loc, size, g.FLOAT, false, stride, off * 4);
      };
      attr("aPos", 3, 0); attr("aNor", 3, 3); attr("aUv", 2, 6); attr("aFace", 1, 8);
      const cy = Math.cos(ry), sy = Math.sin(ry), cxr = Math.cos(rx), sxr = Math.sin(rx);
      // R = Rx · Ry (columnas), con la «y» de pantalla hacia abajo.
      g.uniformMatrix3fv(U.uRot, false, new Float32Array([
        cy, sxr * sy, -cxr * sy,
        0, cxr, sxr,
        sy, -sxr * cy, cxr * cy,
      ]));
      g.uniform2f(U.uRes, geo.w, geo.h);
      g.uniform2f(U.uCtr, rx0 + rw / 2, ry0 + rh / 2);
      g.uniform1f(U.uCam, Math.max(rw, rh) * 3.4);
      bind(0, res.img); bind(1, res.dep);
      g.uniform1i(U.uImg, 0); g.uniform1i(U.uDep, 1);
      g.uniform2f(U.uTilt, Math.sin(ry), -Math.sin(rx));
      // Relieve dentro de la cubierta (con mapa): apagado. La portada lleva su rótulo
      // impreso y un parallax interno lo deformaría. La pieza es igual en `capas` y en `fondo`.
      g.uniform1f(U.uRelief, 0);
      g.uniform1f(U.uSpineRight, o.spineRight ? 1 : 0);
      g.uniform1f(U.uSheen, 0.11 * wakeK);
      g.drawArrays(g.TRIANGLES, 0, res.meshN);
    } else {
      return false;
    }
    return true;
  }

  function frame(now: number) {
    raf = 0;
    if (!alive || lost || !visible || !inView) return;
    const dt = last ? now - last : 0;
    last = now;
    if (dt > 0 && dt < 250) {
      deltas.push(dt);
      if (deltas.length > 240) deltas.shift();
      if (dt > 32) long++;
      frames++;
      sinceCheck++;
    }
    const k = 1 - Math.pow(1 - 0.085, Math.max(1, dt / 16.7));
    m.x = lerp(m.x, m.tx, k);
    m.y = lerp(m.y, m.ty, k);
    m.scroll = lerp(m.scroll, m.tscroll, Math.min(1, k * 2.4));
    if (!reduced && m.wake < 1) m.wake = Math.min(1, m.wake + (dt || 16.7) / 1100);
    const c0 = performance.now();
    const painted = draw(now);
    if (painted) {
      cpuSum += performance.now() - c0;
      cpuN++;
      if (!on) {
        on = true;
        performance.mark("kp3d:first-frame");
        o.onState(true);
      }
    }
    // Presupuesto: si el p95 se va de 24 ms con el bucle en marcha, se baja la resolución un paso.
    if (sinceCheck >= 90) {
      sinceCheck = 0;
      const s = stats();
      if (s.p95 > 24 && dpr > 1) {
        dpr = Math.max(1, dpr - 0.25);
        deltas.length = 0;
        void measure();
      }
    }
    o.onStats?.(stats());
    const settling = Math.abs(m.tx - m.x) > 0.0006 || Math.abs(m.ty - m.y) > 0.0006 || Math.abs(m.tscroll - m.scroll) > 0.0006 || (!reduced && m.wake < 1);
    if (ambient() || settling) raf = requestAnimationFrame(frame);
    else last = 0; // en reposo: cero trabajo
  }
  function wake() {
    if (!raf && alive && !lost && visible && inView) {
      lastDraw = "";
      raf = requestAnimationFrame(frame);
    }
  }
  function turnOff(why: string) {
    if (on) on = false;
    o.onState(false, why);
  }

  // ── Entradas ──────────────────────────────────────────────
  const offs: (() => void)[] = [];
  const listen = (t: EventTarget, ev: string, fn: EventListener, opt?: AddEventListenerOptions) => {
    t.addEventListener(ev, fn, opt);
    offs.push(() => t.removeEventListener(ev, fn, opt));
  };
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine) {
    listen(stage, "pointermove", ((e: PointerEvent) => {
      if (reduced || e.pointerType === "touch") return;
      const r = stage.getBoundingClientRect();
      m.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      m.ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      wake();
    }) as EventListener, { passive: true });
    listen(stage, "pointerleave", () => {
      m.tx = 0;
      m.ty = 0;
      wake();
    });
  }
  const onScroll = () => {
    if (reduced) return;
    const r = stage.getBoundingClientRect();
    m.tscroll = clamp(-r.top / Math.max(1, r.height), 0, 1);
    wake();
  };
  listen(window, "scroll", onScroll, { passive: true });
  listen(document, "visibilitychange", () => {
    visible = document.visibilityState === "visible";
    if (visible) wake();
    else if (raf) { cancelAnimationFrame(raf); raf = 0; last = 0; }
  });
  const io = new IntersectionObserver((es) => {
    inView = es[es.length - 1].isIntersecting;
    if (inView) wake();
    else if (raf) { cancelAnimationFrame(raf); raf = 0; last = 0; }
  });
  io.observe(stage);
  offs.push(() => io.disconnect());
  // Giroscopio. Se recentra en la postura en que está el móvil al activarlo (y
  // sigue despacio a la postura si cambia: quien se recuesta no se queda con la
  // imagen torcida), zona muerta de 1,5° contra el temblor de la mano, ±18° de
  // recorrido y el mismo suavizado que el puntero. Con el móvil apaisado se
  // intercambian los ejes.
  const GYRO_RANGE = 18, GYRO_DEAD = 1.5;
  let gyroT = 0;
  let gamma0: number | null = null, gyroSeen: ((ok: boolean) => void) | null = null;
  const dead = (v: number) => (Math.abs(v) < GYRO_DEAD ? 0 : v - Math.sign(v) * GYRO_DEAD);
  const onOrient = ((e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    gyroSeen?.(true);
    if (reduced) return;
    const angle = (screen.orientation?.angle ?? 0) % 360;
    let lr = e.gamma, fb = e.beta;
    if (angle === 90) { lr = e.beta; fb = -e.gamma; }
    else if (angle === 270) { lr = -e.beta; fb = e.gamma; }
    else if (angle === 180) { lr = -e.gamma; fb = -e.beta; }
    if (gamma0 == null || beta0 == null) { gamma0 = lr; beta0 = fb; gyroT = performance.now(); }
    // El centro sigue MUY despacio a la postura (constante de 30 s): quien cambia de
    // postura acaba con la imagen centrada, pero un giro a propósito no se deshace.
    const now = performance.now();
    const k = 1 - Math.exp(-Math.min(1000, now - gyroT) / 30000);
    gyroT = now;
    gamma0 += (lr - gamma0) * k;
    beta0 += (fb - beta0) * k;
    m.tx = clamp(dead(lr - gamma0) / GYRO_RANGE, -1, 1);
    m.ty = clamp(dead(fb - beta0) / GYRO_RANGE, -1, 1);
    wake();
  }) as EventListener;

  // Pérdida de contexto: se retira el lienzo (queda el 2D) y, si vuelve, se rehace todo.
  listen(canvas, "webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
    res = null;
    geo.ready = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    turnOff("contexto perdido");
  });
  listen(canvas, "webglcontextrestored", () => {
    lost = false;
    if (build()) void measure();
  });

  visible = document.visibilityState === "visible";
  m.t0 = performance.now();
  if (reduced) m.wake = 1;
  onScroll();
  await measure();

  let syncRaf = 0;
  return {
    sync() {
      cancelAnimationFrame(syncRaf);
      syncRaf = requestAnimationFrame(() => void measure());
    },
    setReduced(v) {
      reduced = v;
      if (v) { m.tx = 0; m.ty = 0; m.x = 0; m.y = 0; m.scroll = 0; m.tscroll = 0; m.wake = 1; }
      else onScroll();
      void measure();
    },
    enableGyro() {
      if (gyro) return Promise.resolve(true);
      gamma0 = beta0 = null;
      window.addEventListener("deviceorientation", onOrient, { passive: true });
      return new Promise<boolean>((resolve) => {
        const timer = window.setTimeout(() => gyroSeen?.(false), 1500);
        gyroSeen = (ok) => {
          gyroSeen = null;
          clearTimeout(timer);
          gyro = ok; // con sensor, se para la deriva automática
          if (!ok) window.removeEventListener("deviceorientation", onOrient);
          wake();
          resolve(ok);
        };
      });
    },
    disableGyro() {
      gyro = false;
      window.removeEventListener("deviceorientation", onOrient);
      m.tx = 0;
      m.ty = 0;
      wake();
    },
    stats,
    reloadImage() {
      void (async () => {
        try {
          const next = await texSource(img, texCap);
          if (!alive || !res) return;
          (imgSrc as ImageBitmap).close?.();
          imgSrc = next;
          drop(res.img);
          res.img = tex(next);
          lastDraw = "";
          wake();
          if (!raf) draw(performance.now());
        } catch {
          // se queda la textura que había
        }
      })();
    },
    debug(mode) {
      debug = mode;
      lastDraw = "";
      if (!raf) draw(performance.now());
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("deviceorientation", onOrient);
      cancelAnimationFrame(syncRaf);
      offs.forEach((fn) => fn());
      if (res) {
        for (const t of [res.img, res.dep, res.mat, res.title, res.sh, res.ok]) drop(t);
        for (const p of [res.wide, res.shadow, res.boxPr]) if (p) gl.deleteProgram(p);
        gl.deleteBuffer(res.quad);
        if (res.mesh) gl.deleteBuffer(res.mesh);
        res = null;
      }
      (imgSrc as ImageBitmap).close?.();
      lose();
      delete stage.dataset.k3dCover;
    },
  };
}
