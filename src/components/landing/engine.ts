// ============================================================
// KULTURA — Motor de la landing v2 (sin React ni dependencias)
//
// Pinta con WebGL las portadas con su mapa de profundidad (parallax por
// desplazamiento de UV, como el prototipo «KULTURA landing v2»):
// - la portada: dos lienzos por escena (fondo y capa delantera recortada por
//   profundidad) con el nombre entre ambos;
// - el resto de ventanas: UN lienzo fijo que pinta cada ventana visible en
//   su rectángulo (scissor), con el chaflán de 18 px.
// El HTML ya trae cada imagen en un <img>: si no hay WebGL, una textura falla
// o el JS no llega, la página se ve igual, solo que plana. Con
// `prefers-reduced-motion` no hay paso automático de escenas ni deriva.
// Devuelve una función que lo desmonta todo.
// ============================================================

export interface HeroScene {
  image: string;
  depth: string;
  w: number;
  h: number;
  th: number;
  fx: number;
  fy: number;
  layered: boolean;
  accent: string;
  caption: string;
  meta: string;
}

const SEG_MS = 7000;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const VS = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
const FS = `precision highp float;varying vec2 v;
uniform sampler2D iA,dA,iB,dB;uniform vec2 res,off;uniform float aspA,aspB,thA,thB,wipe,layer,zoom,cut,mixAB,scrim;uniform vec2 fA,fB;
vec2 cover(vec2 uv,float a,vec2 f){float ca=res.x/res.y;vec2 s=ca>a?vec2(1.,a/ca):vec2(ca/a,1.);vec2 o=(1.-s)*f;return o+uv*s;}
vec4 samp(sampler2D I,sampler2D D,float a,vec2 f,float th,out float al){
  vec2 uv=(v-.5)/zoom+.5;vec2 c=cover(vec2(uv.x,1.-uv.y),a,f);
  float d=texture2D(D,c).r;vec2 p=c-off*(d-.5);
  d=texture2D(D,p).r;p=c-off*(d-.5);d=max(d,texture2D(D,p).r);p=c-off*(d-.5);
  d=texture2D(D,p).r;al=smoothstep(th-.03,th+.03,d);
  return texture2D(I,clamp(p,.002,.998));}
float chamfer(vec2 q,vec2 h,float k){vec2 a=abs(q);return step(a.x,h.x)*step(a.y,h.y)*step(a.x+a.y,h.x+h.y-k);}
void main(){
  float aa,ab;vec4 col=samp(iA,dA,aspA,fA,thA,aa);float al=aa;
  if(wipe>0.){vec4 B=samp(iB,dB,aspB,fB,thB,ab);vec2 q=(v-.5)*res;float s=wipe*wipe*(3.-2.*wipe);float m=chamfer(q,res*.5*s*1.08,min(res.x,res.y)*.12*s);col=mix(col,B,m);al=mix(al,ab,m);}
  if(mixAB>0.){vec4 B=samp(iB,dB,aspB,fB,thB,ab);col=mix(col,B,mixAB);al=mix(al,ab,mixAB);}
  if(cut>0.){vec2 px=v*res;if(px.x+px.y<cut)discard;}
  float sc=1.-scrim*(smoothstep(.0,.42,.42-v.y)*.74+smoothstep(.82,1.,v.y)*.35);
  if(layer>.5)gl_FragColor=vec4(col.rgb*sc*al,al);else gl_FragColor=vec4(col.rgb*sc,1.);
}`;

interface Pic { image: string; depth: string; w: number; h: number }
interface DrawOpts {
  a: string; b?: string | null; thA?: number; thB?: number; wipe?: number; mix?: number;
  off: [number, number]; zoom?: number; cut?: number; scrim?: number; layer?: number;
  fa?: [number, number]; fb?: [number, number]; x: number; y: number; w: number; h: number;
}

/**
 * GPU por software (SwiftShader, llvmpipe…): pintar a cada fotograma bloquearía
 * el hilo principal, así que se queda la imagen plana. `?gl=1` lo fuerza (pruebas).
 */
function isSoftware(gl: WebGLRenderingContext): boolean {
  if (new URLSearchParams(location.search).get("gl") === "1") return false;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  return /swiftshader|llvmpipe|softpipe|software/i.test(name);
}

/** Imágenes compartidas entre contextos (cada contexto sube su textura). */
const imgCache = new Map<string, Promise<HTMLImageElement>>();
function loadImg(src: string): Promise<HTMLImageElement> {
  let p = imgCache.get(src);
  if (!p) {
    p = new Promise((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.decoding = "async";
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
    imgCache.set(src, p);
  }
  return p;
}

function makeGL(canvas: HTMLCanvasElement, alpha: boolean, pics: Map<string, Pic>) {
  const gl = canvas.getContext("webgl", { alpha, premultipliedAlpha: true, antialias: false, failIfMajorPerformanceCaveat: true });
  if (!gl || isSoftware(gl)) return null;
  const sh = (t: number, s: string) => {
    const o = gl.createShader(t)!;
    gl.shaderSource(o, s);
    gl.compileShader(o);
    return o;
  };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const names = ["iA", "dA", "iB", "dB", "res", "off", "aspA", "aspB", "thA", "thB", "wipe", "layer", "zoom", "cut", "mixAB", "scrim", "fA", "fB"];
  const U: Record<string, WebGLUniformLocation | null> = {};
  names.forEach((n) => (U[n] = gl.getUniformLocation(pr, n)));
  gl.uniform1i(U.iA, 0);
  gl.uniform1i(U.dA, 1);
  gl.uniform1i(U.iB, 2);
  gl.uniform1i(U.dB, 3);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  type Tex = { ready: false } | { ready: true; i: WebGLTexture; d: WebGLTexture };
  const texs = new Map<string, Tex>();
  const listeners = new Set<(k: string) => void>();
  const tex = (img: HTMLImageElement) => {
    const g = gl!;
    const t = g.createTexture()!;
    g.bindTexture(g.TEXTURE_2D, t);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    return t;
  };
  function get(k: string): Tex {
    const have = texs.get(k);
    if (have) return have;
    const pic = pics.get(k);
    const pending: Tex = { ready: false };
    texs.set(k, pending);
    if (pic) {
      Promise.all([loadImg(pic.image), loadImg(pic.depth)])
        .then(([i, d]) => {
          if (gl!.isContextLost()) return;
          texs.set(k, { ready: true, i: tex(i), d: tex(d) });
          listeners.forEach((fn) => fn(k));
        })
        .catch(() => {});
    }
    return pending;
  }
  function bindSet(slot: number, k: string) {
    const t = get(k);
    if (!t.ready) return false;
    gl!.activeTexture(gl!.TEXTURE0 + slot);
    gl!.bindTexture(gl!.TEXTURE_2D, t.i);
    gl!.activeTexture(gl!.TEXTURE1 + slot);
    gl!.bindTexture(gl!.TEXTURE_2D, t.d);
    return true;
  }
  function draw(o: DrawOpts) {
    if (!bindSet(0, o.a)) return false;
    let hasB = false;
    if (o.b && ((o.wipe ?? 0) > 0 || (o.mix ?? 0) > 0)) hasB = bindSet(2, o.b);
    const ma = pics.get(o.a)!;
    const mb = o.b ? pics.get(o.b) ?? ma : ma;
    gl!.uniform2f(U.res, o.w, o.h);
    gl!.uniform2f(U.off, o.off[0], o.off[1]);
    gl!.uniform1f(U.aspA, ma.w / ma.h);
    gl!.uniform1f(U.aspB, mb.w / mb.h);
    gl!.uniform1f(U.thA, o.thA ?? 0.5);
    gl!.uniform1f(U.thB, o.thB ?? 0.5);
    gl!.uniform1f(U.wipe, hasB ? o.wipe ?? 0 : 0);
    gl!.uniform1f(U.mixAB, hasB ? o.mix ?? 0 : 0);
    gl!.uniform1f(U.layer, o.layer ?? 0);
    gl!.uniform1f(U.zoom, o.zoom ?? 1);
    gl!.uniform1f(U.cut, o.cut ?? 0);
    gl!.uniform1f(U.scrim, o.scrim ?? 0);
    gl!.uniform2f(U.fA, ...(o.fa ?? [0.5, 0.5]));
    gl!.uniform2f(U.fB, ...(o.fb ?? [0.5, 0.5]));
    gl!.viewport(o.x, o.y, o.w, o.h);
    gl!.scissor(o.x, o.y, o.w, o.h);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    return true;
  }
  const isReady = (k: string) => texs.get(k)?.ready === true;
  return { gl, draw, get, isReady, onReady: (fn: (k: string) => void) => listeners.add(fn) };
}

interface Win {
  el: HTMLElement; k: string; b: string | null; mix: number;
  fx: number; fy: number; hover: number; hx: number; hy: number; sx: number; sy: number;
}

export function startLanding(root: HTMLElement, scenes: HeroScene[]): () => void {
  // Solo se vuelve a pintar si algo cambió (scroll, puntero, transición o una
  // textura nueva): en reposo, y siempre con «reducir movimiento», cero trabajo de GPU.
  let ready = 0;
  let lastHero = "", lastWins = "";
  const off: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(t: Window | HTMLElement, ev: K | string, fn: EventListener, o?: AddEventListenerOptions) => {
    t.addEventListener(ev, fn, o);
    off.push(() => t.removeEventListener(ev, fn, o));
  };
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const narrow = () => innerWidth <= 860;
  const DPR = Math.min(devicePixelRatio || 1, 1.5);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  on(window, "pointermove", ((e: PointerEvent) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }) as EventListener, { passive: true });

  // Catálogo de imágenes: clave = URL de la imagen.
  const pics = new Map<string, Pic>();
  scenes.forEach((s) => pics.set(s.image, s));
  const winEls = [...root.querySelectorAll<HTMLElement>(".kl-win[data-img]")];
  const readPic = (el: HTMLElement, pre = "") => {
    const d = el.dataset;
    const image = d[`${pre}img`]!;
    if (!pics.has(image)) pics.set(image, { image, depth: d[`${pre}depth`]!, w: Number(d[`${pre}w`]), h: Number(d[`${pre}h`]) });
    return image;
  };
  winEls.forEach((el) => {
    readPic(el);
    if (el.dataset.altimg) readPic(el, "alt");
  });

  const steps = [...root.querySelectorAll<HTMLElement>(".kl-step")];

  /* ---------- portada: escenas con capas ---------- */
  const hero = root.querySelector<HTMLElement>(".kl-stage")!;
  const word = hero.querySelector<HTMLElement>(".kl-word");
  // Sin lienzos de portada (el héroe lo pinta la escena 3D de LandingMotion)
  // el motor solo lleva las ventanas, los pasos y la pulsación larga.
  const bgC = hero.querySelector<HTMLCanvasElement>("canvas.kl-bg");
  const fgC = hero.querySelector<HTMLCanvasElement>("canvas.kl-fg");
  const bg = bgC ? makeGL(bgC, false, pics) : null;
  const fg = fgC ? makeGL(fgC, true, pics) : null;
  const st = { cur: 0, next: -1, wipe: 0, vis: true };
  const io1 = new IntersectionObserver((es) => (st.vis = es[0].isIntersecting));
  io1.observe(hero);
  off.push(() => io1.disconnect());
  if (bg) {
    // Primero la escena visible; las demás, cuando esa ya está.
    const rest = () => scenes.slice(1).forEach((s) => { bg.get(s.image); fg?.get(s.image); });
    bg.get(scenes[0].image);
    fg?.get(scenes[0].image);
    if (bg.isReady(scenes[0].image)) { hero.dataset.gl = ""; rest(); }
    bg.onReady((k) => { ready++; if (k === scenes[0].image) { hero.dataset.gl = ""; rest(); } });
    fg?.onReady(() => ready++);
  }
  const fitHero = () => {
    const w = Math.round(hero.clientWidth * DPR), h = Math.round(hero.clientHeight * DPR);
    [bgC, fgC].forEach((c) => { if (c && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; } });
  };
  function renderHero(t: number) {
    if (!st.vis || !bg || !bgC) return;
    fitHero();
    const r = hero.getBoundingClientRect();
    const prog = clamp(-r.top / r.height, -1, 1);
    const A = scenes[st.cur], B = st.next >= 0 ? scenes[st.next] : null;
    const drift = coarse || RM ? [RM ? 0 : Math.sin(t * 0.35) * 0.7, RM ? 0 : Math.cos(t * 0.28) * 0.4] : [pointer.x, pointer.y];
    const key = [Math.round(r.top), drift[0].toFixed(4), drift[1].toFixed(4), st.cur, st.next, st.wipe.toFixed(3), bgC.width, bgC.height, ready, narrow()].join();
    if (key === lastHero) return;
    lastHero = key;
    const o: DrawOpts = {
      a: A.image, b: B ? B.image : null, thA: A.th, thB: B ? B.th : 0.5, wipe: st.wipe,
      off: [drift[0] * 0.016, -drift[1] * 0.01 - prog * 0.022], zoom: 1.05 + Math.max(0, prog) * 0.1,
      fa: [A.fx, A.fy], fb: B ? [B.fx, B.fy] : undefined, x: 0, y: 0, w: bgC.width, h: bgC.height, scrim: 1,
    };
    bg.gl.clearColor(0, 0, 0, 1);
    bg.gl.clear(bg.gl.COLOR_BUFFER_BIT);
    const ok = bg.draw({ ...o, layer: 0 });
    if (fg) {
      fg.gl.clearColor(0, 0, 0, 0);
      fg.gl.clear(fg.gl.COLOR_BUFFER_BIT);
      // Capa delantera solo si la escena lo permite (y nunca en móvil).
      const layered = A.layered && (!B || B.layered || st.wipe < 0.5);
      if (ok && layered && !narrow()) fg.draw({ ...o, layer: 1 });
    }
    if (word) word.style.transform = `translate3d(${-drift[0] * 8}px,${prog * -24}%,0) translateY(-50%)`;
  }

  const segs = [...hero.querySelectorAll<HTMLButtonElement>(".kl-segs button[data-i]")];
  const pauseBtn = hero.querySelector<HTMLButtonElement>(".kl-pause");
  const cap = hero.querySelector<HTMLElement>(".kl-cap");
  const phImg = hero.querySelector<HTMLImageElement>("img.kl-ph");
  let heroIdx = 0, segStart = performance.now(), paused = RM;
  const lum = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  };
  function setScene(i: number) {
    const s = scenes[i];
    if (cap) {
      cap.textContent = s.caption + " ";
      const f = document.createElement("span");
      f.className = "f";
      f.textContent = s.meta;
      cap.appendChild(f);
    }
    segs.forEach((b, k) => b.setAttribute("aria-current", String(k === i)));
    root.style.setProperty("--scene", s.accent);
    root.style.setProperty("--scene-ink", lum(s.accent) > 0.55 ? "#0a0a0a" : "#f2f2f0");
    // Sin WebGL, la imagen plana sigue a la escena.
    if (!bg && phImg) { phImg.src = s.image; phImg.style.objectPosition = `${s.fx * 100}% ${s.fy * 100}%`; }
    heroIdx = i;
    segStart = performance.now();
  }
  function go(i: number) {
    if (i === st.cur || st.next >= 0) return;
    setScene(i);
    if (!bg) { st.cur = i; return; }
    st.next = i;
    st.wipe = 0;
    const t0 = performance.now(), d = RM ? 1 : 1400;
    const tick = () => {
      st.wipe = Math.min(1, (performance.now() - t0) / d);
      if (st.wipe < 1) requestAnimationFrame(tick);
      else { st.cur = st.next; st.next = -1; st.wipe = 0; }
    };
    requestAnimationFrame(tick);
  }
  segs.forEach((b) => on(b, "click", () => go(Number(b.dataset.i))));
  if (pauseBtn) {
    const sync = () => {
      pauseBtn.setAttribute("aria-pressed", String(paused));
      pauseBtn.setAttribute("aria-label", paused ? pauseBtn.dataset.play! : pauseBtn.dataset.pause!);
      pauseBtn.querySelector("[data-icon=pause]")?.toggleAttribute("hidden", paused);
      pauseBtn.querySelector("[data-icon=play]")?.toggleAttribute("hidden", !paused);
    };
    sync();
    on(pauseBtn, "click", () => { paused = !paused; segStart = performance.now(); sync(); });
  }
  setScene(0);

  /* ---------- ventanas: un solo lienzo fijo ---------- */
  const glC = root.querySelector<HTMLCanvasElement>("canvas.kl-gl");
  const P = glC ? makeGL(glC, true, pics) : null;
  const wins: Win[] = winEls.map((el) => ({
    el, k: el.dataset.img!, b: null, mix: 0,
    fx: Number(el.dataset.fx ?? 0.5), fy: Number(el.dataset.fy ?? 0.4),
    hover: 0, hx: 0, hy: 0, sx: 0, sy: 0,
  }));
  if (P) {
    const mark = () => wins.forEach((w) => { if (P.isReady(w.k)) w.el.dataset.gl = ""; });
    // Cada textura se pide cuando su ventana se acerca a la pantalla.
    const near = new IntersectionObserver(
      (es) => es.forEach((en) => {
        if (!en.isIntersecting) return;
        near.unobserve(en.target);
        const el = en.target as HTMLElement;
        P.get(el.dataset.img!);
        if (el.dataset.altimg) P.get(el.dataset.altimg);
        // La ventana fija de «Así funciona» cambia de imagen con cada paso.
        if (el.dataset.how !== undefined) steps.forEach((st) => st.dataset.img && P.get(st.dataset.img));
      }),
      { rootMargin: "100% 0px" },
    );
    off.push(() => near.disconnect());
    wins.forEach((w) => {
      near.observe(w.el);
      on(w.el, "pointermove", ((e: PointerEvent) => {
        const r = w.el.getBoundingClientRect();
        w.hx = ((e.clientX - r.left) / r.width) * 2 - 1;
        w.hy = ((e.clientY - r.top) / r.height) * 2 - 1;
        w.hover = 1;
      }) as EventListener);
      on(w.el, "pointerleave", () => (w.hover = 0));
    });
    P.onReady(() => { ready++; mark(); });
    mark();
  }
  function swapWin(w: Win | undefined, k: string) {
    if (!w || !P || (w.k === k && !w.b)) return;
    if (w.b) w.k = w.b;
    w.b = k;
    w.mix = 0;
    P.get(k);
    const t0 = performance.now(), d = RM ? 1 : 700;
    const tick = () => {
      w.mix = Math.min(1, (performance.now() - t0) / d);
      if (w.mix < 1) requestAnimationFrame(tick);
      else { w.k = w.b!; w.b = null; w.mix = 0; }
    };
    requestAnimationFrame(tick);
  }
  function renderWins(t: number) {
    if (!P || !glC) return;
    const W = Math.round(innerWidth * DPR), H = Math.round(innerHeight * DPR);
    if (glC.width !== W || glC.height !== H) { glC.width = W; glC.height = H; }
    const visible: [Win, DOMRect][] = [];
    const parts: (string | number)[] = [W, H, ready];
    for (const w of wins) {
      const r = w.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth || r.width < 2) continue;
      w.sx = lerp(w.sx, w.hover ? w.hx : pointer.x * 0.35, 0.07);
      w.sy = lerp(w.sy, w.hover ? w.hy : pointer.y * 0.35, 0.07);
      visible.push([w, r]);
      parts.push(Math.round(r.left), Math.round(r.top), w.sx.toFixed(3), w.sy.toFixed(3), w.k, w.b ?? "", w.mix.toFixed(3), w.hover);
    }
    if (coarse && !RM) parts.push(t.toFixed(2));
    const key = parts.join();
    if (key === lastWins) return;
    lastWins = key;
    const gl = P.gl;
    gl.enable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, W, H);
    gl.scissor(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    for (const [w, r] of visible) {
      const cy = ((r.top + r.height / 2) / innerHeight) * 2 - 1;
      const amp = RM ? 0 : coarse ? 0.014 : 0.022;
      const o: [number, number] = [
        w.sx * amp + (coarse && !RM ? Math.sin(t * 0.5 + r.top * 0.01) * 0.008 : 0),
        -w.sy * amp * 0.7 + (RM ? 0 : cy * 0.018),
      ];
      P.draw({
        a: w.k, b: w.b, mix: w.mix, off: o, zoom: 1.04 + (w.hover ? 0.02 : 0), cut: 18 * DPR,
        x: Math.round(r.left * DPR), y: Math.round((innerHeight - r.bottom) * DPR),
        w: Math.round(r.width * DPR), h: Math.round(r.height * DPR), fa: [w.fx, w.fy], fb: [w.fx, w.fy],
      });
    }
  }

  /* ---------- carril de funciones ---------- */
  const inSec = root.querySelector<HTMLElement>(".kl-inside");
  const rail = root.querySelector<HTMLElement>(".kl-rail");
  function railScroll() {
    if (!inSec || !rail || narrow()) return;
    const r = inSec.getBoundingClientRect();
    const p = clamp(-r.top / (r.height - innerHeight), 0, 1);
    const max = Math.max(0, rail.scrollWidth - innerWidth);
    rail.style.transform = `translate3d(${-p * max}px,0,0)`;
  }

  /* ---------- amigos: mantener pulsado ---------- */
  const fw = root.querySelector<HTMLElement>(".kl-holdable");
  if (fw) {
    const fwW = wins.find((w) => w.el === fw);
    const ring = fw.querySelector<SVGCircleElement>(".fc");
    const base = fw.dataset.img!, alt = fw.dataset.altimg!;
    let anim: Animation | null = null, shown = false;
    const reveal = (v: boolean) => {
      shown = v;
      fw.classList.toggle("is-on", v);
      fw.setAttribute("aria-pressed", String(v));
      swapWin(fwW, v ? alt : base);
    };
    on(fw, "pointerdown", ((e: PointerEvent) => {
      if (e.button > 0) return;
      try { fw.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
      if (shown || !ring) return;
      anim = ring.animate([{ strokeDashoffset: 50.3 }, { strokeDashoffset: 0 }], { duration: RM ? 1 : 480, easing: "linear", fill: "forwards" });
      anim.onfinish = () => reveal(true);
    }) as EventListener);
    const rel = () => { if (anim) { anim.cancel(); anim = null; } if (shown) reveal(false); };
    on(fw, "pointerup", rel);
    on(fw, "pointercancel", rel);
    on(fw, "contextmenu", (e) => e.preventDefault());
    on(fw, "keydown", ((e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); reveal(!shown); }
    }) as EventListener);
  }

  /* ---------- así funciona ---------- */
  const howW = wins.find((w) => w.el.dataset.how !== undefined);
  const chip = root.querySelector<HTMLElement>(".kl-how-left .kl-chip");
  const sio = new IntersectionObserver(
    (es) => es.forEach((en) => {
      if (!en.isIntersecting) return;
      steps.forEach((s) => s.classList.toggle("is-on", s === en.target));
      const k = (en.target as HTMLElement).dataset.img;
      if (k) swapWin(howW, k);
      chip?.classList.toggle("is-on", !!(en.target as HTMLElement).dataset.chip);
    }),
    { rootMargin: "-45% 0px -45% 0px" },
  );
  steps.forEach((s) => sio.observe(s));
  off.push(() => sio.disconnect());
  steps[0]?.classList.add("is-on");

  /* ---------- entradas al hacer scroll ---------- */
  if (!RM) {
    const io = new IntersectionObserver(
      (es) => es.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target as HTMLElement;
        const kids = el.dataset.stagger !== undefined ? [...el.children] : [el];
        kids.forEach((k, j) => k.animate(
          [{ opacity: 0, transform: "translateY(32px)" }, { opacity: 1, transform: "none" }],
          { duration: 900, delay: j * 70, easing: "cubic-bezier(.2,0,0,1)", fill: "backwards" },
        ));
      }),
      { rootMargin: "0px 0px 10% 0px" },
    );
    root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
      if (el.getBoundingClientRect().top > innerHeight * 1.1) io.observe(el);
    });
    off.push(() => io.disconnect());
  }

  /* ---------- bucle ---------- */
  const t0 = performance.now();
  let raf = 0;
  function frame() {
    const now = performance.now();
    const t = (now - t0) / 1000;
    pointer.x = lerp(pointer.x, pointer.tx, 0.06);
    pointer.y = lerp(pointer.y, pointer.ty, 0.06);
    renderHero(t);
    renderWins(t);
    railScroll();
    if (st.vis && scenes.length > 1) {
      const p = paused ? 0 : (now - segStart) / SEG_MS;
      segs.forEach((b, k) => {
        const i = b.firstElementChild as HTMLElement | null;
        if (i) i.style.transform = `scaleX(${k < heroIdx ? 1 : k === heroIdx ? (paused ? 1 : Math.min(p, 1)) : 0})`;
      });
      if (!paused && p >= 1 && st.next < 0) go((heroIdx + 1) % scenes.length);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    off.forEach((fn) => fn());
  };
}
