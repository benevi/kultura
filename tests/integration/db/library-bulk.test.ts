// ============================================================
// KULTURA — Añadir en bloque (saneamiento 6.4), contra PostgREST real.
// La consulta de `addPendingBulk`: upsert con ignoreDuplicates bajo la RLS de
// quien llama. Comprueba que NO pisa una entrada existente (estado y nota) y
// que RETURNING trae solo las filas insertadas.
// ============================================================

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, configured, createUser, deleteCreatedUsers, type TestUser } from "../rls/helpers";

const IDS = ["movie_bulk_test_1", "movie_bulk_test_2", "movie_bulk_test_3"];

describe.skipIf(!configured)("library: añadir en bloque (proyecto de test)", () => {
  let ana: TestUser;

  beforeAll(async () => {
    ana = await createUser("bulk-ana");
    const { error } = await adminClient()
      .from("media")
      .upsert(IDS.map((id, i) => ({ id, external_id: id, type: "movie", title: `Bulk ${i + 1}` })));
    if (error) throw new Error(`media: ${error.message}`);
    // Ya en la biblioteca, terminada y con nota: no se puede tocar.
    const seeded = await ana.client
      .from("user_media")
      .insert({ user_id: ana.id, media_id: IDS[1], status: "completed", rating10: 10 });
    if (seeded.error) throw new Error(`seed: ${seeded.error.message}`);
  });

  afterAll(async () => {
    await deleteCreatedUsers();
  });

  it("inserta solo las nuevas como Pendiente y deja la existente como estaba", async () => {
    const { data, error } = await ana.client
      .from("user_media")
      .upsert(
        IDS.map((media_id) => ({ user_id: ana.id, media_id, status: "pending" })),
        { onConflict: "user_id,media_id", ignoreDuplicates: true }
      )
      .select("media_id");
    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.media_id).sort()).toEqual([IDS[0], IDS[2]]);

    const { data: rows } = await ana.client
      .from("user_media")
      .select("media_id, status, rating10")
      .eq("user_id", ana.id)
      .in("media_id", IDS)
      .order("media_id");
    expect(rows).toEqual([
      { media_id: IDS[0], status: "pending", rating10: null },
      { media_id: IDS[1], status: "completed", rating10: 10 },
      { media_id: IDS[2], status: "pending", rating10: null },
    ]);
  });

  it("repetirlo no inserta nada (RETURNING vacío)", async () => {
    const { data, error } = await ana.client
      .from("user_media")
      .upsert(
        IDS.map((media_id) => ({ user_id: ana.id, media_id, status: "pending" })),
        { onConflict: "user_id,media_id", ignoreDuplicates: true }
      )
      .select("media_id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("no puede insertar en la biblioteca de otro (RLS)", async () => {
    const bea = await createUser("bulk-bea");
    const { error } = await ana.client
      .from("user_media")
      .upsert([{ user_id: bea.id, media_id: IDS[0], status: "pending" }], {
        onConflict: "user_id,media_id",
        ignoreDuplicates: true,
      })
      .select("media_id");
    expect(error).not.toBeNull();
  });
});
