import "./globals.css";

/**
 * Layout raíz: solo pasa los hijos (SEO-5/ACC-15). El documento (`<html lang>`
 * y `<body>`) lo pinta `[locale]/layout.tsx` con el idioma de la URL; antes
 * había dos `<html>` anidados y el de fuera sin idioma. Next exige este
 * archivo porque hay `not-found.tsx` en la raíz, que pinta su propio
 * documento, igual que `global-error.tsx`.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
