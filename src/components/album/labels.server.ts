import "server-only";
import { getTranslations } from "next-intl/server";
import { albumLabels, type AlbumLabels } from "./labels";

/** Textos del álbum en un componente de servidor asíncrono. */
export async function getAlbumLabels(locale?: string): Promise<AlbumLabels> {
  const t = locale ? await getTranslations({ locale, namespace: "album" }) : await getTranslations("album");
  return albumLabels(t as unknown as Parameters<typeof albumLabels>[0]);
}
