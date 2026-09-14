// ============================================================
// KULTURA — Sinopsis en el idioma activo (E-SINOPSIS-I18N)
//
// Server Component async: pide la traducción y pinta la misma
// `SynopsisSection` de siempre. Va envuelto en <Suspense> desde `MediaDetail`
// con el texto ORIGINAL como fallback, así que la ficha se ve entera al
// instante y la sinopsis se sustituye cuando la traducción llega. Bloquear el
// render habría metido segundos de espera la primera vez que alguien abre un
// título, que es justo lo que no queremos a cambio de traducir.
//
// A partir de la segunda visita (de cualquier usuario) la traducción está en
// caché y esto resuelve en una lectura, sin fallback visible.
// ============================================================

import { getLocale } from "next-intl/server";
import { SynopsisSection } from "./SynopsisSection";
import { translateSynopsis } from "@/lib/translate/synopsis";

interface Props {
  /** Sinopsis tal cual la sirve el proveedor. */
  text: string;
  /** Id prefijado del ítem (`game_667657`) — clave de la caché de traducción. */
  mediaId: string;
}

export async function TranslatedSynopsis({ text, mediaId }: Props) {
  const locale = await getLocale();
  const translated = await translateSynopsis({ text, locale, mediaId });
  return <SynopsisSection text={translated} />;
}
