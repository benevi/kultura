// ============================================================
// KULTURA — Ranking público: la página de control del álbum (DIS-10)
// Podio (1-3) = tres brillantes: el cromo con su portada real, el brillo y el
// número del puesto en su caja amarilla (Lilita One). Del 4 en adelante,
// cromos pegados y numerados, en dos columnas con el lomo en escritorio.
//
// Cada título enlaza a su ficha pública (PRO-8, CRE-11) con un enlace
// «estirado» que cubre el puesto entero (una parada de teclado, nombre
// «Puesto N: título»); la esquina del cromo se levanta con el ratón y con
// el foco de teclado.
// «Guardar» va aparte: `<a data-best-save>` a la ficha, que `BestSaveEnhancer`
// convierte en alta + vuelta a guardarlo (sin cuenta) o en guardado directo.
//
// Las portadas llevan `alt` con el título (SEO-10: Google Imágenes) pero su
// caja va `aria-hidden`: el título ya se lee en el enlace.
// ============================================================

import { getTranslations } from "next-intl/server";
import { Cromo } from "@/components/album/Cromo";
import { Foil } from "@/components/album/Foil";
import { FormatTag } from "@/components/album/FormatTag";
import { NumberBadge } from "@/components/album/NumberBadge";
import { getAlbumLabels } from "@/components/album/labels.server";
import { KButton } from "@/components/ui/KButton";
import { BestPoster } from "@/components/best/BestPoster";
import { PasteOnEnter } from "@/components/best/PasteOnEnter";
import { PodiumTilt } from "@/components/best/PodiumTilt";
import { formatScore } from "@/lib/design/format";
import { bestItemPath, type BestItem } from "@/lib/best/best-of";
import { localeHref, saveHref } from "@/lib/best/links";

type T = Awaited<ReturnType<typeof getTranslations>>;
type Labels = Awaited<ReturnType<typeof getAlbumLabels>>;

/**
 * Enlace «estirado»: cubre su fila o su puesto del podio (`relative`) y pinta
 * el foco alrededor (una sola parada de teclado, con el título como nombre).
 */
const STRETCHED_LINK =
  "after:absolute after:inset-0 after:z-[4] after:rounded-cromo " +
  "focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 " +
  "focus-visible:after:outline-offset-4 focus-visible:after:outline-focus-ring";

/**
 * La esquina del cromo se levanta también al enfocar con teclado el enlace
 * de su puesto (el `.group:hover` de `.cromo` solo cubre el ratón).
 */
const KEYBOARD_LIFT =
  "group-has-[a:focus-visible]:[transform:perspective(800px)_rotate3d(1,-1,0,4deg)] group-has-[a:focus-visible]:shadow-lift";

/** Año · formato · nota, con la nota en el formato del idioma (8,5). */
function Meta({ item, locale, t, labels, className = "" }: { item: BestItem; locale: string; t: T; labels: Labels; className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary ${className}`}>
      {item.year ? <span className="tabular-nums">{item.year}</span> : null}
      <FormatTag format={item.type} label={labels.format(item.type)} className="text-sm" />
      {item.rating ? (
        <span className="font-bold tabular-nums text-text-primary">
          {t("score", { rating: formatScore(item.rating, locale) })}
        </span>
      ) : null}
    </p>
  );
}

function SaveLink({ item, locale, t }: { item: BestItem; locale: string; t: T }) {
  return (
    <KButton variant="secondary" size="sm" className="relative z-[5] shrink-0" asChild>
      <a href={saveHref(locale, item)} data-best-save={item.id} rel="nofollow">
        {t.rich("save", {
          title: item.title,
          hidden: (chunks) => <span className="sr-only">{chunks}</span>,
        })}
      </a>
    </KButton>
  );
}

/**
 * Jerarquía del podio: en escritorio tres columnas 6/5/4 que bajan en
 * escalera (el #1 la más ancha y alta); en el móvil el #1 ocupa la fila con
 * su portada a la izquierda y el #2 y el #3 van a dos columnas (tres no
 * caben a 320 px). El orden del documento sigue siendo 1-2-3.
 */
const PODIUM = [
  {
    li: "col-span-2 grid grid-cols-2 items-start gap-4 md:col-span-1 md:flex md:flex-col md:gap-3",
    badge: "h-20 min-w-20 px-3 md:h-24 md:min-w-24 md:px-4",
    title: "text-xl md:text-2xl",
    sizes: "(min-width: 1152px) 420px, (min-width: 768px) 36vw, 50vw",
  },
  {
    li: "flex flex-col gap-3 md:mt-16",
    badge: "h-14 min-w-14 px-3 text-4xl md:h-24 md:min-w-24 md:px-4 md:text-7xl",
    title: "text-base",
    sizes: "(min-width: 1152px) 350px, (min-width: 768px) 30vw, 50vw",
  },
  {
    li: "flex flex-col gap-3 md:mt-32",
    badge: "h-14 min-w-14 px-3 text-4xl md:h-24 md:min-w-24 md:px-4 md:text-7xl",
    title: "text-base",
    sizes: "(min-width: 1152px) 280px, (min-width: 768px) 24vw, 50vw",
  },
] as const;

/** Puestos 1-3: los brillantes. */
export async function BestPodium({ items, locale }: { items: BestItem[]; locale: string }) {
  if (items.length === 0) return null;
  const [t, labels] = await Promise.all([getTranslations({ locale, namespace: "best" }), getAlbumLabels(locale)]);
  return (
    <PodiumTilt>
      <ol
        data-podium=""
        aria-label={t("podium")}
        className="relative grid grid-cols-2 items-start gap-x-4 gap-y-6 md:grid-cols-[6fr_5fr_4fr] md:gap-x-8"
      >
        {items.slice(0, 3).map((item, i) => {
          const n = i + 1;
          const look = PODIUM[i];
          return (
            <li key={item.id} className={`group relative ${look.li}`}>
              <span aria-hidden="true" data-podium-cromo="" data-rank={n} className="block">
                <Foil className="relative">
                  <Cromo title={item.title} seed={item.id} sizes={look.sizes} className={KEYBOARD_LIFT}>
                    <BestPoster src={item.poster} alt={item.title} sizes={look.sizes} first={n === 1} eager />
                  </Cromo>
                  <NumberBadge n={n} tone="yellow" size="xl" className={`absolute left-2 top-2 z-[3] ${look.badge}`} />
                </Foil>
              </span>
              <div className="flex min-w-0 flex-col items-start gap-2 md:gap-3">
                <h2 className={`text-balance font-body font-bold leading-tight text-text-primary ${look.title}`}>
                  <a href={localeHref(locale, bestItemPath(item))} className={`${STRETCHED_LINK} group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4`}>
                    <span className="sr-only">{t("position", { n })}</span> {item.title}
                  </a>
                </h2>
                <Meta item={item} locale={locale} t={t} labels={labels} />
                {n === 1 && item.synopsis ? (
                  <p className="hidden max-w-prose text-sm text-text-secondary line-clamp-3 md:block">{item.synopsis}</p>
                ) : null}
                <SaveLink item={item} locale={locale} t={t} />
              </div>
            </li>
          );
        })}
      </ol>
    </PodiumTilt>
  );
}

/**
 * Puestos 4 en adelante: cromos pegados y numerados, como la página de
 * control del final del álbum. Dos columnas con el lomo (raya de 2 px) en
 * escritorio, una en el móvil; se pegan una vez al entrar en pantalla.
 */
export async function BestRankList({ items, locale }: { items: BestItem[]; locale: string }) {
  const rest = items.slice(3);
  if (rest.length === 0) return null;
  const [t, labels] = await Promise.all([getTranslations({ locale, namespace: "best" }), getAlbumLabels(locale)]);
  return (
    <PasteOnEnter>
      <ol
        start={4}
        aria-label={t("rest", { last: items.length })}
        className="md:columns-2 md:gap-16 md:[column-rule:2px_solid_var(--surface-border)]"
      >
        {rest.map((item, i) => {
          const n = i + 4;
          return (
            <li key={item.id} className="group relative flex break-inside-avoid items-center gap-3 border-b-2 border-surface-border py-3 md:gap-4">
              <NumberBadge n={n} tone="navy" size="md" className="tabular-nums" />
              <span aria-hidden="true" className="block w-16 shrink-0 md:w-20">
                <Cromo title={item.title} seed={item.id} sizes="(min-width: 768px) 80px, 64px" className={KEYBOARD_LIFT}>
                  <BestPoster src={item.poster} alt={item.title} sizes="(min-width: 768px) 80px, 64px" />
                </Cromo>
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 className="text-balance text-base font-semibold leading-snug text-text-primary line-clamp-2">
                  <a href={localeHref(locale, bestItemPath(item))} className={`${STRETCHED_LINK} group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4`}>
                    <span className="sr-only">{t("position", { n })}</span> {item.title}
                  </a>
                </h2>
                <Meta item={item} locale={locale} t={t} labels={labels} />
              </div>
              <SaveLink item={item} locale={locale} t={t} />
            </li>
          );
        })}
      </ol>
    </PasteOnEnter>
  );
}
