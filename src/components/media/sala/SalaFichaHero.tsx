import { SalaStage } from "@/components/sala/SalaStage";
import { SalaTitle } from "@/components/sala/SalaTitle";
import { SALA_TITLE_CSS } from "@/lib/design/sala-title-css";
import { SALA_WORK_CLASS } from "@/lib/design/sala-palette";
import { originalTitleOf } from "@/lib/media/original-title";
import { cn } from "@/lib/utils/index";
import type { MediaItem, MediaType } from "@/types/media";
import { SalaFichaAssets } from "./SalaFichaAssets";
import { SalaFichaImage } from "./SalaFichaImage";

/**
 * La sala de la ficha en 2D (fase 8.5, F1; biblia §1–§4). Va arriba del todo,
 * con el único `h1` de la página; debajo sigue la ficha de hoy.
 *
 * - **Película, serie, videojuego y anime** con imagen apaisada: la sala
 *   (`SalaStage`) con esa imagen a todo el ancho y el rótulo dentro.
 * - **Libro, manga y cómic**, o una obra sin imagen apaisada: la portada
 *   entera, a su proporción, centrada sobre un campo hecho con su paleta, y el
 *   rótulo debajo (nunca encima de la portada). Redimensionar la vertical para
 *   llenar la sala es de F4. Sin ninguna imagen, el campo de color con el
 *   título.
 *
 * La sala no cambia con el tema (biblia §4): lleva su propio `data-theme`.
 * Sin 3D y sin fundido (falta la máscara de la figura).
 */
const STAGE_TYPES: ReadonlySet<MediaType> = new Set(["movie", "tv", "game", "anime"]);

export type SalaFichaLayout = "stage" | "piece" | "empty";

/**
 * La imagen apaisada que ya tiene la obra. En los juegos, la de RAWG
 * (`background_image`) llega como `poster` y es apaisada.
 */
export function salaFichaWideImage(item: Pick<MediaItem, "type" | "backdrop" | "poster">): string | undefined {
  if (!STAGE_TYPES.has(item.type)) return undefined;
  return item.backdrop ?? (item.type === "game" ? item.poster : undefined);
}

export function salaFichaLayout(item: Pick<MediaItem, "type" | "backdrop" | "poster">): SalaFichaLayout {
  if (salaFichaWideImage(item)) return "stage";
  return item.poster ? "piece" : "empty";
}

/**
 * El `.woff2` latino de Anybody, el mismo archivo que pide `fonts.css` (Next
 * le da la misma URL con huella). Se precarga solo en la ficha con la sala
 * (TOKENS.md, «Precarga», decidido el 20-11-2026), con `font-display: swap`.
 * Va como `<link>` y no con `ReactDOM.preload`: React lo sube al `<head>`
 * del HTML; `preload()` desde aquí solo llegaba como pista del RSC, tarde.
 */
const ANYBODY_LATIN = new URL("../../../../assets/fonts/anybody/Anybody-latin-wdth-wght.woff2", import.meta.url);

export function SalaFichaHero({ item }: { item: MediaItem }) {
  const layout = salaFichaLayout(item);
  const original = originalTitleOf(item);
  // Con idioma, el original va marcado (y con su fuente); sin él, se enseña igual, sin marcar.
  const marked = original?.lang ? { text: original.text, lang: original.lang } : null;
  const unmarked =
    original && !original.lang ? <p className={cn(SALA_TITLE_CSS.original, "mt-0")}>{original.text}</p> : null;

  return (
    <section data-sala-ficha={layout} className={cn(SALA_WORK_CLASS, "font-sala-text")} aria-labelledby="sala-ficha-title">
      <link rel="preload" href={ANYBODY_LATIN.pathname} as="font" type="font/woff2" crossOrigin="anonymous" />
      <SalaFichaAssets />
      {layout === "stage" ? (
        <SalaStage
          title={item.title}
          original={marked}
          headingLevel={1}
          headingId="sala-ficha-title"
          className="w-full aspect-[4/5] sm:aspect-[16/9] lg:aspect-[2/1]"
          image={<SalaFichaImage src={salaFichaWideImage(item)!} sizes="100vw" />}
        >
          {unmarked}
        </SalaStage>
      ) : (
        <div data-theme="dark" className="bg-sala-band text-sala-band-ink px-sala-margin pt-8 pb-sala-margin">
          {layout === "piece" ? (
            <div className="relative mx-auto aspect-[2/3] w-[min(100%,20rem)] sm:w-[22rem]">
              <SalaFichaImage src={item.poster!} sizes="(max-width: 640px) 90vw, 352px" fit="contain" />
            </div>
          ) : null}
          <SalaTitle
            title={item.title}
            original={marked}
            headingLevel={1}
            headingId="sala-ficha-title"
            className={layout === "piece" ? "mt-8" : "pt-[20vh]"}
          />
          {unmarked}
        </div>
      )}
    </section>
  );
}
