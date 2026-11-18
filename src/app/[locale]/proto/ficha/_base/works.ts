// Prototipo fase 8.3 — obras fijas de prueba. Elegidas por su portada (oscura,
// clara, saturada, apaisada) y por su título original (hangul, kana).

import type { MediaType } from "@/types/media";
import type { DirId } from "./types";

export interface ProtoWork {
  /** Nombre corto para capturas y selector. */
  slug: string;
  type: MediaType;
  id: string;
  name: string;
  /** Qué pone a prueba. */
  note: string;
}

export const WORKS: ProtoWork[] = [
  { slug: "parasitos", type: "movie", id: "496243", name: "Parásitos", note: "Película · título original en hangul (기생충) · TMDB" },
  { slug: "libro", type: "book", id: "OL20150260W", name: "Gente normal", note: "Libro · portada clara · Open Library + Google Books" },
  { slug: "hades", type: "game", id: "274755", name: "Hades", note: "Videojuego · imagen apaisada y saturada · RAWG + Steam" },
  { slug: "berserk", type: "manga", id: "801513ba-a712-498c-8f57-cae55b38cc92", name: "Berserk", note: "Manga · portada oscura por el optimizador · MangaDex" },
  { slug: "chihiro", type: "anime", id: "al-199", name: "El viaje de Chihiro", note: "Anime · título original japonés (千と千尋の神隠し) · AniList" },
];

export const DIRS: { id: DirId; name: string }[] = [
  { id: "a", name: "Sala" },
  { id: "b", name: "Objeto" },
  { id: "c", name: "Pliego" },
];

export const isDir = (v: string): v is DirId => v === "a" || v === "b" || v === "c";

export const fichaPath = (locale: string, dir: DirId, w: { type: string; id: string }) =>
  `/${locale}/proto/ficha/${dir}/${w.type}/${w.id}`;
