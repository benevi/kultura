import { getTranslations } from "next-intl/server";
import { kulturaDisplay } from "@/app/fonts";
import { renderDataAttribution } from "@/components/legal/DataAttribution";
import { getLandingMedia, type LandingMedia } from "@/lib/landing/media";
import { buildLandingScenes } from "@/lib/landing/scenes";
import { getLandingShowcase } from "@/lib/landing/showcase";
import { env } from "@/lib/env.server";
import { Stage, type StageWork } from "./Stage";
import { Logo } from "@/components/layout/Logo";
import { Blocks, formatVar } from "../Blocks";
import "../tokens.css";
import "../skin.css";
import "./portada.css";

// ============================================================
// KULTURA v2 — Portada pública (sistema «Láminas»)
//
// Ruta cacheable: sin cookies ni sesión. Solo `<a>` hacia las rutas con nonce
// (lo exige el grafo de imports de `tests/unit/csp/static-pages.test.ts`).
// ============================================================

const FORMATS = ["tv", "movie", "anime", "manga", "book", "comic", "game"] as const;
type Format = (typeof FORMATS)[number];

/** Color de cada formato en sRGB 0-1, para el shader (igual que `tokens.css`). */
const RGB: Record<string, [number, number, number]> = {
  tv: [1, 0.29, 0.11],
  anime: [1, 0.435, 0.659],
  manga: [0.937, 0.914, 0.863],
  game: [0.714, 0.949, 0.227],
};

/** Obras del «+1»: las que tienen unidad clara y mapa de profundidad. */
const LIVE: Array<{ id: "tv" | "anime" | "manga" | "game"; unit: string; start: number; total: number }> = [
  { id: "tv", unit: "episode", start: 4, total: 10 },
  { id: "anime", unit: "episode", start: 7, total: 13 },
  { id: "manga", unit: "chapter", start: 31, total: 60 },
  { id: "game", unit: "hours", start: 18, total: 40 },
];

export async function PortadaScreen({ locale }: { locale: "es" | "en" }) {
  const [t, media, showcase] = await Promise.all([
    getTranslations({ locale, namespace: "portada" }),
    getLandingMedia(),
    getLandingShowcase(locale),
  ]);
  const scenes = buildLandingScenes(media);
  const pool: LandingMedia[] = [...scenes.feature, ...scenes.step];
  const base = `/${locale}`;
  const signup = `${base}/login?mode=register`;

  const works: StageWork[] = LIVE.flatMap(({ id, unit, start, total }) => {
    const item = pool.find((m) => m.format === id);
    if (!item) return [];
    return [
      {
        id,
        title: item.title,
        formatLabel: t(`formats.${id}.name`),
        unit: t.raw(`units.${unit}`) as string,
        start,
        total,
        image: item.image,
        depth: item.depth,
        aspect: item.width / item.height,
        width: item.width,
        height: item.height,
        color: RGB[id],
        seen: start / total,
      },
    ];
  });

  /** Portada real de cada formato: la muestra del catálogo, o la de la semana. */
  const coverOf = (format: Format): { src: string; title: string } | null => {
    const fromShowcase = showcase.find((s) => s.type === format);
    if (fromShowcase) return { src: fromShowcase.poster, title: fromShowcase.title };
    const fromPool = pool.find((m) => m.format === format);
    return fromPool ? { src: fromPool.image, title: fromPool.title } : null;
  };

  const demo = env.DEMO_USER_EMAIL ? t("hero.demo") : undefined;
  const other = locale === "es" ? "en" : "es";
  const attribution = await renderDataAttribution();

  return (
    <div data-ui="v2" className={`k2 k2-portada ${kulturaDisplay.variable}`}>
      <main id="main">
        <Stage
          works={works}
          labels={{ plusOne: t("hero.plusOne"), formats: t("hero.formatsLabel") }}
          nav={
            <header className="k2-nav">
              <a className="k2-nav__mark" href={base} aria-label="KULTURA">
                <Logo size={28} />
              </a>
              <a className="k2-nav__login" href={`${base}/login?mode=login`}>
                {t("nav.login")}
              </a>
            </header>
          }
          headline={
            <h1 className="k2-wall" aria-label={t("hero.title")}>
              <span aria-hidden="true">{t("hero.line1")}</span>
              <span aria-hidden="true">{t("hero.line2")}</span>
              <span aria-hidden="true">{t("hero.line3")}</span>
            </h1>
          }
          actions={
            <div className="k2-hero-actions">
              <p className="k2-hero-actions__lead">{t("hero.lead")}</p>
              <div className="k2-hero-actions__row">
                <a className="k2-btn" href={signup}>
                  {t("hero.cta")}
                </a>
                {demo ? (
                  // Formulario POST: cambia la sesión y un GET lo dispararía una precarga.
                  <form action="/api/auth/demo" method="post">
                    <input type="hidden" name="locale" value={locale} />
                    <button type="submit" className="k2-link">
                      {demo}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          }
        >
          <div className="k2-cap">
            <h2 className="k2-cap__title">{t("story.oneTitle")}</h2>
            <p className="k2-cap__text">{t("story.oneText")}</p>
          </div>
          <div className="k2-cap k2-cap--right">
            <h2 className="k2-cap__title">{t("story.twoTitle")}</h2>
            <p className="k2-cap__text">{t("story.twoText")}</p>
          </div>
          <div className="k2-cap">
            <h2 className="k2-cap__title">{t("story.threeTitle")}</h2>
            <p className="k2-cap__text">{t("story.threeText")}</p>
          </div>
        </Stage>

        <section className="k2-sheets" aria-labelledby="k2-formats-title">
          <h2 id="k2-formats-title" className="k2-sheets__title">
            {t("formatsTitle")}
          </h2>
          {FORMATS.map((format, i) => {
            const cover = coverOf(format);
            return (
              <article
                key={format}
                className="k2-sheet"
                style={{ "--i": i, "--sheet": formatVar(format) } as React.CSSProperties}
              >
                <h3 className="k2-sheet__name">{t(`formats.${format}.name`)}</h3>
                <p className="k2-sheet__line">{t(`formats.${format}.line`)}</p>
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="k2-sheet__cover"
                    src={cover.src}
                    alt={cover.title}
                    width={480}
                    height={720}
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </article>
            );
          })}
        </section>

        <section className="k2-statement">
          <h2 className="k2-statement__title">{t("spanish.title")}</h2>
          <p className="k2-statement__text">{t("spanish.text")}</p>
        </section>

        <section className="k2-import">
          <h2 className="k2-import__title">{t("import.title")}</h2>
          <ul className="k2-import__list">
            {["Letterboxd", "MyAnimeList", "Goodreads", "IMDb", "TV Time"].map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </section>

        <section className="k2-close">
          <h2 className="k2-close__title">{t("close.title")}</h2>
          <div className="k2-close__row">
            <p className="k2-close__text">{t("close.text")}</p>
            <a className="k2-btn k2-btn--ink" href={signup}>
              {t("hero.cta")}
            </a>
          </div>
        </section>
      </main>

      <footer className="k2-foot">
        <Blocks />
        <nav className="k2-foot__links" aria-label={t("footer.label")}>
          <a href={`${base}/privacy`}>{t("footer.privacy")}</a>
          <a href={`${base}/terms`}>{t("footer.terms")}</a>
          <a href={`${base}/legal`}>{t("footer.legal")}</a>
          <a href={`${base}/accessibility`}>{t("footer.accessibility")}</a>
          <a href={`/${other}`} hrefLang={other} lang={other}>
            {t("footer.otherLocale")}
          </a>
        </nav>
        <div className="k2-foot__credits">{attribution}</div>
      </footer>
    </div>
  );
}
