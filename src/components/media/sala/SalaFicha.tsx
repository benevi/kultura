import type { ReactNode } from "react";
import { SALA_WORK_CLASS } from "@/lib/design/sala-palette";
import { cn } from "@/lib/utils/index";
import type { MediaItem } from "@/types/media";
import { SalaFichaHero } from "./SalaFichaHero";

/**
 * La ficha con «Sala» (fase 8.5): la sala arriba y, debajo, lo que se le pase
 * (F2a: la franja y la ficha, `SalaFichaBody`). Todo va dentro de un mismo
 * contenedor `sala-work`: cuando la imagen da su paleta (`SalaFichaImage`), la
 * recibe la página entera, no solo la sala.
 *
 * La sala no cambia con el tema (lleva su propio `data-theme`); lo de debajo
 * sigue al tema de la página. Quien la usa le pone `key={item.id}`: así otra
 * obra no hereda la paleta de la anterior.
 */
export function SalaFicha({ item, children }: { item: MediaItem; children?: ReactNode }) {
  return (
    <div
      className={cn(
        SALA_WORK_CLASS,
        "font-sala-text bg-sala-background text-sala-ink",
        "transition-colors duration-sala-slow ease-sala motion-reduce:transition-none"
      )}
    >
      <SalaFichaHero item={item} />
      {children}
    </div>
  );
}
