import { useTranslations } from "next-intl";
import type { MediaStatus, MediaType } from "@/types/media";

/** Traductor del namespace `album` (de `useTranslations` o `getTranslations`). */
type AlbumT = (key: string, values?: Record<string, string | number | Date>) => string;

/** Textos del álbum ya traducidos, para pasar como props a los componentes. */
export interface AlbumLabels {
  /** «Película», «Serie»… (`FormatTag`, pestaña del `Slot`). */
  format: (type: MediaType) => string;
  /** «Pendiente», «En curso»… (`StatusBand`, `stateLabel` del `Cromo`). */
  status: (status: MediaStatus) => string;
  /** «Hueco 12». */
  slot: (number: number) => string;
  /** «Hueco 12, te falta:» (texto para el lector antes del título). */
  slotPending: (number: number) => string;
  /** «Nota 8,5» (nombre para el lector de la nota). */
  rating: (score: number) => string;
  /** «8,5» (la nota a la vista, con el formato del idioma). */
  score: (score: number) => string;
  /** «Brillante: 10 de 10». */
  foil: () => string;
  /** «Abandonado, puedes retomarlo». */
  folded: () => string;
  /** «4 de 10». */
  progress: (current: number, total: number) => string;
  /** «40 % hecho» (`percent` ya formateado, p. ej. con `Intl`). */
  progressPercent: (percent: string) => string;
  /** «Te faltan 3 títulos». */
  missing: (count: number) => string;
  /** «Página 2». */
  page: (number: number) => string;
}

export function albumLabels(t: AlbumT): AlbumLabels {
  return {
    format: (type) => t(`format.${type}`),
    status: (status) => t(`status.${status}`),
    slot: (number) => t("slot", { number }),
    slotPending: (number) => t("slotPending", { number }),
    rating: (score) => t("rating", { score }),
    score: (score) => t("score", { score }),
    foil: () => t("foil"),
    folded: () => t("folded"),
    progress: (current, total) => t("progress", { current, total }),
    progressPercent: (percent) => t("progressPercent", { percent }),
    missing: (count) => t("missing", { count }),
    page: (number) => t("page", { number }),
  };
}

/**
 * Textos del álbum en un componente (de servidor síncrono o de cliente).
 * En cliente, el namespace `album` ya viaja en la app, en `/welcome` y en
 * `/u` (`src/i18n/client-messages.ts`); en otra zona hay que añadirlo a su lista.
 */
export function useAlbumLabels(): AlbumLabels {
  const t = useTranslations("album");
  return albumLabels(t as unknown as AlbumT);
}
