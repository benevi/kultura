import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { salaDescubrirEnabled } from "@/lib/flags/sala";
import { DiscoverClient } from "./DiscoverClient";

interface SearchParams {
  type?: string;
  page?: string;
  /** E-DISCOVER-SEARCH-MERGE: búsqueda de texto dentro de Descubrir. */
  q?: string;
}

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "es" ? "Descubrir" : "Discover",
  };
}

// E59 F2: el fetch de datos se movió a /api/discover (lo llama el cliente),
// por lo que esta página ya no hace fetch server-side. Solo resuelve los params
// de URL y delega en DiscoverClient, que pide los datos al Route Handler.
export default async function DiscoverPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const type = resolvedSearchParams.type ?? "movie";
  const page = Math.max(1, parseInt(resolvedSearchParams.page ?? "1", 10) || 1);
  const q = resolvedSearchParams.q?.trim() ?? "";

  // Fase 8.5 D1: Descubrir en «Sala» (bandera SALA_DESCUBRIR: 0, prueba o 1).
  // Los textos de su zona de avisos, los mismos que en la ficha y la
  // biblioteca: van por aquí para no mandar todo `media_detail` a cada página
  // con sesión (REN-5).
  const tMedia = (await salaDescubrirEnabled()) ? await getTranslations("media_detail") : null;
  const sala = tMedia
    ? {
        toastLabels: {
          region: tMedia("salaToastRegion"),
          dismiss: tMedia("salaToastDismiss"),
          hint: tMedia("salaToastHint"),
        },
      }
    : null;

  return (
    <main className="page-grid py-8">
      <DiscoverClient
        currentType={type}
        currentPage={page}
        currentQuery={q}
        quickAdd={process.env.QUICK_ADD === "1"}
        sala={sala}
      />
    </main>
  );
}
