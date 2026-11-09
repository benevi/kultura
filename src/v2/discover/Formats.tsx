"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRadioGroupKeys } from "@/components/ui/useRadioGroupKeys";
import { TYPE_ORDER, type DiscoverType } from "@/lib/discover/type-filters";
import { formatVar } from "../Blocks";

/** «Todos» no es un formato: va en hueso, como lo que no tiene color propio. */
const colorOf = (type: DiscoverType) => (type === "all" ? "var(--k-bone)" : formatVar(type));

// La banda: un canto de color por formato. El elegido se llena de ese color.
export function Formats({ type, onChange }: { type: DiscoverType; onChange: (type: string) => void }) {
  const tF = useTranslations("filters");
  const band = useRef<HTMLDivElement>(null);
  const { getItemProps } = useRadioGroupKeys(TYPE_ORDER, type, (next) => {
    // Repetir el activo borraría los filtros sin haber cambiado nada.
    if (next !== type) onChange(next);
  });

  // En móvil la banda se desplaza: el elegido no puede quedarse fuera, sobre todo
  // al llegar por un enlace a «Cómics», el último.
  useEffect(() => {
    const el = band.current;
    const cell = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!el || !cell || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = cell.offsetLeft - (el.clientWidth - cell.offsetWidth) / 2;
  }, [type]);

  return (
    <div ref={band} className="k2d-formats" role="radiogroup" aria-label={tF("type")}>
      {TYPE_ORDER.map((value, index) => {
        const props = getItemProps(value, index);
        return (
          <button
            key={value}
            type="button"
            className="k2d-format"
            style={{ "--c": colorOf(value) } as React.CSSProperties}
            onClick={() => {
              if (value !== type) onChange(value);
            }}
            {...props}
            ref={props.ref as (el: HTMLButtonElement | null) => void}
          >
            <span>{value === "all" ? tF("all") : tF(value)}</span>
          </button>
        );
      })}
    </div>
  );
}
