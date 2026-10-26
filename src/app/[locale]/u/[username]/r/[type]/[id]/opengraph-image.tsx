import { CARD_SIZE, renderRatedCard, type CardParams } from "../../_lib/rated-card";

/**
 * Tarjeta GENÉRICA de `/u/{usuario}/r/{tipo}/{id}` (CRE-8a): título y perfil,
 * sin nota salvo `SHARE_PUBLIC_LIBRARY=1` con biblioteca pública. La firmada
 * vive aparte, en `card/[sig]` (ver `_lib/rated-card.tsx`): este archivo de
 * metadatos nunca lleva la firma. Sin `generateImageMetadata`, así la ruta es
 * `/opengraph-image` (la que espera `ogImagePath`).
 */
export const alt = "KULTURA";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: CardParams | Promise<CardParams> }) {
  return renderRatedCard(await params);
}
