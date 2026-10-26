// Dobles de Supabase para los tests de "le da 9/10" (CRE-8): el almacén en
// memoria de `media/fake-supabase` más `rpc`, `auth.admin` y un registro de
// QUIÉN lee cada tabla (para comprobar que el cliente admin no lee la
// biblioteca de nadie sin consentimiento).
import { createFakeDb, fakeClient, type FakeDb } from "../media/fake-supabase";

export interface ShareWorld {
  db: FakeDb;
  reads: Array<{ client: string; table: string }>;
  rpc: Record<string, (args: Record<string, unknown>, client: string) => { data: unknown; error: unknown }>;
  metadata: Record<string, Record<string, unknown>>;
}

export function createWorld(): ShareWorld {
  return {
    db: createFakeDb({
      users: [
        { id: "owner", username: "benevi", avatar_color: "pink", avatar_initials: "BE", library_visibility: "friends" },
        { id: "friend", username: "ana", avatar_color: "lime", avatar_initials: "AN", library_visibility: "friends" },
        { id: "stranger", username: "luis", avatar_color: "blue", avatar_initials: "LU", library_visibility: "friends" },
      ],
      user_media: [{ user_id: "owner", media_id: "movie_438631", score: 5, rating10: 9, media: { title: "Dune", poster: "https://image.tmdb.org/t/p/w500/d.jpg", year: 2021 } }],
      media: [{ id: "movie_438631", title: "Dune", poster: "https://image.tmdb.org/t/p/w500/d.jpg", year: 2021 }],
    }),
    reads: [],
    rpc: {},
    metadata: { owner: { rating_scale: "ten" } },
  };
}

export function worldClient(world: ShareWorld, client: string, uid: string | null = null) {
  const base = fakeClient(world.db, client === "admin" ? "admin" : "user");
  return {
    ...base,
    from: (table: string) => {
      world.reads.push({ client, table });
      const query = base.from(table) as unknown as {
        filters: Array<(row: Record<string, unknown>) => boolean>;
        not: (col: string, op: string, value: unknown) => unknown;
      };
      // `.not(col, 'is', null)` (el doble común no lo tiene).
      query.not = (col, op, value) => {
        if (op !== "is" || value !== null) throw new Error(`share-fakes: not(${op}) no soportado`);
        query.filters.push((row) => row[col] !== null && row[col] !== undefined);
        return query;
      };
      return query as unknown as ReturnType<typeof base.from>;
    },
    rpc: async (name: string, args: Record<string, unknown>) =>
      world.rpc[name]?.({ ...args, uid }, client) ?? { data: null, error: { code: "PGRST202", message: "no existe" } },
    auth: {
      ...base.auth,
      admin: {
        getUserById: async (id: string) => ({ data: { user: { id, user_metadata: world.metadata[id] ?? {} } }, error: null }),
      },
    },
  };
}
