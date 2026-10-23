import type { MetadataRoute } from "next";
import { SITEMAP_SECTIONS, sectionSitemap } from "@/lib/best/sitemap";

/**
 * Sitemap por secciones (SEO-3): `/sitemap/{pages,rankings,titles,collections}.xml`,
 * enumeradas por el índice `/sitemap.xml` (`sitemap.xml/route.ts`). Se
 * regenera cada 6 h; los rankings salen de su propia caché de 24 h, así que
 * regenerarlo no llama a los proveedores ni al modelo de traducción.
 */
export const revalidate = 21600;

export async function generateSitemaps() {
  return SITEMAP_SECTIONS.map((id) => ({ id }));
}

export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  return sectionSitemap(id);
}
