import { cn } from "@/lib/utils/index";

export interface FoilProps {
  /** Sin brillo cuando es `false` (el envoltorio no cambia la maquetación). */
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Brillo («brillante»): una banda especular que cruza lo que envuelve, en
 * bucle. Es la ÚNICA animación infinita del sistema y solo va en cromos
 * 10/10 y en el podio de los rankings. Se para con movimiento reducido.
 * Decorativa: el 10/10 tiene que estar escrito en otra parte.
 */
export function Foil({ active = true, children, className }: FoilProps) {
  return (
    <span data-foil={active ? "" : undefined} className={cn("block rounded-cromo", active && "cromo-foil", className)}>
      {children}
    </span>
  );
}
