import { getTranslations } from "next-intl/server";

/**
 * Atribución que exigen los proveedores del catálogo: TMDB pide su aviso de
 * "no respaldado" y RAWG un enlace visible en las páginas que usan sus datos.
 * Es una función async y no un componente: los pies que la usan ya son
 * Server Components async y la renderizan con `await`.
 */
export async function renderDataAttribution(className = "") {
  const t = await getTranslations("legal");
  const link = (href: string) => (chunks: React.ReactNode) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 hover:text-accent-pink transition-colors"
    >
      {chunks}
    </a>
  );

  return (
    <p className={`text-xs text-muted ${className}`}>
      {t.rich("dataSources", {
        tmdb: link("https://www.themoviedb.org"),
        rawg: link("https://rawg.io"),
      })}{" "}
      {t("tmdbNotice")}
    </p>
  );
}
