// ============================================================
// KULTURA — Huecos de la portada que esperan a los datos (E-LANDING-SHOWCASE)
//
// Componentes ASÍNCRONOS: resuelven las portadas (rankings del año o la
// muestra del catálogo) y pintan su bloque. Van dentro de un `<Suspense>`
// cuyo fallback es EL MISMO bloque sin portadas (huecos vacíos), así que:
//   - el primer pintado no espera a ningún proveedor (titular, solapa y
//     botones son HTML de `AlbumHero`, fuera de todo Suspense);
//   - cuando los datos llegan (o no), el bloque se rellena solo;
//   - con la caché caliente (un día) el HTML ya sale con las portadas.
//
// Las dos páginas del álbum no repiten títulos: la derecha descarta los que
// ya están en la izquierda.
// ============================================================

import { BestPage, type BestPageProps } from "@/components/landing/BestPage";
import { FormatSections, type FormatSectionsProps } from "@/components/landing/FormatSections";
import { LandingCromo } from "@/components/landing/LandingCromo";
import { MissingPage, type MissingPageProps } from "@/components/landing/MissingPage";
import { RankingChecklist, type RankingChecklistProps } from "@/components/landing/RankingChecklist";
import { Ritual, type RitualProps } from "@/components/landing/Ritual";
import { BEST_FORMATS, getBestOf, type BestFormat, type BestItem } from "@/lib/best/best-of";
import { isFoil } from "@/lib/design/album";
import { pickBestPage, pickMissingPage, type AlbumCromo } from "@/lib/landing/album";
import { getLandingShowcase } from "@/lib/landing/showcase";

/** Rankings del año (los cuatro), cada uno a prueba de fallos. */
async function bestTops(year: number, locale: string): Promise<Record<BestFormat, BestItem[]>> {
  const entries = await Promise.all(
    BEST_FORMATS.map(async (f) => [f, await getBestOf(f, year, locale).catch(() => [] as BestItem[])] as const)
  );
  return Object.fromEntries(entries) as Record<BestFormat, BestItem[]>;
}

/** Página izquierda: cine, series y anime alternando (los juegos de RAWG no tienen carátula). */
async function bestPageItems(year: number, locale: string): Promise<AlbumCromo[]> {
  const tops = await bestTops(year, locale);
  return pickBestPage([tops.movie, tops.tv, tops.anime, tops.game]);
}

async function showcaseCromos(locale: string, exclude: string[] = []): Promise<AlbumCromo[]> {
  const showcase = await getLandingShowcase(locale);
  return pickMissingPage(showcase, exclude, showcase.length);
}

export async function BestPageSlot({
  locale,
  year,
  ...props
}: { locale: string; year: number } & Omit<BestPageProps, "items">) {
  return <BestPage {...props} items={await bestPageItems(year, locale)} />;
}

const MISSING_SIZES = "(min-width: 768px) 112px, 22vw";

export async function MissingPageSlot({
  locale,
  year,
  pendingLabel,
  ...props
}: { locale: string; year: number; pendingLabel: (n: number) => string } & Omit<
  MissingPageProps,
  "items" | "cromos" | "pending"
>) {
  const [left, all] = await Promise.all([bestPageItems(year, locale), getLandingShowcase(locale)]);
  const items = pickMissingPage(
    all,
    left.map((it) => it.id)
  );
  return (
    <MissingPage
      {...props}
      items={items.map((it) => ({ id: it.id, title: it.title, type: it.type, poster: it.poster, foil: isFoil(it.rating) }))}
      cromos={items.map((it) => (
        <LandingCromo key={it.id} title={it.title} seed={it.id} poster={it.poster} sizes={MISSING_SIZES} foil={isFoil(it.rating)} />
      ))}
      pending={items.map((_, i) => pendingLabel(props.startNumber + i))}
    />
  );
}

export async function RitualSlot({ locale, ...props }: Omit<RitualProps, "covers">) {
  return <Ritual {...props} locale={locale} covers={await showcaseCromos(locale)} />;
}

export async function FormatSectionsSlot({ locale, ...props }: { locale: string } & Omit<FormatSectionsProps, "covers">) {
  return <FormatSections {...props} covers={await showcaseCromos(locale)} />;
}

export async function RankingChecklistSlot(props: Omit<RankingChecklistProps, "tops">) {
  return <RankingChecklist {...props} tops={await bestTops(props.year, props.locale)} />;
}
