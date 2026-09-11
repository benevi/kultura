import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "../globals.css";

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${bricolageGrotesque.variable} ${figtree.variable} font-body bg-surface-base text-text-primary antialiased grain min-h-screen`}
    >
      {children}
    </div>
  );
}
