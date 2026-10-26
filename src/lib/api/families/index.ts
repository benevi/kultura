// KULTURA — Registro de adaptadores de catálogo por familia (COD-10).

import type { MediaType } from "@/types/media";
import { animeFamily } from "./anime";
import { bookFamily } from "./book";
import { comicFamily } from "./comic";
import { gameFamily } from "./game";
import { mangaFamily } from "./manga";
import { movieFamily } from "./movie";
import { tvFamily } from "./tv";
import type { FamilyAdapter } from "./types";

export type { DiscoverFilters, FamilyAdapter, FamilyPage } from "./types";

export const FAMILY_ADAPTERS: Record<MediaType, FamilyAdapter> = {
  movie: movieFamily,
  tv: tvFamily,
  anime: animeFamily,
  manga: mangaFamily,
  book: bookFamily,
  comic: comicFamily,
  game: gameFamily,
};

/** Adaptador de una familia; un `type` desconocido cae a cine. */
export function familyAdapter(type: string): FamilyAdapter {
  return Object.prototype.hasOwnProperty.call(FAMILY_ADAPTERS, type)
    ? FAMILY_ADAPTERS[type as MediaType]
    : movieFamily;
}

