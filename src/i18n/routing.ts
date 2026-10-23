import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  // SEO-4: sin cabecera `Link` de hreflang. La ponía el middleware en cada
  // respuesta (duplicada y con un x-default distinto del del HTML); las
  // alternativas de idioma van solo en los metadatos de cada página y en el
  // sitemap, que son una sola fuente.
  alternateLinks: false,
});
