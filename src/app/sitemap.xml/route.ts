import { sitemapIndexXml } from "@/lib/best/sitemap";

/**
 * Índice de sitemaps (SEO-3). Con `generateSitemaps`, Next 14 sirve cada
 * sección en `/sitemap/{id}.xml` pero no genera el índice: esta ruta lo pone
 * en la URL de siempre, la que ya conocen Search Console y `robots.txt`.
 */
export const dynamic = "force-static";
export const revalidate = 86400;

export function GET() {
  return new Response(sitemapIndexXml(), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
