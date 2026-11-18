// Prototipo fase 8.3 — contrato de datos entre la base y las direcciones.

import type { MediaItem, MediaType, StreamingProvider } from "@/types/media";
import type { SteamInfo } from "@/lib/api/steam";
import type { SourceLink } from "@/lib/media/source-link";
import type { Labels } from "./labels";

export type DirId = "a" | "b" | "c";

export interface Fact {
  key: string;
  label: string;
  value: string;
}

export interface Rating {
  key: string;
  /** Marca que da la nota (no se traduce). */
  label: string;
  /** «8,5/10». La escala va siempre en el texto. */
  value: string;
}

export interface CoverSource {
  /** URL original del proveedor (sin transformar). */
  original: string;
  /** `src` y `srcSet` listos para un `<img>` (mismo cargador que la app). */
  src: string;
  srcSet: string;
  /** Miniatura (≈ 200 px) para capas borrosas o de ambiente. */
  small: string;
  /**
   * El `<img>` puede llevar `crossOrigin="anonymous"`: el host manda CORS o
   * va por el optimizador (mismo origen). Con `false` (Google Books), el color
   * se lee de una miniatura pedida al optimizador.
   */
  canvasSafe: boolean;
  /** Miniatura legible por canvas (directa con CORS o por el optimizador). */
  sample: string;
  /** Pista de forma antes de cargar: los juegos de RAWG llegan apaisados. */
  shape: "portrait" | "landscape";
}

export interface FichaData {
  locale: string;
  item: MediaItem;
  type: MediaType;
  /** «Película», «Libro»… en el idioma de la página. */
  typeLabel: string;
  title: string;
  /** Solo si es distinto del título. */
  originalTitle?: string;
  /** `lang` del título original cuando su escritura lo delata (ko, ja, zh…). */
  originalTitleLang?: string;
  year?: number;
  genres: string[];
  /** Año, formato, duración/episodios/páginas… (datos cortos). */
  facts: Fact[];
  /** Dirección, reparto, autoría, plataformas… */
  credits: Fact[];
  ratings: Rating[];
  synopsis?: string;
  synopsisLang?: string;
  cover: CoverSource | null;
  trailerKey?: string;
  providers: StreamingProvider[];
  watchLink?: string;
  steam: SteamInfo | null;
  source: SourceLink | null;
  labels: Labels;
}

/** Props de `Ficha` de cada dirección (Server Component). */
export interface DirectionProps {
  data: FichaData;
}
