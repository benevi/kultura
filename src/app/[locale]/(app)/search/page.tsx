// ============================================================
// KULTURA — /search → redirect a /discover (E-DISCOVER-SEARCH-MERGE)
//
// El buscador de texto vive ahora DENTRO de Descubrir (misma barra, mismo grid,
// misma paginación), así que esta ruta ya no tiene UI propia: se conserva solo
// como redirect permanente para no romper enlaces guardados, historiales ni el
// acceso "Buscar" del bottom-sheet móvil.
//
// `q` y `type` se trasladan tal cual: `/search?q=dune&type=movie` →
// `/discover?type=movie&page=1&q=dune`.
// ============================================================

// `redirect` de @/i18n/navigation (no el de next/navigation): conserva el
// prefijo de locale de la URL actual.
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { VALID_TYPES } from "@/lib/api/discover-params";

interface Props {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function SearchRedirectPage({ searchParams }: Props) {
  const { q, type } = await searchParams;
  const locale = await getLocale();

  const params = new URLSearchParams();
  // `type` solo se traslada si es uno de los tipos válidos de Descubrir; el
  // `type=all` que emitía la SearchBar antigua ES válido (agregado).
  params.set(
    "type",
    type && (VALID_TYPES as readonly string[]).includes(type) ? type : "all"
  );
  params.set("page", "1");
  const query = q?.trim();
  if (query) params.set("q", query);

  redirect({ href: `/discover?${params.toString()}`, locale });
}
