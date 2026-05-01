// ============================================================
// KULTURA — StreamingProviders
// Lista de plataformas donde está disponible el título.
// Prioriza flatrate > rent > buy. Elimina duplicados por nombre.
// Server Component (sin "use client").
// ============================================================

import type { StreamingProvider } from "@/types/media";

interface StreamingProvidersProps {
  providers: StreamingProvider[];
  title: string;
}

export function StreamingProviders({
  providers,
  title,
}: StreamingProvidersProps) {
  const flatrate = providers.filter((p) => p.type === "flatrate");
  const toShow =
    flatrate.length > 0
      ? flatrate
      : providers.filter((p) => p.type === "rent").length > 0
        ? providers.filter((p) => p.type === "rent")
        : providers.filter((p) => p.type === "buy");

  // Dedup por nombre
  const unique = toShow.filter(
    (p, i, arr) => arr.findIndex((x) => x.name === p.name) === i
  );

  if (unique.length === 0) return null;

  return (
    <div>
      <h2 className="font-display text-2xl tracking-wide text-text mb-3">
        {title}
      </h2>
      <div className="flex flex-wrap gap-3">
        {unique.map((p) => (
          <div key={p.name} className="flex flex-col items-center gap-1">
            {/* img nativo intencionado: logos pequeños, muchos providers */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.logoPath}
              alt={p.name}
              width={48}
              height={48}
              className="w-12 h-12 rounded-lg object-contain bg-surface2"
            />
            <span className="text-xs text-muted">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
