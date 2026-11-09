import type { ListShelfItem } from "@/lib/social/lists";
import { formatVar } from "../Blocks";
import { Cover } from "../library/Cover";

/** Tamaños que acepta el optimizador: el lomo se recorta de una portada pequeña. */
const SPINE_WIDTHS = [128];
/** En móvil caben ocho: los demás no se ven y no deben adelantarse. */
const EAGER_SPINES = 8;

// La balda: las obras de la lista de pie sobre un tablón, enseñando el lomo. Es
// decoración (el nombre y la cuenta van en texto al lado), y una lista vacía es
// el tablón solo. Una obra sin portada, o que falla, es un lomo del color de su formato.
export function Shelf({ items, eager = false }: { items: ListShelfItem[]; eager?: boolean }) {
  return (
    <span className="k2l-shelf" aria-hidden="true">
      {items.map((item, index) => (
        <span
          key={`${item.mediaId}-${index}`}
          className="k2l-spine"
          style={{ "--c": formatVar(item.type) } as React.CSSProperties}
        >
          <Cover
            poster={item.poster}
            title=""
            widths={SPINE_WIDTHS}
            sizes="64px"
            loading={eager && index < EAGER_SPINES ? "eager" : "lazy"}
          />
        </span>
      ))}
    </span>
  );
}
