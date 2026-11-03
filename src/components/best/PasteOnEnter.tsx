"use client";

import { useRef } from "react";
import { usePasteGrid } from "@/lib/motion/usePasteGrid";

/**
 * El pegado escalonado de los cromos de una lista pública, UNA vez, la
 * primera vez que entra en pantalla (40 ms por cromo, ≤ 600 ms, nada con
 * movimiento reducido). Parte de un estado visible: sin JS se ve igual.
 */
export function PasteOnEnter({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  usePasteGrid(ref, { trigger: "enter" });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
