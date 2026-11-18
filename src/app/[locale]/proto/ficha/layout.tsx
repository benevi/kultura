// Prototipo fase 8.3 (rama desechable `proto/fase8-3-direcciones`).
// Se ve sin sesión y sin la cabecera de la app. No se indexa.

import type { Metadata } from "next";
import "./_base/proto.css";

export const metadata: Metadata = {
  title: "Prototipo de ficha · fase 8.3",
  robots: { index: false, follow: false },
};

export default function ProtoFichaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
