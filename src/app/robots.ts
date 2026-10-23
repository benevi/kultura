import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * Todo lo público se indexa; la API no. La app autenticada redirige a login
 * y las páginas que no deben indexarse (login, rankings cortos) lo dicen con
 * `noindex` en su HTML: bloquearlas aquí impediría a Google leerlo.
 * `sitemap.xml` es el índice de las secciones (`/sitemap/{id}.xml`).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
