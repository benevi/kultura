// ============================================================
// KULTURA — Ranking público: podio (1-3) y lista compacta (4-20) (DIS-10)
// Server Components sin JS de cliente salvo la portada (`next/image`).
//
// Cada título enlaza a su ficha pública (PRO-8, CRE-11) con un enlace
// "estirado" que cubre la card entera (una sola parada de teclado y un solo
// nombre accesible, el título), y tiene su "Guardar" aparte: alta con vuelta
// a la ficha. Primitivos de DISENO.md: card `rounded-20` sobre
// `--surface-default`, portada `rounded-card` con el gradiente DETRÁS,
// pegatina lima colgante para el #1, números en display.
//
// Las portadas llevan `alt` con el título (SEO-10: Google Imágenes) pero su
// caja va `aria-hidden`: el título ya se lee en el enlace y repetirlo en cada
// card estorba al lector de pantalla.
// ============================================================

import { getTranslations } from "next-intl/server";
import { BestPoster } from "@/components/best/BestPoster";
import { posterGradient } from "@/lib/images/poster-gradient";
import { bestItemPath, type BestItem } from "@/lib/best/best-of";
import { localeHref, saveHref } from "@/lib/best/links";

/** Enlace que cubre su card (`relative`) y pinta el foco alrededor de ella. */
const STRETCHED_LINK =
  "after:absolute after:inset-0 after:rounded-20 hover:text-accent-pink transition-colors " +
  "focus-visible:outline-none focus-visible:after:[outline-style:solid] focus-visible:after:outline-2 " +
  "focus-visible:after:outline-offset-2 focus-visible:after:outline-focus-ring";

const SAVE_LINK =
  "relative z-10 inline-flex min-h-11 items-center self-start rounded-full border-2 border-stroke px-4 " +
  "text-[13px] font-bold text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors " +
  "focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

function formatRating(rating: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating);
}

type T = Awaited<ReturnType<typeof getTranslations>>;

function Meta({ item, locale, t }: { item: BestItem; locale: string; t: T }) {
  const rating = item.rating ? formatRating(item.rating, locale) : null;
  const parts: React.ReactNode[] = [];
  if (item.year) parts.push(<span key="y">{item.year}</span>);
  if (rating) {
    parts.push(
      <span key="r">
        <span aria-hidden="true">★ {rating}</span>
        <span className="sr-only">{t("rating", { rating })}</span>
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return (
    <p className="text-[13px] font-bold text-text-secondary">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 ? <span aria-hidden="true"> · </span> : null}
          {p}
        </span>
      ))}
    </p>
  );
}

function SaveLink({ item, locale, t }: { item: BestItem; locale: string; t: T }) {
  return (
    <a href={saveHref(locale, item)} rel="nofollow" className={SAVE_LINK}>
      {t.rich("save", {
        title: item.title,
        hidden: (chunks) => <span className="sr-only">{chunks}</span>,
      })}
    </a>
  );
}

function Genres({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {genres.map((g) => (
        <li key={g} className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-[12px] font-bold text-text-primary">
          {g}
        </li>
      ))}
    </ul>
  );
}

/**
 * Puestos 1-3: pósteres grandes con el número en display (96 px en
 * escritorio). En móvil el #1 ocupa la fila entera (póster a la izquierda)
 * y el #2 y el #3 van a dos columnas: tres columnas no caben a 320 px.
 */
export async function BestPodium({ items, locale }: { items: BestItem[]; locale: string }) {
  if (items.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "best" });
  return (
    <ol aria-label={t("podium")} className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
      {items.slice(0, 3).map((item, i) => {
        const first = i === 0;
        return (
          <li
            key={item.id}
            className={
              "relative flex gap-3 rounded-20 bg-surface-default p-3 md:flex-col md:p-4 " +
              (first ? "col-span-2 flex-row md:col-span-1" : "flex-col")
            }
          >
            {first ? (
              <span
                aria-hidden="true"
                className="absolute -left-2 -top-3 z-10 rotate-[-8deg] rounded-full bg-accent-lime px-3 py-1 text-sm font-extrabold text-on-accent-lime shadow-[4px_4px_0_rgba(0,0,0,.4)] md:-left-3.5 md:-top-3.5"
              >
                {t("sticker")}
              </span>
            ) : null}
            <div
              aria-hidden="true"
              className={
                "relative aspect-[2/3] shrink-0 overflow-hidden rounded-card md:w-full " + (first ? "w-2/5" : "w-full")
              }
              style={{ background: posterGradient(item.id) }}
            >
              <BestPoster
                src={item.poster}
                alt={item.title}
                sizes={first ? "(min-width: 896px) 260px, (min-width: 768px) 30vw, 40vw" : "(min-width: 896px) 260px, (min-width: 768px) 30vw, 50vw"}
                priority
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 md:gap-3">
              <span aria-hidden="true" className="font-display text-[56px] font-extrabold leading-none text-accent-pink md:text-[96px]">
                {i + 1}
              </span>
              <h2 className="font-display text-base font-extrabold leading-tight text-text-primary md:text-xl">
                <a href={localeHref(locale, bestItemPath(item))} className={STRETCHED_LINK}>
                  <span className="sr-only">{t("position", { n: i + 1 })}</span>{" "}
                  {item.title}
                </a>
              </h2>
              <Meta item={item} locale={locale} t={t} />
              <div className={(first ? "flex" : "hidden md:flex") + " flex-col gap-2 md:gap-3"}>
                <Genres genres={item.genres} />
                {item.synopsis ? (
                  <p className="text-[13px] text-text-secondary line-clamp-3 md:text-[14px] md:line-clamp-4">{item.synopsis}</p>
                ) : null}
              </div>
              <div className="mt-auto pt-1">
                <SaveLink item={item} locale={locale} t={t} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Puestos 4 en adelante: lista compacta con miniatura y sinopsis corta. */
export async function BestRankList({ items, locale }: { items: BestItem[]; locale: string }) {
  const rest = items.slice(3);
  if (rest.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "best" });
  return (
    <ol start={4} aria-label={t("rest", { last: items.length })} className="flex flex-col gap-3">
      {rest.map((item, i) => {
        const n = i + 4;
        return (
          <li key={item.id} className="relative flex items-start gap-3 rounded-20 bg-surface-default p-3 md:gap-5 md:p-4">
            <span
              aria-hidden="true"
              className="w-7 shrink-0 pt-1 text-right font-display text-xl font-extrabold leading-none text-text-tertiary md:w-12 md:text-[32px]"
            >
              {n}
            </span>
            <div
              aria-hidden="true"
              className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-card md:w-20"
              style={{ background: posterGradient(item.id) }}
            >
              <BestPoster src={item.poster} alt={item.title} sizes="(min-width: 768px) 80px, 64px" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h2 className="font-display text-base font-extrabold leading-tight text-text-primary md:text-lg">
                <a href={localeHref(locale, bestItemPath(item))} className={STRETCHED_LINK}>
                  <span className="sr-only">{t("position", { n })}</span>{" "}
                  {item.title}
                </a>
              </h2>
              <Meta item={item} locale={locale} t={t} />
              {item.synopsis ? (
                <p className="text-[13px] text-text-secondary line-clamp-2 md:text-[14px]">{item.synopsis}</p>
              ) : null}
              <SaveLink item={item} locale={locale} t={t} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
