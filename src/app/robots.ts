import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** Todo lo público se indexa; la API no. La app autenticada redirige a login. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
