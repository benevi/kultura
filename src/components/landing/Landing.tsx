/* eslint-disable @next/next/no-img-element -- `<img>` nativo a propósito: la
   landing no carga el JS de next/image, y cada imagen la sustituye WebGL. */
import type { HTMLAttributes, ReactNode } from "react";
import type { LandingMedia } from "@/lib/landing/media";
import { RANKING_FORMATS, formatRating, type LandingScenes, type RankingFormat } from "@/lib/landing/scenes";
import type { FaqItem } from "@/lib/landing/faq";
import type { HeroScene } from "./engine";
import { LandingMotion } from "./LandingMotion";
import "./landing.css";

/** Las siete columnas de la comparativa, en orden. */
export const COMPARE_FORMATS = ["movie", "tv", "anime", "manga", "game", "book", "comic"] as const;
type CompareFormat = (typeof COMPARE_FORMATS)[number];
/** Qué formato cubre cada app (el suyo principal). */
const APPS: [string, CompareFormat[]][] = [
  ["KULTURA", [...COMPARE_FORMATS]],
  ["Letterboxd", ["movie"]],
  ["Trakt", ["movie", "tv"]],
  ["MyAnimeList", ["anime", "manga"]],
  ["Goodreads", ["book"]],
  ["Backloggd", ["game"]],
];

export interface LandingCopy {
  locale: "es" | "en";
  nav: { label: string; features: string; rankings: string; faq: string; login: string };
  hero: { lead: string; cta: string; demo?: string; scenes: string; pause: string; play: string };
  features: {
    title: string;
    items: { title: string; desc: string }[];
    hold: string;
    holdLabel: string;
    friendNow: string;
  };
  how: { title: string; steps: { title: string; desc: string }[]; status: string };
  rankings: { title: string; sub: string; cta: string; year: number; label: Record<RankingFormat, string>; score: (s: string) => string };
  compare: { title: string; sub: string; app: string; yes: string; no: string; note: string; formats: Record<CompareFormat, string>; short: Record<CompareFormat, string> };
  faq: { title: string; items: FaqItem[] };
  footer: { nav: string; links: { href: string; text: string }[]; otherLocale: { href: string; text: string; lang: string } };
  /** Pie de proveedores de datos (ya renderizado en el servidor). */
  attribution: ReactNode;
  /** «Película», «Serie»… para el pie de cada escena de la portada. */
  typeLabel: Record<string, string>;
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

/** Ventana con chaflán: la imagen plana ya en el HTML; WebGL la sustituye. */
function Win({
  m,
  className = "",
  sizes,
  alt,
  children,
  ...rest
}: {
  m: LandingMedia;
  className?: string;
  sizes?: string;
  alt?: LandingMedia;
  children?: ReactNode;
} & Pick<HTMLAttributes<HTMLDivElement>, "role" | "tabIndex" | "aria-pressed" | "aria-label"> & { "data-how"?: string }) {
  const altData = alt
    ? { "data-altimg": alt.image, "data-altdepth": alt.depth, "data-altw": alt.width, "data-alth": alt.height }
    : {};
  return (
    <div
      className={`kl-win ${className}`}
      data-img={m.image}
      data-depth={m.depth}
      data-w={m.width}
      data-h={m.height}
      data-fx={m.focus[0]}
      data-fy={m.focus[1]}
      {...altData}
      {...rest}
    >
      <img
        className="kl-ph"
        src={m.image}
        alt=""
        width={m.width}
        height={m.height}
        sizes={sizes}
        loading="lazy"
        decoding="async"
        style={{ objectPosition: `${pct(m.focus[0])} ${pct(m.focus[1])}` }}
      />
      {alt && (
        <img
          className="kl-ph kl-alt"
          src={alt.image}
          alt=""
          width={alt.width}
          height={alt.height}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: `${pct(alt.focus[0])} ${pct(alt.focus[1])}` }}
        />
      )}
      {children}
    </div>
  );
}

/** Portada pública (rediseño v2): toda la página en HTML del servidor + una isla WebGL. */
export function Landing({ scenes, copy, base }: { scenes: LandingScenes; copy: LandingCopy; base: string }) {
  const { locale } = copy;
  const heroScenes: HeroScene[] = scenes.hero.map((m) => ({
    image: m.image,
    depth: m.depth,
    w: m.width,
    h: m.height,
    th: m.threshold,
    fx: m.focus[0],
    fy: m.focus[1],
    layered: m.layered,
    accent: m.accent,
    caption: m.title,
    meta: ["", copy.typeLabel[m.type] ?? m.format, m.year].filter((x) => x !== null && x !== undefined).join(" · ").trim(),
  }));
  const first = heroScenes[0];
  const [fLibrary, fAi, fFriends, fLists] = scenes.feature;
  // Lo que «está viendo» Lucía al mantener pulsado: una de los pasos (no se repite en la tarjeta).
  const friendAlt = scenes.step[1];
  const href = (p: string) => `${base}${p}`;

  return (
    <div className="kl" style={{ ["--scene" as string]: first.accent }}>
      <div className="kl-intro" aria-hidden="true">
        <span className="kl-display">KULTURA</span>
      </div>
      <LandingMotion scenes={heroScenes} />

      <header className="kl-top">
        <a className="kl-brand kl-display" href={href("")}>
          KULTURA
        </a>
        <nav aria-label={copy.nav.label}>
          <a className="hide-m" href="#dentro">{copy.nav.features}</a>
          <a className="hide-m" href="#rankings">{copy.nav.rankings}</a>
          <a className="hide-m" href="#preguntas">{copy.nav.faq}</a>
          <a href={href("/login?mode=login")}>{copy.nav.login}</a>
        </nav>
      </header>

      <main className="kl-main" id="main">
        <section className="kl-stage" aria-labelledby="kl-h1">
          <img
            className="kl-ph"
            src={first.image}
            alt=""
            width={first.w}
            height={first.h}
            fetchPriority="high"
            decoding="async"
            style={{ objectPosition: `${pct(first.fx)} ${pct(first.fy)}` }}
          />
          <canvas className="kl-bg" aria-hidden="true" />
          <h1 className="kl-word kl-display" id="kl-h1">
            <span>KULTURA</span>
          </h1>
          <canvas className="kl-fg" aria-hidden="true" />
          <div className="kl-hero-foot">
            <div>
              <p className="kl-lead kl-sub">{copy.hero.lead}</p>
              <div className="kl-actions">
                <a className="kl-btn is-scene" href={href("/login?mode=register")}>
                  {copy.hero.cta}
                </a>
                {copy.hero.demo && (
                  // E-DEMO: formulario POST (cambia la sesión; un GET lo dispararía una precarga).
                  <form action="/api/auth/demo" method="post">
                    <input type="hidden" name="locale" value={locale} />
                    <button type="submit" className="kl-link">
                      {copy.hero.demo}
                    </button>
                  </form>
                )}
              </div>
            </div>
            <div className="kl-hero-side">
              <p className="kl-cap" aria-live="polite">
                {first.caption} <span className="f">{first.meta}</span>
              </p>
              {heroScenes.length > 1 && (
                <div className="kl-segs" role="group" aria-label={copy.hero.scenes}>
                  {heroScenes.map((s, i) => (
                    <button key={s.image} type="button" data-i={i} aria-label={s.caption} aria-current={i === 0}>
                      <i />
                    </button>
                  ))}
                  <button
                    type="button"
                    className="kl-pause"
                    aria-label={copy.hero.pause}
                    aria-pressed="false"
                    data-pause={copy.hero.pause}
                    data-play={copy.hero.play}
                  >
                    <span data-icon="pause"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1h3.5v12H2zM8.5 1H12v12H8.5z" /></svg></span>
                    <span data-icon="play" hidden><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1l10 6-10 6z" /></svg></span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="kl-inside" id="dentro" aria-labelledby="kl-in">
          <div className="kl-pin">
            <h2 className="kl-display" id="kl-in">{copy.features.title}</h2>
            <ul className="kl-rail">
              <li className="kl-card">
                <Win m={fLibrary} />
                <h3 className="kl-display">{copy.features.items[0].title}</h3>
                <p>{copy.features.items[0].desc}</p>
              </li>
              <li className="kl-card">
                <Win m={fAi} />
                <h3 className="kl-display">{copy.features.items[1].title}</h3>
                <p>{copy.features.items[1].desc}</p>
              </li>
              <li className="kl-card">
                <Win
                  m={fFriends}
                  alt={friendAlt}
                  className="kl-holdable"
                  tabIndex={0}
                  role="button"
                  aria-pressed={false}
                  aria-label={copy.features.holdLabel}
                >
                  <span className="kl-who">{copy.features.friendNow.replace("{title}", friendAlt.title)}</span>
                  <span className="kl-ring" aria-hidden="true">
                    <svg viewBox="0 0 20 20"><circle className="bgc" cx="10" cy="10" r="8" /><circle className="fc" cx="10" cy="10" r="8" /></svg>
                    {copy.features.hold}
                  </span>
                </Win>
                <h3 className="kl-display">{copy.features.items[2].title}</h3>
                <p>{copy.features.items[2].desc}</p>
              </li>
              <li className="kl-card">
                <Win m={fLists} />
                <h3 className="kl-display">{copy.features.items[3].title}</h3>
                <p>{copy.features.items[3].desc}</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="kl-how" id="funciona" aria-labelledby="kl-how">
          <div className="kl-how-left">
            <Win m={scenes.step[0]} data-how="">
              <div className="kl-chip">
                <span>{copy.how.status}</span>
                <span>9</span>
              </div>
            </Win>
          </div>
          <div>
            <h2 className="kl-display" id="kl-how" data-reveal="">{copy.how.title}</h2>
            <ol className="kl-steps">
              {copy.how.steps.map((s, i) => (
                <li key={s.title} className="kl-step" data-img={scenes.step[i].image} data-chip={i === 1 ? "" : undefined}>
                  <Win m={scenes.step[i]} className="kl-m-win">
                    {i === 1 && (
                      <div className="kl-chip">
                        <span>{copy.how.status}</span>
                        <span>9</span>
                      </div>
                    )}
                  </Win>
                  <h3 className="kl-display">{s.title}</h3>
                  <p>{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="kl-best" id="rankings" aria-labelledby="kl-best">
          <div className="kl-best-head" data-reveal="">
            <h2 className="kl-display" id="kl-best">{copy.rankings.title}</h2>
            <p>{copy.rankings.sub}</p>
          </div>
          <ul className="kl-tiles" data-reveal="" data-stagger="">
            {RANKING_FORMATS.map((f) => {
              const m = scenes.ranking[f];
              const score = formatRating(m.rating, locale);
              return (
                <li key={f}>
                  <a className="kl-tile" href={href(`/best/${f}/${copy.rankings.year}`)}>
                    <Win m={m}>
                      {score && (
                        <span className="kl-score kl-display" aria-label={copy.rankings.score(score)}>
                          {score}
                        </span>
                      )}
                    </Win>
                    <h3 className="kl-fmt kl-display">{copy.rankings.label[f]}</h3>
                    <p className="kl-lead-t">{m.title}</p>
                    <span className="kl-link">{copy.rankings.cta}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="kl-vs" id="comparativa" aria-labelledby="kl-vs">
          <h2 className="kl-display" id="kl-vs" data-reveal="">{copy.compare.title}</h2>
          <p data-reveal="">{copy.compare.sub}</p>
          <table className="kl-matrix">
            <caption className="kl-fine">{copy.compare.note}</caption>
            <thead>
              <tr>
                <th scope="col">{copy.compare.app}</th>
                {COMPARE_FORMATS.map((f) => (
                  <th scope="col" key={f}>
                    <span className="lg">{copy.compare.formats[f]}</span>
                    <span className="sh" aria-hidden="true">{copy.compare.short[f]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody data-reveal="" data-stagger="">
              {APPS.map(([name, has], i) => (
                <tr key={name} className={i === 0 ? "is-us" : undefined}>
                  <th scope="row" className="kl-display">{name}</th>
                  {COMPARE_FORMATS.map((f) => (
                    <td key={f}>
                      {has.includes(f) ? (
                        <span className="kl-dot" role="img" aria-label={copy.compare.yes} />
                      ) : (
                        <span className="kl-no" role="img" aria-label={copy.compare.no} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="kl-faq" id="preguntas" aria-labelledby="kl-faq">
          <h2 className="kl-display" id="kl-faq" data-reveal="">{copy.faq.title}</h2>
          <div data-reveal="" data-stagger="">
            {copy.faq.items.map((it) => (
              <details key={it.key}>
                <summary className="kl-sub">
                  {it.q}
                  <i aria-hidden="true" />
                </summary>
                <p>{it.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="kl-foot">
        <nav aria-label={copy.footer.nav}>
          <ul className="kl-flinks">
            {copy.footer.links.map((l) => (
              <li key={l.href}>
                <a href={href(l.href)}>{l.text}</a>
              </li>
            ))}
            <li>
              <a href={copy.footer.otherLocale.href} hrefLang={copy.footer.otherLocale.lang} lang={copy.footer.otherLocale.lang}>
                {copy.footer.otherLocale.text}
              </a>
            </li>
          </ul>
        </nav>
        <div className="kl-fword kl-display" aria-hidden="true" data-reveal="">
          KULTURA
        </div>
        <div className="kl-legal">
          <p>© {new Date().getFullYear()} KULTURA</p>
          {copy.attribution}
        </div>
      </footer>
    </div>
  );
}
