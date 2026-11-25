import { getImgProps } from "next/dist/shared/lib/get-img-props";
import { imageConfigDefault, type ImageConfigComplete } from "next/dist/shared/lib/image-config";
import { posterLoader } from "@/lib/images/poster-url";

/**
 * Captura de Steam en la ficha de juego (`SteamSection` y `SalaSteam`).
 *
 * Sigue pasando por el optimizador de Vercel (decisión de la fase 8: Steam,
 * MangaDex y ComicVine no se cargan directos), pero con `posterLoader`, que
 * redondea el ancho a `OPTIMIZER_WIDTHS`. Con el loader de serie cada pantalla
 * pedía su ancho del `srcset` (hasta 16) y cada uno era una transformación del
 * cupo de Hobby; la captura mide 600 px, así que por encima de eso el
 * optimizador devolvía la misma imagen.
 *
 * Como `BestPoster`, genera con `getImgProps` el mismo `<img>` que
 * `<Image fill>` (srcset, sizes, lazy, decoding): así sirve en componentes de
 * servidor, a los que no se les puede pasar un `loader` hacia `next/image`.
 */
export function SteamShot({ src, sizes, className }: { src: string; sizes: string; className?: string }) {
  const { props } = getImgProps(
    { loader: posterLoader, src, alt: "", fill: true, sizes, className },
    {
      // Next sustituye `process.env.__NEXT_IMAGE_OPTS` al compilar por la
      // configuración de `images` de next.config; sin él (tests) vale la de serie.
      imgConf: (process.env.__NEXT_IMAGE_OPTS as unknown as ImageConfigComplete | undefined) ?? imageConfigDefault,
      defaultLoader: posterLoader,
    },
  );
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- props de getImgProps; `alt=""` va dentro
  return <img data-nimg="fill" {...props} />;
}
