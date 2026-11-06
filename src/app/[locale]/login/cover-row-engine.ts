// ============================================================
// KULTURA — La fila de portadas de Entrar / Crear cuenta («El hueco»)
//
// Sin React: mueve las portadas con transform y pinta la profundidad en un solo
// lienzo. El formulario no espera nunca a esto: si no hay WebGL se ven las
// imágenes del HTML, y con movimiento reducido la fila se queda quieta.
// ============================================================

import type { LoginCover } from "@/lib/landing/login-covers";

export interface CoverRowHandle {
  destroy: () => void;
  setPaused: (paused: boolean) => void;
  /** Final: el formulario se gira y la fila se lo lleva. Resuelve siempre. */
  leave: (announce: string) => Promise<void>;
}

interface Options {
  root: HTMLElement;
  row: HTMLElement;
  slot: HTMLElement;
  panel: HTMLElement;
  slotImage: HTMLImageElement;
  capTitle: HTMLElement;
  capLabel: HTMLElement;
  live: HTMLElement;
  canvas: HTMLCanvasElement;
  covers: LoginCover[];
}

const STEP_EVERY_MS = 3400;
const STEP_MS = 1100;
const TALL = "(max-width: 860px), (max-height: 600px)";

export function startCoverRow(o: Options): CoverRowHandle {
  const { root, row, slot, panel, covers, canvas } = o;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const N = covers.length;
  const mod = (a: number) => ((a % N) + N) % N;
  const wrapK = (i: number, at: number) => {
    let k = (i - at) % N;
    if (k < -N / 2) k += N;
    if (k >= N / 2) k -= N;
    return k;
  };

  const items = covers.map((c, i) => {
    const el = row.querySelector<HTMLElement>(`[data-i="${i}"]`)!;
    return { c, i, el, flip: el.firstElementChild as HTMLElement, x: 0, k: 0, on: true, skip: false };
  });
  type Item = (typeof items)[number];

  let tall = window.matchMedia(TALL).matches;
  let vw = 0;
  let W = 0;
  let H = 0;
  let pitch = 0;
  let chamfer = 18;
  const startAt = tall ? 2 : 1; // en el móvil se arranca con una portada sin sangre
  let off = startAt;
  let target = startAt;
  let tween: { from: number; to: number; t0: number; ms: number } | null = null;
  let stepMs = STEP_MS;
  let nextAt = performance.now() + STEP_EVERY_MS + 1200;
  let paused = still;
  let leaving = false;
  let run: number | null = null;
  let hovered: Item | null = null;
  let pointer: [number, number] | null = null;
  let drag: { x: number; off: number; captured?: boolean } | null = null;
  let active: Item | null = null;
  let moved = true;
  let raf = 0;
  const timers: number[] = [];

  /* ---------- Medidas ---------- */
  function layout() {
    vw = document.documentElement.clientWidth;
    tall = window.matchMedia(TALL).matches;
    const rootTop = root.getBoundingClientRect().top;
    const rect = slot.getBoundingClientRect();
    if (tall) {
      const band = Math.min(rect.top - rootTop - 52 - 10, window.innerHeight * 0.62);
      root.toggleAttribute("data-nostrip", band < 80);
      chamfer = 16;
      H = Math.max(band, 0) + 40; // la fila pasa por detrás del borde del formulario
      W = H * 0.667;
      pitch = W + 10;
      row.style.top = "52px";
    } else {
      root.removeAttribute("data-nostrip");
      chamfer = 18;
      W = rect.width;
      H = rect.height;
      pitch = W + 16;
      row.style.top = `${rect.top - rootTop}px`;
    }
    row.style.setProperty("--row-w", `${W}px`);
    row.style.setProperty("--row-h", `${H}px`);
    root.style.setProperty("--pitch", `${pitch}px`);
    root.setAttribute("data-ready", "");
    sizeGl();
    moved = true;
  }

  /* ---------- Portada que manda ---------- */
  function setActive(it: Item) {
    if (active === it) return;
    active = it;
    o.capTitle.textContent = it.c.title;
    o.capLabel.textContent = ` · ${it.c.label}`;
    root.style.setProperty("--scene", it.c.scene);
    root.dataset.format = it.c.format;
  }
  const headOf = (at: number) => items[mod(Math.round(at) + (tall ? 0 : 1))];
  const handsOnForm = () => panel.matches(":hover") || panel.contains(document.activeElement);

  function frame(now: number) {
    const shut = root.hasAttribute("data-shut");
    const hidden = root.hasAttribute("data-nostrip");
    if (!paused && !leaving && !drag && !shut && !hovered && !hidden && !handsOnForm() && now > nextAt) {
      stepMs = STEP_MS;
      target += 1;
      nextAt = now + STEP_EVERY_MS;
    }
    if (!drag) {
      if (!tween || tween.to !== target) tween = { from: off, to: target, t0: now, ms: still ? 1 : stepMs };
      const p = Math.min(1, (now - tween.t0) / tween.ms);
      const v = tween.from + (tween.to - tween.from) * (1 - (1 - p) ** 4);
      if (v !== off) {
        off = v;
        moved = true;
      }
    }
    if (!hovered) setActive(headOf(drag ? off : target));
    if (moved) {
      const cx = vw / 2;
      for (const it of items) {
        it.k = wrapK(it.i, off);
        it.x = cx + it.k * pitch - W / 2;
        const vis = !it.skip && it.x + W > -24 && it.x < vw + 24 && (tall || Math.abs(it.k) > 0.02);
        if (vis !== it.on) {
          it.on = vis;
          it.el.style.visibility = vis ? "visible" : "hidden";
        }
        if (vis) {
          it.el.style.transform = `translate3d(${it.x}px,0,0)`;
          it.el.classList.toggle("is-left", it.k < 0);
          it.flip.style.transitionDelay = `${Math.round(Math.abs(it.k) * 45)}ms`;
        }
      }
    }
    if (run !== null) slot.style.transform = `translateX(${(run - off) * pitch}px) perspective(1600px) rotateY(180deg)`;
    if (!shut && (moved || glDirty || (!paused && !still))) drawGl(now);
    moved = false;
    raf = requestAnimationFrame(frame);
  }

  /* ---------- Mano ---------- */
  const itemAt = (x: number) => items.find((it) => it.on && x >= it.x && x <= it.x + W) ?? null;
  const onMove = (e: PointerEvent) => {
    if (drag) {
      if (Math.abs(e.clientX - drag.x) > 5 && !drag.captured) {
        drag.captured = true;
        row.classList.add("is-dragging");
        row.setPointerCapture?.(e.pointerId);
      }
      off = drag.off - (e.clientX - drag.x) / pitch;
      moved = true;
      return;
    }
    if (e.pointerType !== "mouse" || leaving) return;
    pointer = [e.clientX, e.clientY];
    hovered = itemAt(e.clientX);
    if (hovered) setActive(hovered);
  };
  const onLeave = () => {
    if (drag) return;
    hovered = null;
    pointer = null;
    nextAt = performance.now() + 1500;
  };
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, off };
  };
  const onUp = () => {
    if (!drag) return;
    target = Math.round(off);
    stepMs = 700;
    tween = null;
    drag = null;
    row.classList.remove("is-dragging");
    nextAt = performance.now() + 5000;
  };
  row.addEventListener("pointermove", onMove, { passive: true });
  row.addEventListener("pointerleave", onLeave);
  row.addEventListener("pointerdown", onDown);
  row.addEventListener("pointerup", onUp);
  row.addEventListener("pointercancel", onUp);

  /* ---------- Teclado del móvil: la ventana visible encoge con un campo enfocado ---------- */
  let baseH = window.innerHeight;
  let baseW = window.innerWidth;
  function syncKeyboard() {
    const vv = window.visualViewport;
    const v = vv ? vv.height * vv.scale : window.innerHeight;
    const a = document.activeElement as HTMLInputElement | null;
    const field = !!a && a.tagName === "INPUT" && a.type !== "checkbox" && panel.contains(a);
    if (window.innerWidth !== baseW) {
      baseW = window.innerWidth;
      baseH = window.innerHeight;
    }
    if (!field) baseH = Math.max(baseH, v);
    const on = window.matchMedia(TALL).matches && field && v < baseH - 150;
    if (on !== root.hasAttribute("data-kb")) root.toggleAttribute("data-kb", on);
  }
  const syncSoon = () => timers.push(window.setTimeout(syncKeyboard, 60));
  window.visualViewport?.addEventListener("resize", syncKeyboard);
  panel.addEventListener("focusin", syncSoon);
  panel.addEventListener("focusout", syncSoon);

  // Cubre cambios de modo, errores, teclado y la barra de desplazamiento al aparecer o irse.
  const observer = new ResizeObserver(() => layout());
  observer.observe(slot);
  observer.observe(document.documentElement);

  /* ---------- Profundidad: al moverse la fila, lo cercano se desplaza respecto al fondo ---------- */
  let gl: WebGLRenderingContext | null = null;
  let glDirty = false;
  const u: Record<string, WebGLUniformLocation | null> = {};
  const tex = new Map<string, { i?: WebGLTexture | null; d?: WebGLTexture | null }>();

  function texOf(im: HTMLImageElement) {
    const g = gl!;
    const t = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, t);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, im);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    return t;
  }
  // Una textura por fotograma y ya decodificada: el formulario nunca espera a la profundidad.
  async function loadTextures() {
    const order = [...items].sort((a, b) => Math.abs(a.k) - Math.abs(b.k));
    for (const { c } of order) {
      if (tex.has(c.image)) continue;
      const t: { i?: WebGLTexture | null; d?: WebGLTexture | null } = {};
      tex.set(c.image, t);
      for (const [key, src] of [["i", c.image], ["d", c.depth ?? c.image]] as const) {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.src = src;
        try {
          await im.decode();
          await new Promise(requestAnimationFrame);
          if (!gl) return;
          t[key] = texOf(im);
          glDirty = true;
        } catch {
          gl = null;
          canvas.remove();
          return;
        }
      }
    }
  }
  function initGl() {
    try {
      gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
      if (!gl) return;
      const g = gl;
      const vs = `attribute vec2 a; uniform vec4 r; uniform vec2 w; varying vec2 v; void main(){ v=a; vec2 s=r.xy+a*r.zw; vec2 c=s/w*2.-1.; gl_Position=vec4(c.x,-c.y,0.,1.); }`;
      const fs = `precision mediump float; varying vec2 v; uniform sampler2D i, d; uniform vec2 s, f, p, z; uniform float t, c;
        void main(){ vec2 l=v*z; if(l.x+(z.y-l.y)<c) discard; vec2 q=v*s+(1.-s)*f; float e=texture2D(d,q).r-t; q+=e*p*s; gl_FragColor=vec4(texture2D(i,q).rgb,1.); }`;
      const shader = (type: number, src: string) => {
        const x = g.createShader(type)!;
        g.shaderSource(x, src);
        g.compileShader(x);
        return x;
      };
      const pr = g.createProgram()!;
      g.attachShader(pr, shader(g.VERTEX_SHADER, vs));
      g.attachShader(pr, shader(g.FRAGMENT_SHADER, fs));
      g.linkProgram(pr);
      g.useProgram(pr);
      g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), g.STATIC_DRAW);
      const a = g.getAttribLocation(pr, "a");
      g.enableVertexAttribArray(a);
      g.vertexAttribPointer(a, 2, g.FLOAT, false, 0, 0);
      for (const n of ["r", "w", "i", "d", "s", "f", "p", "t", "z", "c"]) u[n] = g.getUniformLocation(pr, n);
      g.uniform1i(u.i, 0);
      g.uniform1i(u.d, 1);
      sizeGl();
      void loadTextures();
    } catch {
      gl = null;
      canvas.remove();
    }
  }
  function sizeGl() {
    if (!gl || !vw) return;
    const r = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(vw * r);
    canvas.height = Math.max(1, Math.round(H * r));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.w, vw, Math.max(1, H));
    glDirty = true;
  }
  function drawGl(now: number) {
    if (!gl) return;
    const g = gl;
    glDirty = false;
    g.clearColor(0, 0, 0, 0);
    g.clear(g.COLOR_BUFFER_BIT);
    const quiet = paused || still || handsOnForm();
    const top = row.getBoundingClientRect().top;
    for (const it of items) {
      const t = tex.get(it.c.image);
      if (!it.on || !t?.i || !t.d) continue;
      const c = it.c;
      const ra = W / H;
      const ia = c.width / c.height;
      g.uniform4f(u.r, it.x, 0, W, H);
      g.uniform2f(u.z, W, H);
      g.uniform1f(u.c, chamfer);
      g.uniform2f(u.s, ra < ia ? ra / ia : 1, ra < ia ? 1 : ia / ra);
      g.uniform2f(u.f, c.focus[0], c.focus[1]);
      g.uniform1f(u.t, c.threshold);
      let px = 0;
      let py = 0;
      if (!quiet && c.depth) {
        px = ((it.x + W / 2 - vw / 2) / vw) * 0.035 + Math.sin(now / 2800 + it.i) * 0.004;
        py = Math.cos(now / 3600 + it.i) * 0.004;
        if (pointer && hovered === it) {
          px += ((pointer[0] - (it.x + W / 2)) / W) * -0.03;
          py += ((pointer[1] - (top + H / 2)) / H) * -0.03;
        }
      }
      g.uniform2f(u.p, px, py);
      g.activeTexture(g.TEXTURE1);
      g.bindTexture(g.TEXTURE_2D, t.d);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, t.i);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    }
  }

  /* ---------- Arranque ---------- */
  layout();
  for (const it of items) {
    it.k = wrapK(it.i, off);
  }
  setActive(headOf(target));
  raf = requestAnimationFrame(frame);
  timers.push(window.setTimeout(initGl, 700));

  return {
    destroy() {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      observer.disconnect();
      row.removeEventListener("pointermove", onMove);
      row.removeEventListener("pointerleave", onLeave);
      row.removeEventListener("pointerdown", onDown);
      row.removeEventListener("pointerup", onUp);
      row.removeEventListener("pointercancel", onUp);
      window.visualViewport?.removeEventListener("resize", syncKeyboard);
      panel.removeEventListener("focusin", syncSoon);
      panel.removeEventListener("focusout", syncSoon);
      gl = null;
    },
    setPaused(next) {
      paused = next;
      glDirty = true;
      if (!next) nextAt = performance.now() + 800;
    },
    leave(announce) {
      o.live.textContent = announce;
      if (still) return Promise.resolve();
      return new Promise((resolve) => {
        leaving = true;
        panel.inert = true;
        const behind = items[mod(Math.round(target))];
        behind.skip = true;
        moved = true;
        o.slotImage.src = behind.c.image;
        root.setAttribute("data-leaving", "");
        timers.push(
          window.setTimeout(() => {
            slot.style.transition = "none";
            run = off;
            stepMs = 900;
            target += 4;
          }, 380),
          window.setTimeout(resolve, 1100),
        );
      });
    },
  };
}
