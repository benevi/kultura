// ============================================================
// KULTURA — Sondas de proveedores para `/api/health?deep=1` (COD-2)
//
// Una llamada BARATA por proveedor (configuración, un género, un tipo…), en
// paralelo, sin caché de datos y con el plazo común de 6 s. El resultado
// completo se guarda 5 min (`unstable_cache`): por mucho que se llame a la
// ruta, como mucho sale una ronda de sondas cada 5 min, así que no sirve para
// gastar el cupo de RAWG o ComicVine.
//
// Ocho entradas: los proveedores que sirven catálogo o ficha. Jikan queda
// fuera a propósito: solo resuelve ids antiguos de bibliotecas (ver
// `jikan.ts`), y su caída no se nota en ninguna pantalla nueva.
// ============================================================

import { unstable_cache } from "next/cache";
import {
  providerCircuitState,
  ProviderError,
  type ProviderId,
} from "@/lib/api/http";
import { probeTmdb } from "@/lib/api/tmdb";
import { probeRawg } from "@/lib/api/rawg";
import { probeAniList } from "@/lib/api/anilist";
import { probeComicVine } from "@/lib/api/comicvine";
import { probeMangaDex } from "@/lib/api/mangadex";
import { probeOpenLibrary } from "@/lib/api/openlibrary";
import { probeGoogleBooks } from "@/lib/api/googlebooks";
import { probeSteam } from "@/lib/api/steam";

/** Resultado de las sondas: 5 min. */
export const DEEP_HEALTH_TTL_SECONDS = 300;

export const PROBES: ReadonlyArray<[ProviderId, () => Promise<void>]> = [
  ["tmdb", probeTmdb],
  ["rawg", probeRawg],
  ["anilist", probeAniList],
  ["comicvine", probeComicVine],
  ["mangadex", probeMangaDex],
  ["openlibrary", probeOpenLibrary],
  ["googlebooks", probeGoogleBooks],
  ["steam", probeSteam],
];

export interface ProviderProbe {
  ok: boolean;
  ms: number;
  /** Estado del circuito de ESTA instancia tras la sonda. */
  circuit: "closed" | "open" | "half-open";
  /** Solo si falla: tipo de fallo y status, nunca el mensaje (puede llevar URL). */
  error?: string;
  status?: number;
}

export interface ProvidersReport {
  ok: boolean;
  checkedAt: string;
  providers: Record<string, ProviderProbe>;
}

function describeFailure(e: unknown): Pick<ProviderProbe, "error" | "status"> {
  if (e instanceof ProviderError) return { error: e.kind, status: e.status };
  const status = (e as { status?: unknown } | null)?.status;
  if (typeof status === "number") return { error: "http", status };
  // Sin clave configurada (ComicVine) u otro fallo local.
  return { error: "unavailable" };
}

/** Lanza todas las sondas en paralelo. Nunca lanza. */
export async function runProviderProbes(): Promise<ProvidersReport> {
  const entries = await Promise.all(
    PROBES.map(async ([provider, probe]): Promise<[string, ProviderProbe]> => {
      const startedAt = Date.now();
      try {
        await probe();
        return [
          provider,
          { ok: true, ms: Date.now() - startedAt, circuit: providerCircuitState(provider) },
        ];
      } catch (e) {
        return [
          provider,
          {
            ok: false,
            ms: Date.now() - startedAt,
            circuit: providerCircuitState(provider),
            ...describeFailure(e),
          },
        ];
      }
    })
  );
  const providers = Object.fromEntries(entries);
  return {
    ok: entries.every(([, p]) => p.ok),
    checkedAt: new Date().toISOString(),
    providers,
  };
}

const cachedProbes = unstable_cache(runProviderProbes, ["health-deep-v1"], {
  revalidate: DEEP_HEALTH_TTL_SECONDS,
  tags: ["health-deep"],
});

/** Sondas con el resultado cacheado 5 min (sin caché fuera de Next). */
export async function getProvidersReport(): Promise<ProvidersReport> {
  try {
    return await cachedProbes();
  } catch (e) {
    if (e instanceof Error && e.message.includes("incrementalCache missing")) {
      return runProviderProbes();
    }
    throw e;
  }
}
