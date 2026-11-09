/** Tipos de la estantería, aparte para que el componente cliente no arrastre a los proveedores. */
export const SHELF_FORMATS = ["tv", "movie", "anime", "manga", "book", "comic", "game"] as const;
export type ShelfFormat = (typeof SHELF_FORMATS)[number];

export interface ShelfItem {
  id: string;
  format: ShelfFormat;
  title: string;
  poster: string;
}
