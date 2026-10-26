import type { Json } from "@/types/supabase";

/**
 * Un objeto del dominio como valor de una columna `jsonb` del cliente tipado.
 *
 * TypeScript no deja asignar una `interface` (`EpisodeProgress`,
 * `AiRecsResult`…) al tipo `Json` generado aunque solo lleve números, cadenas,
 * booleanos y arrays: a las interfaces les falta la firma de índice. El único
 * cast está aquí y solo vale para datos que ya son JSON (sin `Date`, `Map`,
 * `undefined` dentro de arrays ni funciones).
 */
export function asJson(value: object): NonNullable<Json>;
export function asJson(value: object | null): Json;
export function asJson(value: object | null): Json {
  return value as unknown as Json;
}
