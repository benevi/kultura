import type { Metadata } from "next";
import { DiscoverClient } from "./DiscoverClient";

interface SearchParams {
  type?: string;
  page?: string;
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

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      <DiscoverClient currentType={type} currentPage={page} />
    </main>
  );
}
