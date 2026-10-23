// ============================================================
// KULTURA — Ranking público: podio (1-3) y lista compacta (4-20) (DIS-10)
// Server Components sin JS de cliente salvo la portada (`next/image`).
//
// Cada título enlaza a su ficha pública (PRO-8, CRE-11) con un enlace
// "estirado" que cubre la card entera (una sola parada de teclado y un solo
// nombre accesible, el título), y tiene su "Guardar" aparte, que lleva a la
// misma ficha: allí está el botón de añadir (o el alta, sin cuenta). Primitivos de DISENO.md: card `rounded-20` sobre
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
    <a href={saveHref(locale, item)} className={SAVE_LINK}>
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
 * Fondo "card feature" (DISENO.md) del #1, solo desde `md`: radial pink al
 * 55 % en la esquina superior izquierda, que allí queda detrás del póster.
 * En móvil (fila con el número arriba a la derecha) teñiría el número pink.
 */
const FEATURE_BG =
  "md:bg-[radial-gradient(120%_100%_at_20%_10%,color-mix(in_oklch,var(--accent-pink)_55%,transparent),transparent_55%)]";

/**
 * Jerarquía del podio desde `md` (DIS-10): el #1 es la columna más ancha, con
 * el número en display de 96 px y el fondo de "card feature" de DISENO.md
 * (radial pink en la esquina superior izquierda); el #2 y el #3 son más
 * estrechos, con números menores, y bajan en escalera. El orden visual sigue
 * siendo 1-2-3 de izquierda a derecha, el mismo que el del documento.
 */
const PODIUM = [
  {
    li: `col-span-2 flex-row md:col-span-1 md:flex-col ${FEATURE_BG}`,
    number: "text-[56px] md:text-[96px]",
    title: "text-lg md:text-2xl",
    sizes: "(min-width: 896px) 300px, (min-width: 768px) 36vw, 40vw",
    poster: "w-2/5 md:w-full",
    extra: "flex",
  },
  {
    li: "flex-col md:mt-12",
    number: "text-[48px] md:text-[72px]",
    title: "text-base md:text-lg",
    sizes: "(min-width: 896px) 250px, (min-width: 768px) 30vw, 50vw",
    poster: "w-full",
    extra: "hidden md:flex",
  },
  {
    li: "flex-col md:mt-24",
    number: "text-[48px] md:text-[60px]",
    title: "text-base md:text-lg",
    sizes: "(min-width: 896px) 210px, (min-width: 768px) 26vw, 50vw",
    poster: "w-full",
    extra: "hidden md:flex",
  },
] as const;

/**
 * Puestos 1-3: pósteres grandes con el número en display. En móvil el #1
 * ocupa la fila entera (póster a la izquierda) y el #2 y el #3 van a dos
 * columnas: tres columnas no caben a 320 px.
 */
export async function BestPodium({ items, locale }: { items: BestItem[]; locale: string }) {
  if (items.length === 0) return null;
  const t = await getTranslations({ locale, namespace: "best" });
  return (
    <ol
      aria-label={t("podium")}
      className="grid grid-cols-2 items-start gap-3 md:grid-cols-[6fr_5fr_4fr] md:gap-5"
    >
      {items.slice(0, 3).map((item, i) => {
        const first = i === 0;
        const look = PODIUM[i];
        return (
          <li
            key={item.id}
            className={`relative flex gap-3 rounded-20 bg-surface-default p-3 md:p-4 ${look.li}`}
          >
            {first ? (
              <span
                aria-hidden="true"
                className="absolute -left-2 -top-3 z-10 rotate-[-8deg] rounded-full bg-accent-lime px-3 py-1 text-sm font-extrabold text-on-accent-lime shadow-[4px_4px_0_rgba(0,0,0,.4)] md:-left-3.5 md:-top-3.5 md:text-base"
              >
                {t("sticker")}
              </span>
            ) : null}
            <div
              aria-hidden="true"
              className={`relative aspect-[2/3] shrink-0 overflow-hidden rounded-card ${look.poster}`}
              style={{ background: posterGradient(item.id) }}
            >
              <BestPoster src={item.poster} alt={item.title} sizes={look.sizes} priority />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 md:gap-3">
              <span aria-hidden="true" className={`font-display font-extrabold leading-none text-accent-pink ${look.number}`}>
                {i + 1}
              </span>
              <h2 className={`font-display font-extrabold leading-tight text-text-primary ${look.title}`}>
                <a href={localeHref(locale, bestItemPath(item))} className={STRETCHED_LINK}>
                  <span className="sr-only">{t("position", { n: i + 1 })}</span>{" "}
                  {item.title}
                </a>
              </h2>
              <Meta item={item} locale={locale} t={t} />
              <div className={`${look.extra} flex-col gap-2 md:gap-3`}>
                <Genres genres={item.genres} />
                {item.synopsis ? (
                  <p
                    className={`text-[13px] text-text-secondary md:text-[14px] ${first ? "line-clamp-3 md:line-clamp-5" : "line-clamp-3"}`}
                  >
                    {item.synopsis}
                  </p>
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
