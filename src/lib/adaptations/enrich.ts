// ============================================================
// KULTURA — Portadas y "ya en tu biblioteca" de los títulos vinculados (F-29)
//
// Portadas: solo las que ya están en el catálogo `media` (lectura pública,
// `media_select_all`); no se llama a ningún proveedor por un vínculo. Sin
// portada, la tarjeta pinta el degradado de respaldo.
// Biblioteca: con la sesión de quien mira (la RLS deja leer solo lo suyo).
// Si algo falla, vacío: la sección se pinta igual.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_IDS = 60;

export async function loadPosters(supabase: SupabaseClient, mediaIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(mediaIds)).slice(0, MAX_IDS);
  if (ids.length === 0) return new Map();
  try {
    const { data, error } = await supabase.from("media").select("id, poster").in("id", ids);
    if (error || !Array.isArray(data)) return new Map();
    return new Map(
      (data as Array<{ id: string; poster: string | null }>)
        .filter((r) => typeof r.poster === "string" && r.poster)
        .map((r) => [r.id, r.poster as string]),
    );
  } catch {
    return new Map();
  }
}

export async function loadInLibrary(supabase: SupabaseClient, userId: string, mediaIds: string[]): Promise<Set<string>> {
  const ids = Array.from(new Set(mediaIds)).slice(0, MAX_IDS);
  if (!userId || ids.length === 0) return new Set();
  try {
    const { data, error } = await supabase
      .from("user_media")
      .select("media_id")
      .eq("user_id", userId)
      .in("media_id", ids);
    if (error || !Array.isArray(data)) return new Set();
    return new Set((data as Array<{ media_id: string }>).map((r) => r.media_id));
  } catch {
    return new Set();
  }
}
