import type { ReactNode } from "react";
import { kulturaDisplay } from "@/app/fonts";

/** La display estrecha de la landing, solo en esta pantalla. */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className={kulturaDisplay.variable} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
