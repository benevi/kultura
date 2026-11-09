import { getTranslations } from "next-intl/server";
import { bricolagePortada } from "@/app/fonts";
import { renderDataAttribution } from "@/components/legal/DataAttribution";
import { Logo } from "@/components/layout/Logo";
import { coverSource } from "@/lib/landing/cover-source";
import { getPortadaShelf, SHELF_FORMATS, type ShelfFormat } from "@/lib/landing/shelf";
import { env } from "@/lib/env.server";
import { formatVar } from "../Blocks";
import { Shelf } from "./Shelf";
import "../tokens.css";
import "../skin.css";
import "./portada.css";

// ============================================================
// KULTURA v2 — Portada pública: una estantería con todo lo que ves, lees y juegas
//
// Ruta cacheable: sin cookies ni sesión. Solo `<a>` hacia las rutas con nonce
// (lo exige el grafo de imports de `tests/unit/csp/static-pages.test.ts`).
// Las portadas son dinámicas: ver `src/lib/landing/shelf.ts`.
// ============================================================

const UNIT_KEY: Partial<Record<ShelfFormat, string>> = {
  tv: "episode",
  anime: "episode",
  manga: "chapter",
  book: "page",
  comic: "issue",
  game: "hours",
};

const IMPORT_SOURCES = ["Letterboxd", "MyAnimeList", "Goodreads", "IMDb", "TV Time"];

export async function PortadaScreen({ locale }: { locale: "es" | "en" }) {
  const [t, shelf] = await Promise.all([getTranslations({ locale, namespace: "portada" }), getPortadaShelf(locale)]);
  const base = `/${locale}`;
  const signup = `${base}/login?mode=register`;
  const demo = env.DEMO_USER_EMAIL ? t("hero.demo") : undefined;
  const other = locale === "es" ? "en" : "es";
  const attribution = await renderDataAttribution();

  const formatNames = Object.fromEntries(SHELF_FORMATS.map((f) => [f, t(`formats.${f}.name`)])) as Record<ShelfFormat, string>;
  const units = Object.fromEntries(
    Object.entries(UNIT_KEY).map(([format, key]) => [format, t.raw(`units.${key}`) as string]),
  ) as Partial<Record<ShelfFormat, string>>;

  return (
    <div data-ui="v2" className={`k2 k2p ${bricolagePortada.variable}`}>
      <div className="k2p-frame">
        <header className="k2p-bar">
          <a className="k2p-bar__mark" href={base} aria-label="KULTURA">
            <Logo size={26} />
          </a>
          <a className="k2p-bar__login" href={`${base}/login?mode=login`}>
            {t("nav.login")}
          </a>
        </header>

        <main id="main">
          <Shelf
            fan={shelf.fan}
            start={shelf.start}
            rows={shelf.rows}
            labels={{
              shelf: t("hero.shelfLabel"),
              plusOne: t("hero.plusOne"),
              units,
              formats: formatNames,
              continueTitle: t("continue.title"),
              continueText: t("continue.text"),
            }}
            top={
              <div className="k2p-top">
                <h1 className="k2p-title">{t("hero.title")}</h1>
                <div className="k2p-top__side">
                  <p>{t("hero.lead")}</p>
                  <div className="k2p-actions">
                    <a className="k2-btn k2p-btn" href={signup}>
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
              </div>
            }
          />

          <section className="k2p-formats" aria-labelledby="k2p-formats-title">
            <h2 id="k2p-formats-title">{t("formatsTitle")}</h2>
            <ul>
              {SHELF_FORMATS.map((format) => (
                <li key={format} className="k2p-format" style={{ "--c": formatVar(format) } as React.CSSProperties}>
                  <h3>{formatNames[format]}</h3>
                  <p>{t(`formats.${format}.line`)}</p>
                  <div className="k2p-format__covers">
                    {(shelf.byFormat[format] ?? []).map((item) => {
                      const { src, srcSet } = coverSource(item.poster);
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={item.id} src={src} srcSet={srcSet} sizes={srcSet ? "64px" : undefined} alt={item.title} width={200} height={300} loading="lazy" decoding="async" />
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="k2p-home">
            <div>
              <h2>{t("spanish.title")}</h2>
              <p>{t("spanish.text")}</p>
            </div>
            <div>
              <h2>{t("import.title")}</h2>
              <ul>
                {IMPORT_SOURCES.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="k2p-close">
            <h2>{t("close.title")}</h2>
            <div className="k2p-close__row">
              <p>{t("close.text")}</p>
              <a className="k2-btn k2p-btn" href={signup}>
                {t("hero.cta")}
              </a>
            </div>
          </section>
        </main>

        <footer className="k2p-foot">
          <nav aria-label={t("footer.label")}>
            <a href={`${base}/privacy`}>{t("footer.privacy")}</a>
            <a href={`${base}/terms`}>{t("footer.terms")}</a>
            <a href={`${base}/legal`}>{t("footer.legal")}</a>
            <a href={`${base}/accessibility`}>{t("footer.accessibility")}</a>
            <a href={`/${other}`} hrefLang={other} lang={other}>
              {t("footer.otherLocale")}
            </a>
          </nav>
          <div className="k2p-foot__credits">{attribution}</div>
        </footer>
      </div>
    </div>
  );
}
