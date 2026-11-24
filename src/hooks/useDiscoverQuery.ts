// ============================================================
// KULTURA — Pide una página de Descubrir a /api/discover (E59 F2/F5e)
//
// El fetch vive en el navegador para que los E2E puedan mockearlo con
// `page.route`. Se re-pide al cambiar cualquier entrada; una respuesta tardía
// de una petición anterior se descarta. Sin filtrado en cliente: la URL es la
// única fuente de verdad y el servidor aplica todos los filtros.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/types/media";
import type { DiscoverResult } from "@/lib/api/discover";
import { ApiError, apiFetch } from "@/lib/api/client";

export interface DiscoverQueryInput {
  type: string;
  page: number;
  /** Query string estable con los filtros de la URL. */
  filterQuery: string;
  /** Búsqueda de texto (E-DISCOVER-SEARCH-MERGE); vacía = catálogo. */
  query: string;
  locale: string;
  /** Se llama al terminar cada petición vigente (con éxito o con error). */
  onSettled?: () => void;
}

export interface DiscoverQueryState {
  items: MediaItem[];
  /** E79-s1: gobierna "siguiente" (fuente cruda), no `totalPages`. */
  hasMore: boolean;
  /** E79-s2: `null` = total no fiable (post-filtro activo). */
  totalPages: number | null;
  fetchErrorKind: DiscoverResult["fetchErrorKind"];
  loading: boolean;
  /** Vuelve a pedir la misma página (el «Reintentar» del error, fase 8.5 D1). */
  retry: () => void;
}

export function useDiscoverQuery({
  type,
  page,
  filterQuery,
  query,
  locale,
  onSettled,
}: DiscoverQueryInput): DiscoverQueryState {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalPages, setTotalPages] = useState<number | null>(1);
  const [fetchErrorKind, setFetchErrorKind] = useState<DiscoverResult["fetchErrorKind"]>(null);
  const [loading, setLoading] = useState(true);
  // Cada «Reintentar» sube el contador y el efecto vuelve a pedir.
  const [attempt, setAttempt] = useState(0);
  // El aviso de fin no es una dependencia del fetch: cambiarlo no re-pide.
  const settled = useRef(onSettled);
  settled.current = onSettled;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams(filterQuery);
    params.set("type", type);
    params.set("page", String(page));
    if (query.trim()) params.set("q", query.trim());
    // F-06 (DAT-1): el idioma viaja en la URL (la caché de borde no mezcla idiomas).
    params.set("locale", locale);
    apiFetch<DiscoverResult>(`/api/discover?${params.toString()}`)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setHasMore(data.hasMore ?? false);
        // `null` es significativo: solo el campo ausente cae a 1.
        setTotalPages(data.totalPages === undefined ? 1 : data.totalPages);
        setFetchErrorKind(data.fetchErrorKind ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        setHasMore(false);
        setTotalPages(1);
        setFetchErrorKind(err instanceof ApiError && err.code === "rate_limited" ? "rate-limit" : "generic");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          settled.current?.();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [type, page, filterQuery, query, locale, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { items, hasMore, totalPages, fetchErrorKind, loading, retry };
}
