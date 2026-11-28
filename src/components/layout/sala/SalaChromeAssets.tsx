"use client";

import dynamic from "next/dynamic";

/** Las hojas de `SalaChromeStyles`, por `next/dynamic` (como `SalaFichaAssets`). */
const SalaChromeStyles = dynamic(() => import("./SalaChromeStyles"));

export function SalaChromeAssets() {
  return <SalaChromeStyles />;
}
