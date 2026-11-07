/* eslint-disable @next/next/no-img-element -- `<img>` nativo, como la portada:
   esta página no carga el JS de next/image. */
// ============================================================
// KULTURA — Mini-landing de una cuña (F1, prueba de humo, D2)
//
// `/[locale]/series` y `/[locale]/anime`: una promesa, una portada real y un
// CTA de alta. Usa el lenguaje de la landing v2 (`landing.css`: ventana con
// chaflán, botón del color de la escena, pie con los legales), sin el motor
// WebGL ni la composición de la portada. HTML del servidor, cacheable en el
// CDN, más la isla mínima del CTA (`WedgeCta`).
// ============================================================

import type { ReactNode } from "react";
import type { LandingMedia } from "@/lib/landing/media";
import type { Wedge } from "@/lib/analytics/attribution";
import { WedgeCta } from "./WedgeCta";
import "./landing.css";

export interface WedgeCopy {
  locale: "es" | "en";
  login: string;
  navLabel: string;
  title: string;
  lead: string;
  points: string[];
  cta: string;
  footerNav: string;
  links: Array<{ href: string; text: string }>;
  otherLocale: { href: string; text: string; lang: string };
  attribution: ReactNode;
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/**
 * Texto sobre el color de la escena, calculado en el servidor (la portada lo
 * hace en `engine.ts`, que aquí no se carga): la tinta, clara u oscura, con más
 * contraste WCAG sobre el acento de la semana.
 */
export function sceneInk(accent: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(accent)) return "#0a0a0a";
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const n = parseInt(accent.slice(1), 16);
  const l = 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
  // Luminancias relativas de #0a0a0a (0,0030) y #f2f2f0 (0,8879).
  return (l + 0.05) / (0.003 + 0.05) >= (0.8879 + 0.05) / (l + 0.05) ? "#0a0a0a" : "#f2f2f0";
}

export function WedgeLanding({
  wedge,
  poster,
  copy,
  base,
}: {
  wedge: Wedge;
  poster: LandingMedia;
  copy: WedgeCopy;
  base: string;
}) {
  const href = (p: string) => `${base}${p}`;
  return (
    <div className="kl kl-wedge" style={{ ["--scene" as string]: poster.accent, ["--scene-ink" as string]: sceneInk(poster.accent) }}>
      <header className="kl-top">
        <a className="kl-brand kl-display" href={href("")}>
          KULTURA
        </a>
        <nav aria-label={copy.navLabel}>
          {/* Con la cuña: si desde «Entrar» pasa a crear cuenta, el alta no la pierde. */}
          <a href={href(`/login?mode=login&wedge=${wedge}`)}>{copy.login}</a>
        </nav>
      </header>

      <main className="kl-main" id="main">
        <section className="kl-wedge-hero" aria-labelledby="kl-h1">
          <div className="kl-wedge-text">
            <h1 className="kl-display" id="kl-h1">
              {copy.title}
            </h1>
            <p className="kl-lead kl-sub">{copy.lead}</p>
            <ul className="kl-wedge-points">
              {copy.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="kl-actions">
              <WedgeCta href={href(`/login?mode=register&wedge=${wedge}`)} wedge={wedge}>
                {copy.cta}
              </WedgeCta>
            </div>
          </div>
          <figure className="kl-win kl-wedge-win">
            <img
              className="kl-ph"
              src={poster.image}
              alt=""
              width={poster.width}
              height={poster.height}
              fetchPriority="high"
              decoding="async"
              style={{ objectPosition: `${pct(poster.focus[0])} ${pct(poster.focus[1])}` }}
            />
          </figure>
        </section>
      </main>

      <footer className="kl-foot">
        <nav aria-label={copy.footerNav}>
          <ul className="kl-flinks">
            {copy.links.map((l) => (
              <li key={l.href}>
                <a href={href(l.href)}>{l.text}</a>
              </li>
            ))}
            <li>
              <a href={copy.otherLocale.href} hrefLang={copy.otherLocale.lang} lang={copy.otherLocale.lang}>
                {copy.otherLocale.text}
              </a>
            </li>
          </ul>
        </nav>
        <div className="kl-legal">
          <p>© {new Date().getFullYear()} KULTURA</p>
          {copy.attribution}
        </div>
      </footer>
    </div>
  );
}
