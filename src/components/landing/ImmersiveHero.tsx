"use client";

// ============================================================
// KULTURA — Hero inmersivo de la landing (E-LANDING-INMERSIVA)
//
// Sección fijada (sticky) de varias pantallas de alto: un lienzo WebGL con el
// galería de portadas reales detrás y tres capítulos de texto encima que se
// cruzan con el scroll (titular → los siete formatos → CTA).
//
// Decisiones (y por qué):
//   - El progreso del scroll viaja como custom property `--p` en el elemento,
//     y las opacidades de los capítulos se calculan en CSS con `clamp()`: el
//     scroll NO re-renderiza React. Solo cambia estado cuando cambia el formato
//     en pantalla o se entra/sale del capítulo final (que tiene que volverse
//     clicable).
//   - three.js se carga con `import()` al montar: ni el bundle inicial ni el
//     primer pintado esperan a la escena. Hasta que llega, el texto ya se lee
//     sobre `--bg`.
//   - Respaldo ESTÁTICO (el hero de siempre: collage + tira de móvil) cuando el
//     sistema pide reducir movimiento o no hay WebGL. Una landing que marea o
//     que se queda en negro es peor que una quieta.
// ============================================================

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { KButton } from "@/components/ui/KButton";
import { HeroCollage, HeroStrip, HERO_COLLAGE_SLOTS } from "@/components/landing/HeroCollage";
import type { ShowcaseItem } from "@/lib/landing/showcase";
import type { ImmersiveScene } from "@/lib/landing/immersive-scene";
import {
  FINAL_FROM,
  IMMERSIVE_FORMATS,
  TYPE_HUE,
  formatIndexAt,
  textureUrl,
  type ImmersiveCopy,
} from "@/lib/landing/immersive";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Tope para enseñar la galería aunque falten portadas. */
const REVEAL_MAX_MS = 3500;
/**
 * Sin muestra todavía (fallback del Suspense) se espera algo más antes de
 * enseñar gradientes: lo normal es que la muestra llegue y sustituya al hero.
 */
const EMPTY_REVEAL_MS = 4000;

function canUseWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function ImmersiveHero({ items, copy }: { items: ShowcaseItem[]; copy: ImmersiveCopy }) {
  const [mode, setMode] = React.useState<"immersive" | "static">("immersive");
  const [formatIdx, setFormatIdx] = React.useState(0);
  const [isFinal, setIsFinal] = React.useState(false);
  const sectionRef = React.useRef<HTMLElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const mm = typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : null;
    const reduce = !mm || mm("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !canUseWebGL()) {
      setMode("static");
      return;
    }

    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;

    let scene: ImmersiveScene | null = null;
    let cancelled = false;
    let visible = true;
    let raf = 0;
    let lastIdx = -1;
    let lastFinal = false;
    const mobile = !!mm && mm("(max-width: 767px)").matches;

    // La galería se enseña cuando han llegado las primeras portadas (lo avisa
    // la escena) o, como tarde, al cumplirse el tope: un proveedor lento no puede
    // dejar la landing sin fondo. Mientras, el titular ya se lee sobre `--bg`.
    const reveal = () => {
      if (!cancelled) canvas.dataset.ready = "true";
    };
    const revealTimer = window.setTimeout(reveal, items.length > 0 ? REVEAL_MAX_MS : EMPTY_REVEAL_MS);

    // Geometría de la sección cacheada (se recalcula al redimensionar): leer
    // `getBoundingClientRect` en cada frame de scroll fuerza un layout síncrono
    // justo después de haber escrito `--p`, y eso se nota como tirones.
    let top = 0;
    let total = 0;
    const measure = () => {
      top = section.getBoundingClientRect().top + window.scrollY;
      total = section.offsetHeight - window.innerHeight;
    };
    measure();
    const readProgress = () => (total > 0 ? Math.min(1, Math.max(0, (window.scrollY - top) / total)) : 0);

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = readProgress();
        section.style.setProperty("--p", p.toFixed(4));
        scene?.setProgress(p);
        const idx = formatIndexAt(p);
        if (idx !== lastIdx) {
          lastIdx = idx;
          setFormatIdx(idx);
        }
        const fin = p >= FINAL_FROM;
        if (fin !== lastFinal) {
          lastFinal = fin;
          setIsFinal(fin);
        }
      });
    };

    const onPointer = (e: PointerEvent) => {
      scene?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    const onResize = () => {
      measure();
      scene?.resize();
      onScroll();
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) scene?.start();
      else scene?.stop();
    });
    io.observe(section);

    import("@/lib/landing/immersive-scene")
      .then(({ createImmersiveScene }) => {
        if (cancelled) return;
        const bgCss = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "black";
        scene = createImmersiveScene(
          canvas,
          items.map((it) => ({ src: textureUrl(it.poster), hue: TYPE_HUE[it.type] ?? 300 })),
          // Sin muestra (el fallback del Suspense, o un catálogo caído) no hay
          // nada que esperar: el tope de abajo enseña la galería de gradientes.
          { mobile, bgCss, onReady: items.length > 0 ? reveal : undefined }
        );
        scene.setProgress(readProgress());
        if (visible) scene.start();
      })
      .catch(() => {
        if (!cancelled) setMode("static");
      });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    onScroll();

    return () => {
      cancelled = true;
      window.clearTimeout(revealTimer);
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      scene?.dispose();
    };
  }, [items]);

  if (mode === "static") return <StaticHero items={items} copy={copy} />;

  const format = IMMERSIVE_FORMATS[formatIdx];

  return (
    <section
      ref={sectionRef}
      aria-label={copy.title}
      className="relative h-[340vh] md:h-[420vh]"
      style={{ ["--p" as string]: 0 }}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-1000 data-[ready=true]:opacity-100"
        />
        {/* Viñeta: el texto siempre se lee, pase la portada que pase detrás. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 will-change-[opacity]"
          style={{
            background:
              // Pesa a la izquierda y abajo, donde va el texto: el centro y la
              // derecha quedan para la galería (composición asimétrica).
              "linear-gradient(100deg, var(--bg) 0%, transparent 62%), linear-gradient(to top, var(--bg) 0%, transparent 38%)",
            // La viñeta se retira en el capítulo final: ahí el protagonista es
            // el muro de portadas, y el CTA lleva su propio velo.
            opacity: "clamp(0, calc(0.7 - (var(--p) - 0.7) * 4), 0.7)",
          }}
        />

        {/* Capítulo 1 — titular */}
        <div
          className="absolute inset-0 flex flex-col justify-end px-6 pb-16 md:px-14 md:pb-24 will-change-[opacity,transform]"
          style={{ opacity: "clamp(0, calc((0.15 - var(--p)) * 9), 1)", transform: "translateY(calc(var(--p) * -60vh))" }}
        >
          <div className="relative self-start">
            <span
              className="absolute -left-1 -top-9 md:-left-3 md:-top-10 rotate-[-8deg] rounded-full bg-accent-lime px-4 py-2 font-display text-sm font-extrabold leading-none text-on-accent-lime whitespace-nowrap"
              style={{ boxShadow: "4px 4px 0 rgba(0,0,0,.4)" }}
            >
              {copy.badge}
            </span>
            <h1 className="font-display text-[clamp(3rem,8vw,8rem)] font-extrabold leading-[0.92] tracking-[-0.035em] text-text-primary text-balance max-w-[12ch]">
              {copy.title} <span className="text-accent-lime">{copy.titleAccent}</span>
            </h1>
          </div>
          <p className="mt-7 max-w-[42ch] text-lg md:text-xl text-text-secondary text-pretty">{copy.sub}</p>
        </div>

        {/* Capítulo 2 — los siete formatos */}
        <div
          aria-live="polite"
          className="absolute inset-x-0 bottom-0 px-6 pb-14 md:px-14 md:pb-16 will-change-[opacity]"
          style={{
            opacity: "min(clamp(0, calc((var(--p) - 0.16) * 14), 1), clamp(0, calc((0.72 - var(--p)) * 14), 1))",
          }}
        >
          <div>
            <p
              key={format}
              className="font-display font-extrabold leading-[0.85] tracking-[-0.04em] text-[clamp(4rem,15vw,13rem)] animate-[k-word_700ms_cubic-bezier(.2,.8,.2,1)_both]"
              style={{ color: `oklch(80% 0.2 ${TYPE_HUE[format]})` }}
            >
              {copy.formats[format]}
            </p>
          </div>
        </div>

        {/* Capítulo 3 — CTA sobre el muro de portadas */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center will-change-[opacity]"
          style={{
            opacity: "clamp(0, calc((var(--p) - 0.84) * 10), 1)",
            pointerEvents: isFinal ? "auto" : "none",
            visibility: isFinal ? "visible" : "hidden",
          }}
        >
          <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: "radial-gradient(ellipse 75% 45% at 50% 50%, var(--bg) 35%, transparent 100%)" }} />
          <h2 className="font-display text-[clamp(2.75rem,7vw,6.5rem)] font-extrabold leading-[0.95] tracking-[-0.03em] text-text-primary text-balance max-w-[16ch]">
            {copy.finalTitle}
          </h2>
          <p className="mt-6 max-w-lg text-lg text-text-secondary">{copy.finalSub}</p>
          <div className="mt-9">
            <KButton variant="primary" size="lg" asChild>
              <Link href="/login?mode=register">{copy.cta}</Link>
            </KButton>
          </div>
        </div>

        {/* Hilo de progreso */}
        {/* Grano: rompe la planitud digital del fondo (ruido SVG en data URI,
            permitido por img-src). Fijo y sin eventos. SIN mix-blend-mode: un
            modo de fusión sobre un lienzo que cambia en cada frame obliga a
            recomponer la pantalla entera cada frame, y era lo que más pesaba
            al hacer scroll. Opacidad simple, en su propia capa. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.035] [transform:translateZ(0)]"
          style={{ backgroundImage: GRAIN }}
        />

        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1">
          <div className="h-full bg-accent-pink origin-left will-change-transform" style={{ transform: "scaleX(var(--p))" }} />
        </div>
      </div>
    </section>
  );
}

/** Hero estático de siempre: reducir movimiento o sin WebGL. */
function StaticHero({ items, copy }: { items: ShowcaseItem[]; copy: ImmersiveCopy }) {
  return (
    <section className="px-4 md:px-8 pt-14 md:pt-20 pb-10 md:pb-14">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div className="text-center md:text-left">
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-text-primary leading-[1.05] mb-8 text-balance">
            {copy.staticTagline}
          </h1>
          <div className="flex justify-center md:justify-start">
            <KButton variant="primary" size="lg" asChild>
              <Link href="/login?mode=register">{copy.staticCta}</Link>
            </KButton>
          </div>
          <HeroStrip items={items} />
        </div>
        <HeroCollage items={items.slice(0, HERO_COLLAGE_SLOTS)} badge={copy.badge} />
      </div>
    </section>
  );
}
