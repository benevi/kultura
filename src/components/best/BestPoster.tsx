import { getImgProps } from "next/dist/shared/lib/get-img-props";
import { imageConfigDefault, type ImageConfigComplete } from "next/dist/shared/lib/image-config";
import { preload } from "react-dom";
import { bestPosterLoader } from "@/lib/best/poster";

/**
 * Portada de un ranking (SEO-10, D-10). A diferencia de `PosterImage`
 * (decorativa en el catálogo), aquí la imagen lleva `alt` con el título:
 * Google Imágenes la asocia al título y el ranking no tiene ninguna imagen
 * con `alt=""`. Rellena su contenedor, que lleva DETRÁS el gradiente; el
 * contenedor va `aria-hidden` cuando el título ya está en texto al lado.
 *
 * Componente de servidor a propósito (REN-1): `getImgProps` genera el mismo
 * `<img>` (srcset, sizes, lazy, decoding) que `<Image fill>` sin enviar al
 * navegador el cliente de `next/image` (≈ 9 KB gzip del presupuesto de JS
 * inicial de /best). Se importa `getImgProps` de su ruta interna porque el
 * `getImageProps` público vive en el mismo módulo que el componente cliente y
 * arrastraría igualmente su chunk. Con `priority` se precarga igual que hacía
 * `<Image>`. Lo vigila tests/unit/best/poster-server.test.tsx.
 */
export function BestPoster({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  const { props } = getImgProps(
    { loader: bestPosterLoader, src, alt, fill: true, sizes, priority, className: "object-cover" },
    {
      // Next sustituye `process.env.__NEXT_IMAGE_OPTS` al compilar por la
      // configuración de `images` de next.config; sin él (tests) vale la de serie.
      imgConf: (process.env.__NEXT_IMAGE_OPTS as unknown as ImageConfigComplete | undefined) ?? imageConfigDefault,
      defaultLoader: bestPosterLoader,
    },
  );
  if (priority) {
    preload(props.src, {
      as: "image",
      imageSrcSet: props.srcSet,
      imageSizes: props.sizes,
      crossOrigin: props.crossOrigin,
      referrerPolicy: props.referrerPolicy,
      fetchPriority: props.fetchPriority,
    });
  }
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- props de getImgProps; `alt` va dentro
  return <img data-nimg="fill" {...props} />;
}
