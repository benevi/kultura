/** URL canónica pública, sin barra final. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kulturaapp.vercel.app").replace(/\/+$/, "");
}
