import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { fetchDiscoverData } from "@/lib/api/discover";
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

export default async function DiscoverPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "discover" });
  const resolvedSearchParams = await searchParams;
  const type = resolvedSearchParams.type ?? "movie";
  const page = Math.max(1, parseInt(resolvedSearchParams.page ?? "1", 10) || 1);

  const { items, totalPages, fetchErrorKind } = await fetchDiscoverData(
    type,
    page
  );

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      {fetchErrorKind !== null && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {fetchErrorKind === "rate-limit"
            ? t("fetchError.rateLimit")
            : t("fetchError.generic")}
        </div>
      )}
      <DiscoverClient
        items={items}
        currentType={type}
        currentPage={page}
        totalPages={totalPages}
      />
    </main>
  );
}
